import { Injectable } from '@nestjs/common';
import { InvalidRequestError, NotFoundError } from '../common/errors/domain.errors.js';
import { formatMoney, money, type Money } from '../common/money.js';
import { DbService } from '../db/db.service.js';
import { calculateCash, calculateHoldings } from '../portfolio/domain/ledger.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import { decideOrder, type OrderRequest, type RejectionReason } from './domain/order-rules.js';
import { OrdersRepository, type OrderRow } from './orders.repository.js';

const CURRENCY_TYPE = 'MONEDA';

export interface OrderResponse {
  id: number;
  userId: number;
  instrumentId: number;
  side: string;
  type: string;
  status: string;
  size: number;
  price: string;
  createdAt: string;
  rejectionReason: RejectionReason | null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbService,
    private readonly repository: OrdersRepository,
  ) {}

  createOrder(dto: CreateOrderDto): Promise<OrderResponse> {
    return this.db.transaction(async (tx) => {
      if (!(await this.repository.lockUser(tx, dto.userId))) {
        throw new NotFoundError('User', dto.userId);
      }

      const instrument = await this.repository.findInstrument(tx, dto.instrumentId);
      if (instrument === null) throw new NotFoundError('Instrument', dto.instrumentId);
      if (instrument.type === CURRENCY_TYPE) {
        throw new InvalidRequestError(
          'INSTRUMENT_NOT_TRADABLE',
          'Currency instruments cannot be bought or sold',
        );
      }

      const lastClose = await this.repository.findLastClose(tx, dto.instrumentId);
      const ledger = await this.repository.findLedgerOrders(tx, dto.userId);
      const cash = calculateCash(ledger);
      const holding = calculateHoldings(ledger).find((h) => h.instrumentId === dto.instrumentId);

      const decision = decideOrder(
        toOrderRequest(dto),
        lastClose === null ? null : money(lastClose),
        {
          availableCash: cash.available,
          availableQuantity: holding?.availableQuantity ?? 0,
        },
      );

      const saved = await this.repository.insert(tx, {
        userId: dto.userId,
        instrumentId: dto.instrumentId,
        side: dto.side,
        type: dto.type,
        status: decision.status,
        size: decision.size,
        price: formatMoney(decision.price),
      });

      return toResponse(saved, decision.rejectionReason);
    });
  }
}

function toOrderRequest(dto: CreateOrderDto): OrderRequest {
  const request: OrderRequest = { side: dto.side, type: dto.type };
  if (dto.size !== undefined) request.size = dto.size;
  if (dto.amount !== undefined) request.amount = toMoney(dto.amount);
  if (dto.price !== undefined) request.price = toMoney(dto.price);
  return request;
}

function toMoney(value: number): Money {
  return money(String(value));
}

function toResponse(row: OrderRow, rejectionReason: RejectionReason | null): OrderResponse {
  return {
    id: row.id,
    userId: row.userid,
    instrumentId: row.instrumentid,
    side: row.side,
    type: row.type,
    status: row.status,
    size: row.size,
    price: row.price,
    createdAt: row.created_at,
    rejectionReason,
  };
}
