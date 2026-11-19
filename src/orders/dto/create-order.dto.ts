import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/limits.js';
import { ORDER_TYPES, type OrderType } from '../domain/order.js';
import { MAX_ORDER_SIZE, type TradeSide } from '../domain/order-rules.js';

const MAX_PRICE = 99_999_999.99;
const MAX_AMOUNT = 999_999_999_999.99;
const TRADE_SIDES: readonly TradeSide[] = ['BUY', 'SELL'];
const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  userId!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  instrumentId!: number;

  @IsIn(TRADE_SIDES)
  side!: TradeSide;

  @IsIn(ORDER_TYPES)
  type!: OrderType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_SIZE)
  size?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @IsPositive()
  @Max(MAX_PRICE)
  price?: number;
}
