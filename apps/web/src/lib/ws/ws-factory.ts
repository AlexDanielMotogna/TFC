/**
 * WebSocket Adapter Factory
 *
 * Creates the correct ExchangeWsAdapter based on the active exchange type.
 */

import type { ExchangeType } from '@tfc/shared';
import type { ExchangeWsAdapter } from './types';
import { PacificaWsAdapter } from './pacifica-ws-adapter';
import { HyperliquidWsAdapter } from './hyperliquid-ws-adapter';
import { LighterWsAdapter } from './lighter-ws-adapter';

const adapterInstances: Partial<Record<ExchangeType, ExchangeWsAdapter>> = {};

/**
 * Create or return a cached WS adapter for the given exchange type.
 * Adapters are singletons — only one WS connection per exchange.
 */
export function createWsAdapter(exchangeType: ExchangeType): ExchangeWsAdapter {
  if (!adapterInstances[exchangeType]) {
    switch (exchangeType) {
      case 'pacifica':
        adapterInstances[exchangeType] = new PacificaWsAdapter();
        break;
      case 'hyperliquid':
        adapterInstances[exchangeType] = new HyperliquidWsAdapter();
        break;
      case 'lighter':
        adapterInstances[exchangeType] = new LighterWsAdapter();
        break;
      default:
        throw new Error(`Unknown exchange type: ${exchangeType}`);
    }
  }
  return adapterInstances[exchangeType]!;
}
