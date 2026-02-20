/**
 * Lighter WebSocket Adapter (Stub)
 *
 * TODO (Phase 9):
 * - Connect to wss://mainnet.zklighter.elliot.ai/ws
 * - Auth token required for private channels: ?auth={expiry}:{account}:{key_index}:{hex}
 * - Token generated server-side: create_auth_token_with_expiry() (max 8h)
 * - Public channels (prices, orderbook) need no auth
 * - Private channels (positions, orders, fills) need auth token
 * - Symbol mapping: market ID → BTC-USD
 */

import type { ExchangeWsAdapter, ExchangeWsCallbacks } from './types';

export class LighterWsAdapter implements ExchangeWsAdapter {
  readonly exchangeType = 'lighter' as const;

  connect(_callbacks: ExchangeWsCallbacks): void {
    console.warn('[LighterWsAdapter] Not implemented (Phase 9)');
  }

  disconnect(): void {}
  isConnected(): boolean { return false; }
  subscribeAccount(_accountId: string): void {}
  unsubscribeAccount(): void {}
  subscribePrices(): void {}
  refresh(): void {}
}
