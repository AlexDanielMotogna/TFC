import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { prisma } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, ORDER_REJECTION, MIN_LEVERAGE } from '@tfc/shared';
import { PacificaService } from '../../pacifica/pacifica.service.js';
import { PacificaSigningService } from '../../pacifica/pacifica-signing.service.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger({ service: 'api' });

interface PlaceOrderParams {
  userId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  size: string;
  leverage: number;
  price?: string;
  reduceOnly?: boolean;
  slippagePercent?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly pacifica: PacificaService,
    private readonly signing: PacificaSigningService
  ) {}

  private async getUserKeypair(userId: string): Promise<import('tweetnacl').SignKeyPair> {
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId },
      select: { accountAddress: true, vaultKeyReference: true, isActive: true },
    });

    if (!connection || !connection.isActive) {
      throw new HttpException(ORDER_REJECTION.NO_PACIFICA_CONNECTION, HttpStatus.UNAUTHORIZED);
    }

    // TODO: In production, fetch the actual private key from vault using vaultKeyReference
    // For now, throw an error indicating this needs to be implemented
    // The return type is specified to help TypeScript understand this function's contract
    throw new HttpException(
      'Vault integration not implemented. Cannot retrieve signing key.',
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  async placeOrder(params: PlaceOrderParams) {
    const clientOrderId = uuidv4();

    logger.info(LOG_EVENTS.ORDER_PLACE_REQUEST, 'Placing order', {
      userId: params.userId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      size: params.size,
      leverage: params.leverage,
    });

    // Validate leverage
    const markets = await this.pacifica.getMarkets();
    const market = markets.find((m) => m.symbol === params.symbol);

    if (!market) {
      logger.warn(LOG_EVENTS.ORDER_PLACE_REJECTED, 'Invalid symbol', {
        userId: params.userId,
        reasonCode: ORDER_REJECTION.INVALID_SYMBOL,
        symbol: params.symbol,
      });
      throw new HttpException(ORDER_REJECTION.INVALID_SYMBOL, HttpStatus.BAD_REQUEST);
    }

    if (params.leverage < MIN_LEVERAGE || params.leverage > market.max_leverage) {
      logger.warn(LOG_EVENTS.ORDER_PLACE_REJECTED, 'Invalid leverage', {
        userId: params.userId,
        reasonCode: ORDER_REJECTION.INVALID_LEVERAGE,
        leverage: params.leverage,
        maxLeverage: market.max_leverage,
      });
      throw new HttpException(ORDER_REJECTION.INVALID_LEVERAGE, HttpStatus.BAD_REQUEST);
    }

    // Get keypair (this will throw until vault is implemented)
    const keypair = await this.getUserKeypair(params.userId);

    // Convert side
    const pacificaSide = params.side === 'LONG' ? 'bid' : 'ask';

    try {
      let result;

      if (params.type === 'MARKET') {
        result = await this.pacifica.createMarketOrder(keypair, {
          symbol: params.symbol,
          amount: params.size,
          side: pacificaSide,
          slippagePercent: params.slippagePercent || '0.5',
          reduceOnly: params.reduceOnly || false,
          clientOrderId,
        });
      } else {
        if (!params.price) {
          throw new HttpException('Price required for limit orders', HttpStatus.BAD_REQUEST);
        }

        result = await this.pacifica.createLimitOrder(keypair, {
          symbol: params.symbol,
          price: params.price,
          amount: params.size,
          side: pacificaSide,
          tif: 'GTC',
          reduceOnly: params.reduceOnly || false,
          clientOrderId,
        });
      }

      logger.info(LOG_EVENTS.ORDER_PLACE_ACCEPTED, 'Order placed successfully', {
        userId: params.userId,
        symbol: params.symbol,
        pacificaOrderId: result.order_id,
        clientOrderId,
      });

      return {
        orderId: result.order_id,
        clientOrderId,
      };
    } catch (error) {
      logger.warn(LOG_EVENTS.ORDER_PLACE_REJECTED, 'Order rejected by Pacifica', {
        userId: params.userId,
        reasonCode: ORDER_REJECTION.PACIFICA_ERROR,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async cancelOrder(userId: string, orderId: number, symbol: string) {
    logger.info(LOG_EVENTS.ORDER_CANCEL_REQUEST, 'Cancelling order', {
      userId,
      orderId,
      symbol,
    });

    const keypair = await this.getUserKeypair(userId);

    try {
      await this.pacifica.cancelOrder(keypair, { symbol, orderId });

      logger.info(LOG_EVENTS.ORDER_CANCEL_SUCCESS, 'Order cancelled', {
        userId,
        orderId,
      });

      return { success: true };
    } catch (error) {
      logger.warn(LOG_EVENTS.ORDER_CANCEL_FAILURE, 'Failed to cancel order', {
        userId,
        orderId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async cancelAllOrders(userId: string, symbol?: string) {
    logger.info(LOG_EVENTS.ORDER_CANCEL_REQUEST, 'Cancelling all orders', {
      userId,
      symbol: symbol || 'ALL',
    });

    const keypair = await this.getUserKeypair(userId);

    try {
      const result = await this.pacifica.cancelAllOrders(keypair, {
        allSymbols: !symbol,
        excludeReduceOnly: false,
        symbol,
      });

      logger.info(LOG_EVENTS.ORDER_CANCEL_SUCCESS, 'All orders cancelled', {
        userId,
        cancelledCount: result.cancelled_count,
      });

      return result;
    } catch (error) {
      logger.warn(LOG_EVENTS.ORDER_CANCEL_FAILURE, 'Failed to cancel orders', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
