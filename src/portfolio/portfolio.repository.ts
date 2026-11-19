import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

export interface PortfolioOrderRow {
  id: number;
  instrumentid: number;
  side: string;
  status: string;
  size: number;
  price: string;
  datetime: Date;
  ticker: string;
  name: string;
  close: string | null;
  previousclose: string | null;
}

const USER_EXISTS_SQL = 'SELECT 1 FROM users WHERE id = $1';

const ORDERS_WITH_QUOTES_SQL = `
  SELECT o.id, o.instrumentid, o.side, o.status, o.size, o.price, o.datetime,
         i.ticker, i.name, md.close, md.previousclose
  FROM orders o
  JOIN instruments i ON i.id = o.instrumentid
  LEFT JOIN LATERAL (
    SELECT m.close, m.previousclose
    FROM marketdata m
    WHERE m.instrumentid = o.instrumentid
    ORDER BY m.date DESC
    LIMIT 1
  ) md ON true
  WHERE o.userid = $1
    AND o.status IN ('FILLED', 'NEW')
`;

@Injectable()
export class PortfolioRepository {
  constructor(private readonly db: DbService) {}

  async userExists(userId: number): Promise<boolean> {
    const rows = await this.db.query(USER_EXISTS_SQL, [userId]);
    return rows.length > 0;
  }

  findOrdersWithQuotes(userId: number): Promise<PortfolioOrderRow[]> {
    return this.db.query<PortfolioOrderRow>(ORDERS_WITH_QUOTES_SQL, [userId]);
  }
}
