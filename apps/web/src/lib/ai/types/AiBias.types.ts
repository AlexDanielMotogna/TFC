/**
 * AI Trading Signal - Type Definitions
 * Central type definitions for the entire AI signal system.
 */

// ─────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export interface OpenPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  unrealizedPnl: string;
  liquidationPrice: string;
}

export interface AiBiasRequest {
  symbol: string;        // e.g. "BTC-USD"
  riskProfile: RiskProfile;
  userId: string;        // For rate limiting and audit
  openPositions?: OpenPosition[];  // User's current open positions
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

export type SignalDirection = 'LONG' | 'SHORT' | 'STAY_OUT';
export type FactorBias = 'bullish' | 'bearish' | 'neutral';

export interface KeyFactor {
  factor: string;        // e.g. "Trend", "Volume", "Funding"
  bias: FactorBias;
  detail: string;        // Human-readable explanation
}

export type PositionAction = 'HOLD' | 'CLOSE' | 'ADD' | 'REDUCE' | 'MOVE_SL';

export interface PositionAdvice {
  symbol: string;
  action: PositionAction;
  detail: string;             // e.g. "Move SL to $97,800 to lock profits"
}

export interface AiSignalResponse {
  signal: SignalDirection;
  confidence: number;           // 0-100 percentage
  entry: number;                // Exact entry price (0 for STAY_OUT)
  stopLoss: number;             // Stop loss price (0 for STAY_OUT)
  takeProfit: number;           // Take profit price (0 for STAY_OUT)
  suggestedLeverage: number;    // 1-10x (0 for STAY_OUT)
  riskPercent: number;          // % of portfolio to risk (0 for STAY_OUT)
  summary: string;              // 2-3 sentence rationale
  riskProfile: RiskProfile;
  keyFactors: KeyFactor[];
  positionAdvice: PositionAdvice[];  // Advice for open positions (empty if none)
  disclaimer: string;
  timestamp: number;            // When analysis was generated
  expiresAt: number;            // When this signal expires
}

// ─────────────────────────────────────────────────────────────
// Market Data Types (exchange-agnostic input to AI)
// ─────────────────────────────────────────────────────────────

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderbookSnapshot {
  bids: [number, number][];  // [price, size] top N
  asks: [number, number][];  // [price, size] top N
  timestamp: number;
}

export interface MarketSnapshot {
  symbol: string;
  currentPrice: number;
  markPrice: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  nextFundingRate: number;
  timestamp: number;
}

export interface MarketDataBundle {
  snapshot: MarketSnapshot;
  candles1h: CandleData[];
  candles4h: CandleData[];
  candles1d: CandleData[];
  orderbook: OrderbookSnapshot;
}

// ─────────────────────────────────────────────────────────────
// Cache Types
// ─────────────────────────────────────────────────────────────

export interface CachedSignal {
  response: AiSignalResponse;
  dataHash: string;          // Hash of market data to detect changes
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

export interface AiServiceError {
  code: 'RATE_LIMITED' | 'AI_UNAVAILABLE' | 'INVALID_RESPONSE' | 'MARKET_DATA_ERROR' | 'VALIDATION_ERROR';
  message: string;
  retryAfter?: number;   // Seconds until retry is allowed
}
