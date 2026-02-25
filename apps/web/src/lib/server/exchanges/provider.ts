/**
 * Exchange Provider - Factory pattern for adapter instantiation
 * Creates appropriate adapter for exchange type with automatic caching
 */

import { ExchangeAdapter } from './adapter';
import { PacificaAdapter } from './pacifica-adapter';
import { HyperliquidAdapter } from './hyperliquid-adapter';
import { NadoAdapter } from './nado-adapter';
import { CachedExchangeAdapter } from './cached-adapter';

/**
 * Exchange provider - creates appropriate adapter for exchange type
 */
export class ExchangeProvider {
  private static adapters: Map<string, ExchangeAdapter> = new Map();

  /**
   * Get exchange adapter (cached singleton per exchange)
   */
  static getAdapter(
    exchangeName: 'pacifica' | 'hyperliquid' | 'lighter' | 'nado'
  ): ExchangeAdapter {
    if (this.adapters.has(exchangeName)) {
      return this.adapters.get(exchangeName)!;
    }

    let adapter: ExchangeAdapter;

    switch (exchangeName) {
      case 'pacifica':
        adapter = new PacificaAdapter(process.env.PACIFICA_BUILDER_CODE || 'TradeClub');
        break;

      case 'hyperliquid':
        adapter = new HyperliquidAdapter();
        break;

      case 'lighter':
        throw new Error('Lighter adapter not implemented yet');

      case 'nado':
        adapter = new NadoAdapter();
        break;

      default:
        throw new Error(`Unknown exchange: ${exchangeName}`);
    }

    // Wrap with caching layer if Redis is configured
    if (process.env.REDIS_URL) {
      adapter = new CachedExchangeAdapter(adapter, process.env.REDIS_URL);
    }

    this.adapters.set(exchangeName, adapter);
    return adapter;
  }

  /**
   * Get user's exchange adapter based on exchange type or their active connection.
   * If exchangeType is provided, use that directly. Otherwise query DB.
   */
  static async getUserAdapter(userId: string, exchangeType?: string): Promise<ExchangeAdapter> {
    if (exchangeType) {
      return this.getAdapter(exchangeType as 'pacifica' | 'hyperliquid' | 'lighter' | 'nado');
    }

    // Query database for user's active exchange connection
    const { prisma } = await import('../db');
    const connection = await prisma.exchangeConnection.findFirst({
      where: { userId, isActive: true },
      select: { exchangeType: true },
    });

    return this.getAdapter(
      (connection?.exchangeType || 'pacifica') as 'pacifica' | 'hyperliquid' | 'lighter' | 'nado'
    );
  }

  /**
   * Clear cached adapters (useful for testing)
   */
  static clearCache(): void {
    this.adapters.clear();
  }
}
