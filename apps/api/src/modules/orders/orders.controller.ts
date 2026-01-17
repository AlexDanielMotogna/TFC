import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';

class PlaceOrderDto {
  symbol!: string;
  side!: 'LONG' | 'SHORT';
  type!: 'MARKET' | 'LIMIT';
  size!: string;
  leverage!: number;
  price?: string;
  reduceOnly?: boolean;
  slippagePercent?: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return userId;
  }

  @Post()
  async placeOrder(
    @Headers() headers: Record<string, string>,
    @Body() dto: PlaceOrderDto
  ) {
    const userId = this.getUserId(headers);
    const result = await this.ordersService.placeOrder({
      userId,
      ...dto,
    });
    return { success: true, data: result };
  }

  @Delete(':orderId')
  async cancelOrder(
    @Headers() headers: Record<string, string>,
    @Param('orderId') orderId: string,
    @Query('symbol') symbol: string
  ) {
    const userId = this.getUserId(headers);
    const result = await this.ordersService.cancelOrder(
      userId,
      parseInt(orderId, 10),
      symbol
    );
    return { success: true, data: result };
  }

  @Delete()
  async cancelAllOrders(
    @Headers() headers: Record<string, string>,
    @Query('symbol') symbol?: string
  ) {
    const userId = this.getUserId(headers);
    const result = await this.ordersService.cancelAllOrders(userId, symbol);
    return { success: true, data: result };
  }
}
