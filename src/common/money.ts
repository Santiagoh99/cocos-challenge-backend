import Decimal from 'decimal.js';

export const Money = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type Money = Decimal;

const MONEY_DECIMALS = 2;
const PERCENT_DECIMALS = 2;

export function money(value: Decimal.Value): Money {
  return new Money(value);
}

export const ZERO: Money = money(0);

export function formatMoney(value: Money): string {
  return value.toFixed(MONEY_DECIMALS);
}

export function formatPercent(ratio: Money): string {
  return ratio.times(100).toFixed(PERCENT_DECIMALS);
}

export function sum(values: readonly Money[]): Money {
  return values.reduce<Money>((total, value) => total.plus(value), ZERO);
}
