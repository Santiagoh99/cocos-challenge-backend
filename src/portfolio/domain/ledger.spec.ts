import { formatMoney, money } from '../../common/money.js';
import type { OrderSide, OrderStatus } from '../../orders/domain/order.js';
import {
  averageCost,
  calculateCash,
  calculateHoldings,
  type Holding,
  type LedgerOrder,
} from './ledger.js';
import { userOneOrders } from './user-one.fixture.js';

let nextId = 1;
function order(
  side: OrderSide,
  size: number,
  price: number | string,
  status: OrderStatus = 'FILLED',
  instrumentId = 1,
): LedgerOrder {
  const id = nextId++;
  return {
    id,
    instrumentId,
    side,
    status,
    size,
    price: money(price),
    createdAt: new Date(Date.UTC(2023, 6, 12, 10, id)),
  };
}

function onlyHolding(orders: LedgerOrder[]): Holding {
  const [holding, ...rest] = calculateHoldings(orders);
  if (holding === undefined || rest.length > 0) throw new Error('Expected exactly one holding');
  return holding;
}

describe('calculateCash', () => {
  it('matches the hand-calculated balance for user 1', () => {
    const cash = calculateCash(userOneOrders);

    expect(formatMoney(cash.total)).toBe('753000.00');
    expect(formatMoney(cash.reserved)).toBe('125500.00');
    expect(formatMoney(cash.available)).toBe('627500.00');
  });

  it('is zero for a user without orders', () => {
    const cash = calculateCash([]);

    expect(formatMoney(cash.total)).toBe('0.00');
    expect(formatMoney(cash.available)).toBe('0.00');
  });

  it('ignores rejected and cancelled orders', () => {
    const cash = calculateCash([
      order('CASH_IN', 1000, 1),
      order('BUY', 5, 100, 'REJECTED'),
      order('BUY', 5, 100, 'CANCELLED'),
    ]);

    expect(formatMoney(cash.total)).toBe('1000.00');
    expect(formatMoney(cash.reserved)).toBe('0.00');
  });

  it('does not reserve cash for pending sells', () => {
    const cash = calculateCash([order('CASH_IN', 1000, 1), order('SELL', 5, 100, 'NEW')]);

    expect(formatMoney(cash.reserved)).toBe('0.00');
  });
});

describe('calculateHoldings', () => {
  it('derives user 1 positions from filled orders only', () => {
    const holdings = calculateHoldings(userOneOrders);
    const quantities = Object.fromEntries(holdings.map((h) => [h.instrumentId, h.quantity]));

    expect(quantities).toEqual({ 31: -10, 47: 40, 54: 500 });
  });

  it('does not create positions for cash movements', () => {
    const holdings = calculateHoldings(userOneOrders);

    expect(holdings.some((h) => h.instrumentId === 66)).toBe(false);
  });

  it('keeps the weighted average cost after a partial sell', () => {
    const holding = onlyHolding([
      order('BUY', 10, 100),
      order('BUY', 10, 200),
      order('SELL', 5, 999),
    ]);

    expect(holding.quantity).toBe(15);
    expect(formatMoney(holding.costBasis)).toBe('2250.00');
    expect(averageCost(holding)?.toFixed(2)).toBe('150.00');
  });

  it('drops positions that were fully sold', () => {
    expect(calculateHoldings([order('BUY', 10, 100), order('SELL', 10, 120)])).toEqual([]);
  });

  it('keeps an oversold position with zero cost basis', () => {
    const holding = onlyHolding([order('BUY', 20, 1540), order('SELL', 30, 1530)]);

    expect(holding.quantity).toBe(-10);
    expect(holding.costBasis.isZero()).toBe(true);
    expect(averageCost(holding)).toBeNull();
  });

  it('starts a fresh cost basis when buying back from a negative position', () => {
    const holding = onlyHolding([
      order('BUY', 10, 100),
      order('SELL', 15, 100),
      order('BUY', 20, 300),
    ]);

    expect(holding.quantity).toBe(15);
    expect(formatMoney(holding.costBasis)).toBe('4500.00');
  });

  it('applies orders chronologically regardless of input order', () => {
    const buy = order('BUY', 10, 100);
    const sell = order('SELL', 4, 150);
    const holding = onlyHolding([sell, buy]);

    expect(holding.quantity).toBe(6);
    expect(formatMoney(holding.costBasis)).toBe('600.00');
  });

  it('reserves shares for pending sells', () => {
    const holding = onlyHolding([order('BUY', 10, 100), order('SELL', 4, 120, 'NEW')]);

    expect(holding.reservedQuantity).toBe(4);
    expect(holding.availableQuantity).toBe(6);
  });
});
