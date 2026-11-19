import { InvalidRequestError } from '../../common/errors/domain.errors.js';
import { MAX_INT4 } from '../../common/limits.js';
import type { Money } from '../../common/money.js';
import type { OrderStatus, OrderType } from './order.js';

export const MAX_ORDER_SIZE = MAX_INT4;

export type TradeSide = 'BUY' | 'SELL';

export interface OrderRequest {
  side: TradeSide;
  type: OrderType;
  size?: number;
  amount?: Money;
  price?: Money;
}

export interface AccountSnapshot {
  availableCash: Money;
  availableQuantity: number;
}

export type RejectionReason = 'INSUFFICIENT_FUNDS' | 'INSUFFICIENT_SHARES' | 'AMOUNT_BELOW_PRICE';

export interface OrderDecision {
  status: Extract<OrderStatus, 'NEW' | 'FILLED' | 'REJECTED'>;
  size: number;
  price: Money;
  rejectionReason: RejectionReason | null;
}

export function decideOrder(
  request: OrderRequest,
  lastPrice: Money | null,
  account: AccountSnapshot,
): OrderDecision {
  const price = resolvePrice(request, lastPrice);
  const size = resolveSize(request, price);

  const rejectionReason = findRejection(request.side, size, price, account);
  if (rejectionReason !== null) {
    return { status: 'REJECTED', size, price, rejectionReason };
  }

  return {
    status: request.type === 'MARKET' ? 'FILLED' : 'NEW',
    size,
    price,
    rejectionReason: null,
  };
}

function resolvePrice(request: OrderRequest, lastPrice: Money | null): Money {
  if (request.type === 'LIMIT') {
    if (request.price === undefined) {
      throw new InvalidRequestError('PRICE_REQUIRED', 'LIMIT orders require a price');
    }
    return request.price;
  }

  if (request.price !== undefined) {
    throw new InvalidRequestError(
      'PRICE_NOT_ALLOWED',
      'MARKET orders are executed at the last price and do not accept one',
    );
  }
  if (lastPrice === null) {
    throw new InvalidRequestError(
      'NO_MARKET_PRICE',
      'Instrument has no market price, MARKET orders are not possible',
    );
  }
  return lastPrice;
}

function resolveSize(request: OrderRequest, price: Money): number {
  const hasSize = request.size !== undefined;
  const hasAmount = request.amount !== undefined;

  if (hasSize === hasAmount) {
    throw new InvalidRequestError('SIZE_OR_AMOUNT', 'Send either size or amount, not both');
  }

  const size =
    request.size ?? (request.amount === undefined ? 0 : sharesForAmount(request.amount, price));

  if (size > MAX_ORDER_SIZE) {
    throw new InvalidRequestError('SIZE_TOO_LARGE', 'Order size exceeds the allowed maximum');
  }
  return size;
}

export function sharesForAmount(amount: Money, price: Money): number {
  return amount.dividedToIntegerBy(price).toNumber();
}

function findRejection(
  side: TradeSide,
  size: number,
  price: Money,
  account: AccountSnapshot,
): RejectionReason | null {
  if (size === 0) return 'AMOUNT_BELOW_PRICE';
  if (side === 'BUY' && price.times(size).greaterThan(account.availableCash)) {
    return 'INSUFFICIENT_FUNDS';
  }
  if (side === 'SELL' && size > account.availableQuantity) return 'INSUFFICIENT_SHARES';
  return null;
}
