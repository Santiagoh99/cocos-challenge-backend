export const ORDER_SIDES = ['BUY', 'SELL', 'CASH_IN', 'CASH_OUT'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['MARKET', 'LIMIT'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ['NEW', 'FILLED', 'REJECTED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

function oneOf<T extends string>(allowed: readonly T[], label: string) {
  return (value: string): T => {
    const match = allowed.find((candidate) => candidate === value);
    if (match === undefined) throw new Error(`Unexpected order ${label}: ${value}`);
    return match;
  };
}

export const parseOrderSide = oneOf(ORDER_SIDES, 'side');
export const parseOrderType = oneOf(ORDER_TYPES, 'type');
export const parseOrderStatus = oneOf(ORDER_STATUSES, 'status');
