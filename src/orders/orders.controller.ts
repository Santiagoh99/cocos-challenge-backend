import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService, type OrderResponse } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
    return this.orders.createOrder(dto);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponse> {
    return this.orders.cancelOrder(id, dto.userId);
  }
}
