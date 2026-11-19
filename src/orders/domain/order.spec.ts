import { parseOrderSide, parseOrderStatus, parseOrderType } from './order.js';

describe('order value parsers', () => {
  it('accepts known values', () => {
    expect(parseOrderSide('CASH_IN')).toBe('CASH_IN');
    expect(parseOrderType('LIMIT')).toBe('LIMIT');
    expect(parseOrderStatus('FILLED')).toBe('FILLED');
  });

  it('fails loudly on values the domain does not know', () => {
    expect(() => parseOrderSide('buy')).toThrow('Unexpected order side: buy');
    expect(() => parseOrderStatus('PARTIALLY_FILLED')).toThrow();
  });
});
