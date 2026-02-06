/**
 * Exchange Provider - Factory pattern for adapter instantiation
 * Creates appropriate adapter for exchange type with automatic caching
 */

import { ExchangeAdapter } from './adapter';
import { PacificaAdapter } from './pacifica-adapter';
import { CachedExchangeAdapter } from './cached-adapter';

/**
 * Exchange provider - creates appropriate adapter for exchange type
 */
export class ExchangeProvider {
  private static adapters: Map<string, ExchangeAdapter> = new Map();

  /**
   * Get exchange adapter (cached singleton per exchange)
   */
  static getAdapter(exchangeName: 'pacifica' | 'hyperliquid' | 'binance'): ExchangeAdapter {
    if (this.adapters.has(exchangeName)) {
      return this.adapters.get(exchangeName)!;
    }

    let adapter: ExchangeAdapter;

    switch (exchangeName) {
      case 'pacifica':
        adapter = new PacificaAdapter(process.env.PACIFICA_BUILDER_CODE || 'TradeClub');
        break;

      case 'hyperliquid':
        throw new Error('Hyperliquid adapter not implemented yet');

      case 'binance':
        throw new Error('Binance adapter not implemented yet');

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
   * Get user's exchange adapter based on their connection
   * TODO: Query database to find user's exchange connection
   * For now, assume Pacifica
   */
  static async getUserAdapter(userId: string): Promise<ExchangeAdapter> {
    // TODO: Query database for user's ExchangeConnection
    // const connection = await prisma.exchangeConnection.findFirst({
    //   where: { userId, isPrimary: true },
    //   select: { exchangeType: true },
    // });
    //
    // return this.getAdapter(connection.exchangeType as 'pacifica' | 'hyperliquid' | 'binance');

    // For now, default to Pacifica
    return this.getAdapter('pacifica');
  }

  /**
   * Clear cached adapters (useful for testing)
   */
  static clearCache(): void {
    this.adapters.clear();
  }
}
