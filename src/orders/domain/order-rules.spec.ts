import { InvalidRequestError } from '../../common/errors/domain.errors.js';
import { formatMoney, money, type Money } from '../../common/money.js';
import {
  type AccountSnapshot,
  decideOrder,
  MAX_ORDER_SIZE,
  type OrderDecision,
  type OrderRequest,
  sharesForAmount,
} from './order-rules.js';

const LAST_PRICE = money('925.85');
const userOne: AccountSnapshot = { availableCash: money('627500'), availableQuantity: 40 };

function decide(
  request: OrderRequest,
  account: AccountSnapshot = userOne,
  lastPrice: Money | null = LAST_PRICE,
): OrderDecision {
  return decideOrder(request, lastPrice, account);
}

function expectInvalid(
  request: OrderRequest,
  code: string,
  lastPrice: Money | null = LAST_PRICE,
): void {
  let thrown: unknown;
  try {
    decideOrder(request, lastPrice, userOne);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(InvalidRequestError);
  expect(thrown).toMatchObject({ code });
}

describe('decideOrder', () => {
  describe('MARKET', () => {
    it('fills a buy at the last price', () => {
      const decision = decide({ side: 'BUY', type: 'MARKET', size: 10 });

      expect(decision).toMatchObject({ status: 'FILLED', size: 10, rejectionReason: null });
      expect(formatMoney(decision.price)).toBe('925.85');
    });

    it('fills a sell of shares the user has', () => {
      expect(decide({ side: 'SELL', type: 'MARKET', size: 40 }).status).toBe('FILLED');
    });

    it('requires a market price', () => {
      expectInvalid({ side: 'BUY', type: 'MARKET', size: 1 }, 'NO_MARKET_PRICE', null);
    });

    it('does not accept a price', () => {
      expectInvalid(
        { side: 'BUY', type: 'MARKET', size: 1, price: money(900) },
        'PRICE_NOT_ALLOWED',
      );
    });
  });

  describe('LIMIT', () => {
    it('stays NEW at the requested price', () => {
      const decision = decide({ side: 'BUY', type: 'LIMIT', size: 10, price: money('900.50') });

      expect(decision.status).toBe('NEW');
      expect(formatMoney(decision.price)).toBe('900.50');
    });

    it('requires a price', () => {
      expectInvalid({ side: 'BUY', type: 'LIMIT', size: 1 }, 'PRICE_REQUIRED');
    });

    it('works on instruments without market data', () => {
      const decision = decide(
        { side: 'BUY', type: 'LIMIT', size: 1, price: money(10) },
        userOne,
        null,
      );
      expect(decision.status).toBe('NEW');
    });

    it('checks funds against the limit price, not the market', () => {
      const account = { availableCash: money(1000), availableQuantity: 0 };
      const decision = decide({ side: 'BUY', type: 'LIMIT', size: 10, price: money(100) }, account);
      expect(decision.status).toBe('NEW');
    });
  });

  describe('size and amount', () => {
    it('requires exactly one of them', () => {
      expectInvalid({ side: 'BUY', type: 'MARKET' }, 'SIZE_OR_AMOUNT');
      expectInvalid(
        { side: 'BUY', type: 'MARKET', size: 1, amount: money(1000) },
        'SIZE_OR_AMOUNT',
      );
    });

    it('buys the maximum whole number of shares for an amount', () => {
      const decision = decide({ side: 'BUY', type: 'MARKET', amount: money(10000) });

      expect(decision.size).toBe(10);
      expect(decision.status).toBe('FILLED');
    });

    it('uses the limit price to size an amount', () => {
      const decision = decide({
        side: 'BUY',
        type: 'LIMIT',
        amount: money(1000),
        price: money(300),
      });
      expect(decision.size).toBe(3);
    });

    it('rejects when the amount does not reach one share', () => {
      expect(decide({ side: 'BUY', type: 'MARKET', amount: money(925) })).toMatchObject({
        status: 'REJECTED',
        size: 0,
        rejectionReason: 'AMOUNT_BELOW_PRICE',
      });
    });

    it('refuses sizes the orders table cannot store', () => {
      const account = { availableCash: money('1e20'), availableQuantity: 0 };
      expect(() =>
        decideOrder({ side: 'BUY', type: 'MARKET', amount: money('1e15') }, money('0.01'), account),
      ).toThrow(InvalidRequestError);
      expect(MAX_ORDER_SIZE).toBe(2147483647);
    });
  });

  describe('rejections', () => {
    it('rejects a buy above the available cash', () => {
      expect(decide({ side: 'BUY', type: 'MARKET', size: 1000 })).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      });
    });

    it('allows a buy for exactly the available cash', () => {
      const account = { availableCash: money('9258.50'), availableQuantity: 0 };
      expect(decide({ side: 'BUY', type: 'MARKET', size: 10 }, account).status).toBe('FILLED');
    });

    it('rejects selling more shares than available', () => {
      expect(decide({ side: 'SELL', type: 'MARKET', size: 41 })).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_SHARES',
      });
    });

    it('rejects selling from a negative position', () => {
      const account = { availableCash: money(0), availableQuantity: -10 };
      expect(decide({ side: 'SELL', type: 'MARKET', size: 1 }, account).rejectionReason).toBe(
        'INSUFFICIENT_SHARES',
      );
    });

    it('does not check cash on a sell', () => {
      const account = { availableCash: money(0), availableQuantity: 5 };
      expect(
        decide({ side: 'SELL', type: 'LIMIT', size: 5, price: money(1) }, account).status,
      ).toBe('NEW');
    });
  });
});

describe('sharesForAmount', () => {
  it.each([
    ['10000', '925.85', 10],
    ['925.85', '925.85', 1],
    ['925.84', '925.85', 0],
    ['0.30', '0.10', 3],
  ])('%s / %s = %i shares', (amount, price, expected) => {
    expect(sharesForAmount(money(amount), money(price))).toBe(expected);
  });
});
