export const ORDER_SIDES = ['BUY', 'SELL', 'CASH_IN', 'CASH_OUT'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['MARKET', 'LIMIT'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ['NEW', 'FILLED', 'REJECTED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
