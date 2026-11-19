import { Injectable } from '@nestjs/common';
import type { Queryable } from '../db/db.types.js';
import type { LedgerOrder } from '../portfolio/domain/ledger.js';
import {
  LEDGER_STATUSES_SQL,
  type LedgerOrderRow,
  toLedgerOrder,
} from '../portfolio/ledger-row.js';

export interface InstrumentRow {
  id: number;
  type: string;
}

export interface NewOrder {
  userId: number;
  instrumentId: number;
  side: string;
  type: string;
  status: string;
  size: number;
  price: string;
}

export interface OrderRow {
  id: number;
  userid: number;
  instrumentid: number;
  side: string;
  type: string;
  status: string;
  size: number;
  price: string;
  created_at: string;
}

const ORDER_COLUMNS = `
  id, userid, instrumentid, side, type, status, size, price,
  to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
`;

@Injectable()
export class OrdersRepository {
  async lockUser(tx: Queryable, userId: number): Promise<boolean> {
    const rows = await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    return rows.length > 0;
  }

  async findInstrument(tx: Queryable, instrumentId: number): Promise<InstrumentRow | null> {
    const rows = await tx.query<InstrumentRow>('SELECT id, type FROM instruments WHERE id = $1', [
      instrumentId,
    ]);
    return rows[0] ?? null;
  }

  async findLastClose(tx: Queryable, instrumentId: number): Promise<string | null> {
    const rows = await tx.query<{ close: string | null }>(
      'SELECT close FROM marketdata WHERE instrumentid = $1 ORDER BY date DESC LIMIT 1',
      [instrumentId],
    );
    return rows[0]?.close ?? null;
  }

  async findLedgerOrders(tx: Queryable, userId: number): Promise<LedgerOrder[]> {
    const rows = await tx.query<LedgerOrderRow>(
      `SELECT id, instrumentid, side, status, size, price, datetime
       FROM orders
       WHERE userid = $1 AND status IN ${LEDGER_STATUSES_SQL}`,
      [userId],
    );
    return rows.map(toLedgerOrder);
  }

  async insert(tx: Queryable, order: NewOrder): Promise<OrderRow> {
    const rows = await tx.query<OrderRow>(
      `INSERT INTO orders (userid, instrumentid, side, type, status, size, price, datetime)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() AT TIME ZONE 'UTC')
       RETURNING ${ORDER_COLUMNS}`,
      [
        order.userId,
        order.instrumentId,
        order.side,
        order.type,
        order.status,
        order.size,
        order.price,
      ],
    );
    const [inserted] = rows;
    if (inserted === undefined) throw new Error('Order insert returned no row');
    return inserted;
  }

  async findOwnedForUpdate(
    tx: Queryable,
    orderId: number,
    userId: number,
  ): Promise<OrderRow | null> {
    const rows = await tx.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 AND userid = $2 FOR UPDATE`,
      [orderId, userId],
    );
    return rows[0] ?? null;
  }

  async markCancelled(tx: Queryable, orderId: number): Promise<OrderRow> {
    const rows = await tx.query<OrderRow>(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 RETURNING ${ORDER_COLUMNS}`,
      [orderId],
    );
    const [updated] = rows;
    if (updated === undefined) throw new Error(`Order ${orderId} disappeared while cancelling`);
    return updated;
  }
}
