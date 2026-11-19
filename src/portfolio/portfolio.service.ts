import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain.errors.js';
import { formatMoney, formatPercent, money, type Money } from '../common/money.js';
import type { Quote } from '../common/quote.js';
import { parseOrderSide, parseOrderStatus } from '../orders/domain/order.js';
import type { LedgerOrder } from './domain/ledger.js';
import { buildPortfolio, type InstrumentInfo, type Position } from './domain/portfolio.js';
import { PortfolioRepository, type PortfolioOrderRow } from './portfolio.repository.js';

export interface PositionResponse {
  instrumentId: number;
  ticker: string;
  name: string;
  quantity: number;
  availableQuantity: number;
  averageCost: string | null;
  lastPrice: string | null;
  marketValue: string | null;
  totalReturnPercent: string | null;
  dailyReturnPercent: string | null;
}

export interface PortfolioResponse {
  userId: number;
  totalValue: string;
  cash: string;
  reservedCash: string;
  availableCash: string;
  positions: PositionResponse[];
}

@Injectable()
export class PortfolioService {
  constructor(private readonly repository: PortfolioRepository) {}

  async getPortfolio(userId: number): Promise<PortfolioResponse> {
    if (!(await this.repository.userExists(userId))) throw new NotFoundError('User', userId);

    const rows = await this.repository.findOrdersWithQuotes(userId);
    const portfolio = buildPortfolio({
      orders: rows.map(toLedgerOrder),
      quotes: quotesFrom(rows),
      instruments: instrumentsFrom(rows),
    });

    return {
      userId,
      totalValue: formatMoney(portfolio.totalValue),
      cash: formatMoney(portfolio.cash.total),
      reservedCash: formatMoney(portfolio.cash.reserved),
      availableCash: formatMoney(portfolio.cash.available),
      positions: portfolio.positions.map(toPositionResponse),
    };
  }
}

function toLedgerOrder(row: PortfolioOrderRow): LedgerOrder {
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

function quotesFrom(rows: readonly PortfolioOrderRow[]): Map<number, Quote> {
  const quotes = new Map<number, Quote>();
  for (const row of rows) {
    if (row.close === null || row.previousclose === null) continue;
    quotes.set(row.instrumentid, {
      close: money(row.close),
      previousClose: money(row.previousclose),
    });
  }
  return quotes;
}

function instrumentsFrom(rows: readonly PortfolioOrderRow[]): Map<number, InstrumentInfo> {
  return new Map(
    rows.map((row) => [
      row.instrumentid,
      { id: row.instrumentid, ticker: row.ticker, name: row.name },
    ]),
  );
}

const optionalMoney = (value: Money | null): string | null =>
  value === null ? null : formatMoney(value);
const optionalPercent = (value: Money | null): string | null =>
  value === null ? null : formatPercent(value);

function toPositionResponse(position: Position): PositionResponse {
  return {
    instrumentId: position.instrument.id,
    ticker: position.instrument.ticker,
    name: position.instrument.name,
    quantity: position.quantity,
    availableQuantity: position.availableQuantity,
    averageCost: optionalMoney(position.averageCost),
    lastPrice: optionalMoney(position.lastPrice),
    marketValue: optionalMoney(position.marketValue),
    totalReturnPercent: optionalPercent(position.totalReturn),
    dailyReturnPercent: optionalPercent(position.dailyReturn),
  };
}
