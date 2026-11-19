import { type Money, ZERO } from '../../common/money.js';
import type { OrderSide, OrderStatus } from '../../orders/domain/order.js';

export interface LedgerOrder {
  id: number;
  instrumentId: number;
  side: OrderSide;
  status: OrderStatus;
  size: number;
  price: Money;
  createdAt: Date;
}

export interface CashBalance {
  total: Money;
  reserved: Money;
  available: Money;
}

export interface Holding {
  instrumentId: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  costBasis: Money;
}

export function calculateCash(orders: readonly LedgerOrder[]): CashBalance {
  let total = ZERO;
  let reserved = ZERO;

  for (const order of orders) {
    const amount = order.price.times(order.size);

    if (order.status === 'FILLED') {
      total =
        order.side === 'CASH_IN' || order.side === 'SELL'
          ? total.plus(amount)
          : total.minus(amount);
    } else if (order.status === 'NEW' && order.side === 'BUY') {
      reserved = reserved.plus(amount);
    }
  }

  return { total, reserved, available: total.minus(reserved) };
}

interface RunningPosition {
  quantity: number;
  costBasis: Money;
  reservedQuantity: number;
}

export function calculateHoldings(orders: readonly LedgerOrder[]): Holding[] {
  const positions = new Map<number, RunningPosition>();
  const positionFor = (instrumentId: number): RunningPosition => {
    let position = positions.get(instrumentId);
    if (position === undefined) {
      position = { quantity: 0, costBasis: ZERO, reservedQuantity: 0 };
      positions.set(instrumentId, position);
    }
    return position;
  };

  for (const order of chronological(orders)) {
    if (order.side !== 'BUY' && order.side !== 'SELL') continue;

    if (order.status === 'FILLED') {
      const position = positionFor(order.instrumentId);
      if (order.side === 'BUY') applyBuy(position, order);
      else applySell(position, order);
    } else if (order.status === 'NEW' && order.side === 'SELL') {
      positionFor(order.instrumentId).reservedQuantity += order.size;
    }
  }

  const holdings: Holding[] = [];
  for (const [instrumentId, position] of positions) {
    if (position.quantity === 0) continue;
    holdings.push({
      instrumentId,
      quantity: position.quantity,
      reservedQuantity: position.reservedQuantity,
      availableQuantity: position.quantity - position.reservedQuantity,
      costBasis: position.costBasis,
    });
  }
  return holdings;
}

function applyBuy(position: RunningPosition, order: LedgerOrder): void {
  const amount = order.price.times(order.size);

  if (position.quantity >= 0) {
    position.costBasis = position.costBasis.plus(amount);
  } else {
    const remainingLong = position.quantity + order.size;
    position.costBasis = remainingLong > 0 ? order.price.times(remainingLong) : ZERO;
  }
  position.quantity += order.size;
}

function applySell(position: RunningPosition, order: LedgerOrder): void {
  if (position.quantity > 0) {
    const soldFromLong = Math.min(order.size, position.quantity);
    const averageCost = position.costBasis.dividedBy(position.quantity);
    position.costBasis = position.costBasis.minus(averageCost.times(soldFromLong));
  }
  position.quantity -= order.size;
  if (position.quantity <= 0) position.costBasis = ZERO;
}

function chronological(orders: readonly LedgerOrder[]): LedgerOrder[] {
  return [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
}

export function averageCost(holding: Holding): Money | null {
  if (holding.quantity <= 0) return null;
  return holding.costBasis.dividedBy(holding.quantity);
}
