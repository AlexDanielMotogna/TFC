/**
 * Shared types for Trading Fight Club
 */

import type {
  FightDuration,
  FightStake,
  FightStatus,
  ParticipantSlot,
  OrderSide,
  OrderType,
  LeaderboardRange,
} from '../constants/index.js';

// ─────────────────────────────────────────────────────────────
// User Types
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  handle: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  stats: {
    totalFights: number;
    wins: number;
    losses: number;
    draws: number;
    totalPnlUsdc: number;
    avgPnlPercent: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Fight Types
// ─────────────────────────────────────────────────────────────

export interface Fight {
  id: string;
  creatorId: string;
  durationMinutes: FightDuration;
  stakeUsdc: FightStake;
  status: FightStatus;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  winnerId: string | null;
  isDraw: boolean;
}

export interface FightParticipant {
  id: string;
  fightId: string;
  userId: string;
  slot: ParticipantSlot;
  joinedAt: Date;
  finalPnlPercent: number | null;
  finalScoreUsdc: number | null;
  tradesCount: number;
}

export interface FightWithParticipants extends Fight {
  creator: User;
  participants: (FightParticipant & { user: User })[];
}

export interface FightListItem {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorAvatarUrl: string | null;
  durationMinutes: FightDuration;
  stakeUsdc: FightStake;
  status: FightStatus;
  createdAt: string;
  participantCount: number;
}

// ─────────────────────────────────────────────────────────────
// Order Types
// ─────────────────────────────────────────────────────────────

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  size: string;
  sizeUnit: 'USD' | 'TOKEN';
  leverage: number;
  price?: string; // Required for LIMIT orders
  reduceOnly?: boolean;
  slippagePercent?: string; // For MARKET orders
}

export interface PlaceOrderResponse {
  orderId: number;
  clientOrderId?: string;
}

export interface OpenOrder {
  orderId: number;
  clientOrderId: string | null;
  symbol: string;
  side: 'bid' | 'ask';
  price: string;
  initialAmount: string;
  filledAmount: string;
  orderType: string;
  reduceOnly: boolean;
  createdAt: number;
}

export interface Position {
  symbol: string;
  side: 'bid' | 'ask';
  amount: string;
  entryPrice: string;
  funding: string;
  isolated: boolean;
  liquidationPrice: string | null;
  unrealizedPnl: string;
  marginUsed: string;
}

export interface Fill {
  historyId: number;
  orderId: number;
  symbol: string;
  amount: string;
  price: string;
  fee: string;
  pnl: string | null;
  side: string;
  eventType: string;
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────
// Market Types
// ─────────────────────────────────────────────────────────────

export interface MarketInfo {
  symbol: string;
  tickSize: string;
  lotSize: string;
  maxLeverage: number;
  minOrderSize: string;
  maxOrderSize: string;
  fundingRate: string;
  nextFundingRate: string;
  isolatedOnly: boolean;
}

export interface MarketPrice {
  symbol: string;
  mark: string;
  mid: string;
  oracle: string;
  funding: string;
  nextFunding: string;
  openInterest: string;
  volume24h: string;
  yesterdayPrice: string;
  timestamp: number;
}

export interface OrderbookLevel {
  price: string;
  amount: string;
  count: number;
}

export interface Orderbook {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface Candle {
  startTime: number;
  endTime: number;
  symbol: string;
  interval: string;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  trades: number;
}

// ─────────────────────────────────────────────────────────────
// Account Types
// ─────────────────────────────────────────────────────────────

export interface AccountSummary {
  balance: string;
  accountEquity: string;
  availableToSpend: string;
  availableToWithdraw: string;
  totalMarginUsed: string;
  crossMmr: string;
  positionsCount: number;
  ordersCount: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────
// Leaderboard Types
// ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  handle: string;
  avatarUrl: string | null;
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnlUsdc: number;
  avgPnlPercent: number;
}

export interface LeaderboardResponse {
  range: LeaderboardRange;
  entries: LeaderboardEntry[];
  calculatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
