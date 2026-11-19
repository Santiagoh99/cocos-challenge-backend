import { type Money, sum } from '../../common/money.js';
import { dailyReturn, type Quote } from '../../common/quote.js';
import {
  averageCost,
  calculateCash,
  calculateHoldings,
  type CashBalance,
  type Holding,
  type LedgerOrder,
} from './ledger.js';

export interface InstrumentInfo {
  id: number;
  ticker: string;
  name: string;
}

export interface Position {
  instrument: InstrumentInfo;
  quantity: number;
  availableQuantity: number;
  averageCost: Money | null;
  lastPrice: Money | null;
  marketValue: Money | null;
  totalReturn: Money | null;
  dailyReturn: Money | null;
}

export interface Portfolio {
  totalValue: Money;
  cash: CashBalance;
  positions: Position[];
}

export interface PortfolioInput {
  orders: readonly LedgerOrder[];
  quotes: ReadonlyMap<number, Quote>;
  instruments: ReadonlyMap<number, InstrumentInfo>;
}

export function buildPortfolio({ orders, quotes, instruments }: PortfolioInput): Portfolio {
  const cash = calculateCash(orders);
  const positions = calculateHoldings(orders)
    .map((holding) => valuePosition(holding, quotes.get(holding.instrumentId), instruments))
    .sort((a, b) => a.instrument.ticker.localeCompare(b.instrument.ticker));

  const positionsValue = sum(
    positions.flatMap((position) => (position.marketValue === null ? [] : [position.marketValue])),
  );

  return { totalValue: cash.total.plus(positionsValue), cash, positions };
}

function valuePosition(
  holding: Holding,
  quote: Quote | undefined,
  instruments: ReadonlyMap<number, InstrumentInfo>,
): Position {
  const instrument = instruments.get(holding.instrumentId) ?? {
    id: holding.instrumentId,
    ticker: `#${holding.instrumentId}`,
    name: 'Unknown instrument',
  };
  const marketValue = quote === undefined ? null : quote.close.times(holding.quantity);

  return {
    instrument,
    quantity: holding.quantity,
    availableQuantity: holding.availableQuantity,
    averageCost: averageCost(holding),
    lastPrice: quote?.close ?? null,
    marketValue,
    totalReturn: totalReturn(marketValue, holding.costBasis),
    dailyReturn: quote === undefined ? null : dailyReturn(quote),
  };
}

function totalReturn(marketValue: Money | null, costBasis: Money): Money | null {
  if (marketValue === null || costBasis.isZero()) return null;
  return marketValue.dividedBy(costBasis).minus(1);
}
