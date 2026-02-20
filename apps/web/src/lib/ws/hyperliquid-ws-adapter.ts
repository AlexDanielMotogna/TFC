/**
 * Hyperliquid WebSocket Adapter (Stub)
 *
 * TODO (Phase 8):
 * - Connect to wss://api.hyperliquid.xyz/ws
 * - Subscribe: {"method": "subscribe", "subscription": {"type": "allMids"}} for prices
 * - Private: {"type": "userEvents", "user": "0x..."} for positions/orders
 * - No auth token needed — just user address
 * - Symbol mapping: asset index → BTC-USD
 */

import type { ExchangeWsAdapter, ExchangeWsCallbacks } from './types';

export class HyperliquidWsAdapter implements ExchangeWsAdapter {
  readonly exchangeType = 'hyperliquid' as const;

  connect(_callbacks: ExchangeWsCallbacks): void {
    console.warn('[HyperliquidWsAdapter] Not implemented (Phase 8)');
  }

  disconnect(): void {}
  isConnected(): boolean { return false; }
  subscribeAccount(_accountId: string): void {}
  unsubscribeAccount(): void {}
  subscribePrices(): void {}
  refresh(): void {}
}
