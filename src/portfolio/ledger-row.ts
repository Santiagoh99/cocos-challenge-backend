import { money } from '../common/money.js';
import { parseOrderSide, parseOrderStatus } from '../orders/domain/order.js';
import type { LedgerOrder } from './domain/ledger.js';

export interface LedgerOrderRow {
  id: number;
  instrumentid: number;
  side: string;
  status: string;
  size: number;
  price: string;
  datetime: Date;
}

export const LEDGER_STATUSES_SQL = "('FILLED', 'NEW')";

export function toLedgerOrder(row: LedgerOrderRow): LedgerOrder {
  return {
    id: row.id,
    instrumentId: row.instrumentid,
    side: parseOrderSide(row.side),
    status: parseOrderStatus(row.status),
    size: row.size,
    price: money(row.price),
    createdAt: row.datetime,
  };
}
