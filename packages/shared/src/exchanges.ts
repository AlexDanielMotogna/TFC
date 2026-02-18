/**
 * Exchange Configuration & Types
 * Shared across all apps (web, realtime, etc.)
 */

// ─────────────────────────────────────────────────────────────
// Exchange Types
// ─────────────────────────────────────────────────────────────

export type ExchangeType = 'pacifica' | 'hyperliquid' | 'lighter';

export type WalletType = 'solana' | 'ethereum';
export type SigningScheme = 'ed25519' | 'ecdsa' | 'zk';

// ─────────────────────────────────────────────────────────────
// Exchange Configuration
// ─────────────────────────────────────────────────────────────

export interface ExchangeConfig {
  type: ExchangeType;
  name: string;
  chain: string;
  walletType: WalletType;
  depositUrl: string;
  wsUrl: string;
  apiUrl: string;
  minOrderValue: number;
  signingScheme: SigningScheme;
  supportedOrderTypes: string[];
  supportedTif: string[];
  maxBatchSize: number;
  hasBuilderCode: boolean;
  hasMarginMode: boolean;
}

// ─────────────────────────────────────────────────────────────
// Exchange Configurations
// ─────────────────────────────────────────────────────────────

export const EXCHANGE_CONFIGS: Record<ExchangeType, ExchangeConfig> = {
  pacifica: {
    type: 'pacifica',
    name: 'Pacifica',
    chain: 'solana',
    walletType: 'solana',
    depositUrl: 'https://app.pacifica.fi?referral=TFC',
    wsUrl: 'wss://ws.pacifica.fi/ws',
    apiUrl: 'https://api.pacifica.fi',
    minOrderValue: 11,
    signingScheme: 'ed25519',
    supportedOrderTypes: ['market', 'limit', 'stop-market', 'stop-limit'],
    supportedTif: ['GTC', 'IOC', 'ALO', 'TOB'],
    maxBatchSize: 10,
    hasBuilderCode: true,
    hasMarginMode: true,
  },
  hyperliquid: {
    type: 'hyperliquid',
    name: 'Hyperliquid',
    chain: 'hyperliquid-l1',
    walletType: 'ethereum',
    depositUrl: 'https://app.hyperliquid.xyz/trade',
    wsUrl: 'wss://api.hyperliquid.xyz/ws',
    apiUrl: 'https://api.hyperliquid.xyz',
    minOrderValue: 10,
    signingScheme: 'ecdsa',
    supportedOrderTypes: ['market', 'limit', 'stop-market', 'stop-limit'],
    supportedTif: ['GTC', 'IOC', 'ALO'],
    maxBatchSize: 20,
    hasBuilderCode: true,
    hasMarginMode: false,
  },
  lighter: {
    type: 'lighter',
    name: 'Lighter',
    chain: 'ethereum-l2',
    walletType: 'ethereum',
    depositUrl: 'https://app.lighter.xyz',
    wsUrl: 'wss://mainnet.zklighter.elliot.ai/ws',
    apiUrl: 'https://mainnet.zklighter.elliot.ai',
    minOrderValue: 0, // per-market, fetched dynamically
    signingScheme: 'zk',
    supportedOrderTypes: ['market', 'limit', 'stop-market', 'stop-limit'],
    supportedTif: ['GTC', 'IOC', 'POST_ONLY'],
    maxBatchSize: 10,
    hasBuilderCode: false,
    hasMarginMode: false,
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getExchangeConfig(type: ExchangeType): ExchangeConfig {
  return EXCHANGE_CONFIGS[type];
}

export function isValidExchangeType(value: string): value is ExchangeType {
  return value === 'pacifica' || value === 'hyperliquid' || value === 'lighter';
}

export const DEFAULT_EXCHANGE: ExchangeType = 'pacifica';
