import type { Money } from './money.js';

export interface Quote {
  close: Money;
  previousClose: Money;
}

export function dailyReturn(quote: Quote): Money | null {
  if (quote.previousClose.isZero()) return null;
  return quote.close.dividedBy(quote.previousClose).minus(1);
}
