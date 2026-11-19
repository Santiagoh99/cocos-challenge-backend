import { formatMoney, formatPercent, money, type Money } from '../../common/money.js';
import { buildPortfolio } from './portfolio.js';
import { userOneInstruments, userOneOrders, userOneQuotes } from './user-one.fixture.js';

const pct = (value: Money | null): string | null => (value === null ? null : formatPercent(value));
const amount = (value: Money | null): string | null => (value === null ? null : formatMoney(value));

describe('buildPortfolio', () => {
  const portfolio = buildPortfolio({
    orders: userOneOrders,
    quotes: userOneQuotes,
    instruments: userOneInstruments,
  });

  it('values the account as total cash plus positions at close', () => {
    expect(formatMoney(portfolio.totalValue)).toBe('889756.00');
    expect(formatMoney(portfolio.cash.total)).toBe('753000.00');
    expect(formatMoney(portfolio.cash.available)).toBe('627500.00');
  });

  it('lists user 1 positions with value and returns', () => {
    const summary = portfolio.positions.map((p) => ({
      ticker: p.instrument.ticker,
      quantity: p.quantity,
      averageCost: amount(p.averageCost),
      marketValue: amount(p.marketValue),
      totalReturn: pct(p.totalReturn),
      dailyReturn: pct(p.dailyReturn),
    }));

    expect(summary).toEqual([
      {
        ticker: 'BMA',
        quantity: -10,
        averageCost: null,
        marketValue: '-15028.00',
        totalReturn: null,
        dailyReturn: '-1.15',
      },
      {
        ticker: 'METR',
        quantity: 500,
        averageCost: '250.00',
        marketValue: '114750.00',
        totalReturn: '-8.20',
        dailyReturn: '-1.08',
      },
      {
        ticker: 'PAMP',
        quantity: 40,
        averageCost: '930.00',
        marketValue: '37034.00',
        totalReturn: '-0.45',
        dailyReturn: '0.44',
      },
    ]);
  });

  it('returns an empty portfolio for a user without orders', () => {
    const empty = buildPortfolio({ orders: [], quotes: new Map(), instruments: new Map() });

    expect(formatMoney(empty.totalValue)).toBe('0.00');
    expect(empty.positions).toEqual([]);
  });

  it('keeps unpriced positions out of the total value', () => {
    const unpriced = buildPortfolio({
      orders: [
        {
          id: 1,
          instrumentId: 66,
          side: 'CASH_IN',
          status: 'FILLED',
          size: 1000,
          price: money(1),
          createdAt: new Date(1),
        },
        {
          id: 2,
          instrumentId: 3,
          side: 'BUY',
          status: 'FILLED',
          size: 2,
          price: money(100),
          createdAt: new Date(2),
        },
      ],
      quotes: new Map(),
      instruments: new Map([[3, { id: 3, ticker: 'PGR', name: 'Phoenix Global Resources' }]]),
    });

    expect(formatMoney(unpriced.totalValue)).toBe('800.00');
    expect(unpriced.positions[0]).toMatchObject({
      quantity: 2,
      marketValue: null,
      totalReturn: null,
    });
  });
});
