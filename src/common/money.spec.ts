import { formatMoney, formatPercent, money, sum } from './money.js';

describe('money', () => {
  it('avoids floating point errors', () => {
    expect(formatMoney(money('0.1').plus('0.2'))).toBe('0.30');
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('parses NUMERIC values that pg returns as strings', () => {
    expect(formatMoney(money('1047.17').times(3))).toBe('3141.51');
  });

  it('rounds half up to two decimals', () => {
    expect(formatMoney(money('10.005'))).toBe('10.01');
    expect(formatMoney(money('10.004'))).toBe('10.00');
  });

  it('formats ratios as percentages', () => {
    expect(formatPercent(money('0.123456'))).toBe('12.35');
    expect(formatPercent(money('-0.05'))).toBe('-5.00');
  });

  it('sums a list and returns zero for an empty one', () => {
    expect(formatMoney(sum([money('1000000'), money('-46500'), money('9400')]))).toBe('962900.00');
    expect(formatMoney(sum([]))).toBe('0.00');
  });
});
