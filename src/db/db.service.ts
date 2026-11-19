import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { Queryable } from './db.types.js';

const STATEMENT_TIMEOUT_MS = 5000;
const MAX_CONNECTIONS = 10;

@Injectable()
export class DbService implements Queryable, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: MAX_CONNECTIONS,
      statement_timeout: STATEMENT_TIMEOUT_MS,
      application_name: 'cocos-challenge-backend',
    });
    this.pool.on('error', (error) => {
      this.logger.error(`Idle client error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<Row extends QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<Row[]> {
    const result = await this.pool.query<Row>(text, [...params]);
    return result.rows;
  }

  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(toQueryable(client));
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      await rollbackAndRelease(client, this.logger);
      throw error;
    }
  }
}

function toQueryable(client: PoolClient): Queryable {
  return {
    async query<Row extends QueryResultRow>(text: string, params: readonly unknown[] = []) {
      const result = await client.query<Row>(text, [...params]);
      return result.rows;
    },
  };
}

async function rollbackAndRelease(client: PoolClient, logger: Logger): Promise<void> {
  try {
    await client.query('ROLLBACK');
    client.release();
  } catch (rollbackError) {
    const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
    logger.error(`Rollback failed, discarding connection: ${message}`);
    client.release(true);
  }
}
