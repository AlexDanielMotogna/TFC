/**
 * API client for Trading Fight Club
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ApiOptions extends RequestInit {
  token?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

async function fetchApi<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    // Handle both error formats: { message: '...' } and { error: '...' }
    throw new Error(errorBody.message || errorBody.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export async function connectWallet(
  walletAddress: string,
  signature: string
): Promise<{ token: string; user: User; pacificaConnected: boolean }> {
  return fetchApi('/auth/connect', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, signature }),
  });
}

export interface PacificaConnectionStatus {
  connected: boolean;
  pacificaAddress: string | null;
  connectedAt?: string;
}

export async function getPacificaStatus(token: string): Promise<PacificaConnectionStatus> {
  const response = await fetchApi<ApiResponse<PacificaConnectionStatus>>('/auth/pacifica/me', { token });
  return response.data;
}

export async function linkPacificaAccount(
  token: string,
  pacificaAddress: string
): Promise<{ connected: boolean; pacificaAddress: string }> {
  const response = await fetchApi<ApiResponse<{ connected: boolean; pacificaAddress: string }>>(
    '/auth/pacifica/link',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ pacificaAddress }),
    }
  );
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// Fights
// ─────────────────────────────────────────────────────────────

export interface Fight {
  id: string;
  status: 'WAITING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  durationMinutes: number;
  stakeUsdc: number;
  creator: User;
  participants: FightParticipant[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  isDraw: boolean;
  updatedAt: string;
}

export interface FightParticipant {
  userId: string;
  user: User;
  slot: 'A' | 'B';
  // These come as strings from Prisma Decimal serialization
  finalPnlPercent: string | number | null;
  finalScoreUsdc: string | number | null;
  // External trades detection
  externalTradesDetected: boolean;
  externalTradeIds: string[];
}

export interface User {
  id: string;
  handle: string;
  avatarUrl: string | null;
}

interface FightsResponse {
  success: boolean;
  data: Fight[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getFights(status?: string): Promise<Fight[]> {
  const params = status ? `?status=${status}` : '';
  const response = await fetchApi<FightsResponse>(`/fights${params}`);
  return response.data;
}

export async function getFight(id: string): Promise<Fight> {
  const response = await fetchApi<ApiResponse<Fight>>(`/fights/${id}`);
  return response.data;
}

export async function createFight(
  token: string,
  params: { durationMinutes: number; stakeUsdc: number }
): Promise<Fight> {
  return fetchApi('/fights', {
    method: 'POST',
    token,
    body: JSON.stringify(params),
  });
}

export async function joinFight(token: string, fightId: string): Promise<Fight> {
  const response = await fetchApi<ApiResponse<Fight>>(`/fights/${fightId}/join`, {
    method: 'POST',
    token,
  });
  return response.data;
}

export async function cancelFight(token: string, fightId: string): Promise<{ id: string }> {
  const response = await fetchApi<ApiResponse<{ id: string }>>(`/fights/${fightId}`, {
    method: 'DELETE',
    token,
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// Markets
// ─────────────────────────────────────────────────────────────

export interface Market {
  symbol: string;
  tickSize: string;
  maxLeverage: number;
  minOrderSize: string;
  maxOrderSize: string;
}

export interface MarketPrice {
  symbol: string;
  mark: string;
  oracle: string;
  fundingRate: string;
  volume24h: string;
}

export async function getMarkets(): Promise<Market[]> {
  return fetchApi('/markets');
}

export async function getPrices(): Promise<MarketPrice[]> {
  return fetchApi('/markets/prices');
}

// ─────────────────────────────────────────────────────────────
// Leaderboard
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
  winRate: number;
  totalPnlUsdc: number;
  avgPnlPercent: number;
}

export async function getLeaderboard(
  range: 'weekly' | 'all_time' = 'weekly',
  limit = 50
): Promise<{ range: string; entries: LeaderboardEntry[] }> {
  return fetchApi(`/leaderboard?range=${range}&limit=${limit}`);
}

// ─────────────────────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  handle: string;
  avatarUrl: string | null;
  createdAt: string;
  pacificaConnected: boolean;
  stats: {
    totalFights: number;
    wins: number;
    losses: number;
    draws: number;
    totalPnlUsdc: number;
    avgPnlPercent: number;
  };
}

export async function getMyProfile(token: string): Promise<UserProfile> {
  return fetchApi('/users/me', { token });
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const response = await fetchApi<ApiResponse<UserProfile>>(`/users/${userId}`);
  return response.data;
}

export async function getUserFights(userId: string): Promise<Fight[]> {
  const response = await fetchApi<ApiResponse<Fight[]>>(`/users/${userId}/fights`);
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// Account
// ─────────────────────────────────────────────────────────────

export interface AccountSummary {
  balance: string;
  accountEquity: string;
  availableToSpend: string;
  availableToWithdraw: string;
  pendingBalance: string;
  totalMarginUsed: string;
  crossMmr: string;
  positionsCount: number;
  ordersCount: number;
  feeLevel: number;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  leverage: number;
  margin: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  funding?: string;
  isolated?: boolean;
}

export interface OpenOrder {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: string;
  size: string;
  price: string;
  filled: string;
  status: string;
  reduceOnly?: boolean;
  stopPrice?: string | null;
  createdAt: number;
}

export async function getAccountSummary(token: string): Promise<AccountSummary | null> {
  try {
    const response = await fetchApi<ApiResponse<AccountSummary>>('/account/summary', { token });
    return response.data;
  } catch {
    return null;
  }
}

export async function getPositions(token: string): Promise<Position[]> {
  try {
    const response = await fetchApi<ApiResponse<Position[]>>('/account/positions', { token });
    return response.data || [];
  } catch {
    return [];
  }
}

export async function getOpenOrders(token: string): Promise<OpenOrder[]> {
  try {
    const response = await fetchApi<ApiResponse<OpenOrder[]>>('/account/orders/open', { token });
    return response.data || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Stake Info
// ─────────────────────────────────────────────────────────────

export interface StakeInfo {
  inFight: boolean;
  fightId?: string;
  stake: number | null;
  currentExposure: number | null;  // Current positions value (can decrease when closing)
  maxExposureUsed: number | null;  // Highest exposure ever reached (never decreases)
  available: number | null;        // stake - maxExposureUsed (based on max, not current)
}

export async function getStakeInfo(account: string, fightId?: string): Promise<StakeInfo> {
  const params = new URLSearchParams({ account });
  if (fightId) {
    params.append('fightId', fightId);
  }
  const response = await fetchApi<ApiResponse<StakeInfo>>(`/fights/stake-info?${params.toString()}`);
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  size: string;
  leverage: number;
  price?: string;
  reduceOnly?: boolean;
  slippagePercent?: string;
}

export interface PlaceOrderResult {
  orderId: number;
  clientOrderId: string;
}

export async function placeOrder(token: string, params: PlaceOrderParams): Promise<PlaceOrderResult> {
  const response = await fetchApi<ApiResponse<PlaceOrderResult>>('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify(params),
  });
  return response.data;
}

export async function cancelOrder(token: string, orderId: number, symbol: string): Promise<boolean> {
  const response = await fetchApi<ApiResponse<{ success: boolean }>>(`/orders/${orderId}?symbol=${symbol}`, {
    method: 'DELETE',
    token,
  });
  return response.data.success;
}

export async function cancelAllOrders(token: string, symbol?: string): Promise<number> {
  const query = symbol ? `?symbol=${symbol}` : '';
  const response = await fetchApi<ApiResponse<{ cancelled_count: number }>>(`/orders${query}`, {
    method: 'DELETE',
    token,
  });
  return response.data.cancelled_count;
}

// ─────────────────────────────────────────────────────────────
// Unified API object for easier imports
// ─────────────────────────────────────────────────────────────

export const api = {
  // Auth
  connectWallet,
  getPacificaStatus,
  linkPacificaAccount,
  // Fights
  getFights,
  getFight,
  createFight,
  joinFight,
  cancelFight,
  getStakeInfo,
  // Markets
  getMarkets,
  getPrices,
  // Leaderboard
  getLeaderboard: async (range: 'weekly' | 'all_time' = 'weekly') => {
    const result = await getLeaderboard(range) as unknown as { success: boolean; data: { range: string; entries: LeaderboardEntry[] } };
    return result.data?.entries || [];
  },
  // Users
  getMyProfile,
  getUserProfile,
  getUserFights,
  // Account
  getAccountSummary,
  getPositions,
  getOpenOrders,
  // Orders
  placeOrder,
  cancelOrder,
  cancelAllOrders,
};
