import { money } from '../../common/money.js';
import type { OrderSide, OrderStatus } from '../../orders/domain/order.js';
import type { LedgerOrder } from './ledger.js';
import type { InstrumentInfo, Quote } from './portfolio.js';

type Row = [number, number, number, number, OrderSide, OrderStatus, string];

const rows: Row[] = [
  [1, 66, 1000000, 1, 'CASH_IN', 'FILLED', '2023-07-12T12:11:20Z'],
  [2, 47, 50, 930, 'BUY', 'FILLED', '2023-07-12T12:31:20Z'],
  [3, 47, 50, 920, 'BUY', 'CANCELLED', '2023-07-12T14:21:20Z'],
  [4, 47, 10, 940, 'SELL', 'FILLED', '2023-07-12T14:51:20Z'],
  [5, 45, 50, 710, 'BUY', 'NEW', '2023-07-12T15:14:20Z'],
  [6, 47, 100, 950, 'SELL', 'REJECTED', '2023-07-12T16:11:20Z'],
  [7, 31, 60, 1500, 'BUY', 'NEW', '2023-07-13T11:13:20Z'],
  [8, 66, 100000, 1, 'CASH_OUT', 'FILLED', '2023-07-13T12:31:20Z'],
  [9, 31, 20, 1540, 'BUY', 'FILLED', '2023-07-13T12:51:20Z'],
  [10, 54, 500, 250, 'BUY', 'FILLED', '2023-07-13T14:11:20Z'],
  [11, 31, 30, 1530, 'SELL', 'FILLED', '2023-07-13T15:13:20Z'],
];

export const userOneOrders: LedgerOrder[] = rows.map(
  ([id, instrumentId, size, price, side, status, createdAt]) => ({
    id,
    instrumentId,
    size,
    price: money(price),
    side,
    status,
    createdAt: new Date(createdAt),
  }),
);

export const userOneQuotes = new Map<number, Quote>([
  [31, { close: money('1502.80'), previousClose: money('1520.25') }],
  [45, { close: money('734.65'), previousClose: money('734.35') }],
  [47, { close: money('925.85'), previousClose: money('921.80') }],
  [54, { close: money('229.50'), previousClose: money('232.00') }],
]);

export const userOneInstruments = new Map<number, InstrumentInfo>([
  [31, { id: 31, ticker: 'BMA', name: 'Banco Macro S.A.' }],
  [45, { id: 45, ticker: 'LOMA', name: 'Loma Negra S.A.' }],
  [47, { id: 47, ticker: 'PAMP', name: 'Pampa Holding S.A.' }],
  [54, { id: 54, ticker: 'METR', name: 'MetroGAS S.A.' }],
]);
