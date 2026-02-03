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

  const json = await response.json();

  // Handle wrapped response format { success: true, data: T }
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export async function connectWallet(
  walletAddress: string,
  signature: string,
  referralCode?: string
): Promise<{ token: string; user: User; pacificaConnected: boolean }> {
  return fetchApi('/auth/connect', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, signature, referralCode }),
  });
}

export interface PacificaConnectionStatus {
  connected: boolean;
  pacificaAddress: string | null;
  connectedAt?: string;
}

export async function getPacificaStatus(token: string): Promise<PacificaConnectionStatus> {
  return fetchApi<PacificaConnectionStatus>('/auth/pacifica/me', { token });
}

export async function linkPacificaAccount(
  token: string,
  pacificaAddress: string
): Promise<{ connected: boolean; pacificaAddress: string }> {
  return fetchApi<{ connected: boolean; pacificaAddress: string }>(
    '/auth/pacifica/link',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ pacificaAddress }),
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Fights
// ─────────────────────────────────────────────────────────────

export interface FightViolation {
  ruleCode: string;
  ruleName: string;
  ruleMessage: string;
}

export interface Fight {
  id: string;
  status: 'WAITING' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'NO_CONTEST';
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
  violations?: FightViolation[];
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
  return fetchApi<Fight[]>(`/fights${params}`);
}

export async function getFight(id: string): Promise<Fight> {
  return fetchApi<Fight>(`/fights/${id}`);
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
  return fetchApi<Fight>(`/fights/${fightId}/join`, {
    method: 'POST',
    token,
  });
}

export async function cancelFight(token: string, fightId: string): Promise<{ id: string }> {
  return fetchApi<{ id: string }>(`/fights/${fightId}`, {
    method: 'DELETE',
    token,
  });
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
  return fetchApi<UserProfile>(`/users/${userId}`);
}

export async function getUserFights(userId: string): Promise<Fight[]> {
  return fetchApi<Fight[]>(`/users/${userId}/fights`);
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
    return fetchApi<AccountSummary>('/account/summary', { token });
  } catch {
    return null;
  }
}

export async function getPositions(token: string): Promise<Position[]> {
  try {
    return fetchApi<Position[]>('/account/positions', { token });
  } catch {
    return [];
  }
}

export async function getOpenOrders(token: string): Promise<OpenOrder[]> {
  try {
    return fetchApi<OpenOrder[]>('/account/orders/open', { token });
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
  blockedSymbols?: string[];       // Symbols blocked from trading (had pre-fight positions)
}

export async function getStakeInfo(account: string, fightId?: string): Promise<StakeInfo> {
  const params = new URLSearchParams({ account });
  if (fightId) {
    params.append('fightId', fightId);
  }
  return fetchApi<StakeInfo>(`/fights/stake-info?${params.toString()}`);
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
  return fetchApi<PlaceOrderResult>('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify(params),
  });
}

export async function cancelOrder(token: string, orderId: number, symbol: string): Promise<boolean> {
  const response = await fetchApi<{ success: boolean }>(`/orders/${orderId}?symbol=${symbol}`, {
    method: 'DELETE',
    token,
  });
  return response.success;
}

export async function cancelAllOrders(token: string, symbol?: string): Promise<number> {
  const query = symbol ? `?symbol=${symbol}` : '';
  const response = await fetchApi<{ cancelled_count: number }>(`/orders${query}`, {
    method: 'DELETE',
    token,
  });
  return response.cancelled_count;
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(
  token: string,
  limit = 50,
  offset = 0
): Promise<Notification[]> {
  try {
    return fetchApi<Notification[]>(`/notifications?limit=${limit}&offset=${offset}`, { token });
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  try {
    const response = await fetchApi<{ count: number }>('/notifications/unread-count', { token });
    return response.count;
  } catch {
    return 0;
  }
}

export async function createNotification(
  token: string,
  data: { type: string; title: string; message: string }
): Promise<Notification | null> {
  try {
    return fetchApi<Notification>('/notifications', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  } catch {
    return null;
  }
}

export async function markNotificationAsRead(token: string, id: string): Promise<boolean> {
  try {
    await fetchApi<{ success: boolean }>(`/notifications/${id}/read`, {
      method: 'POST',
      token,
    });
    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsAsRead(token: string): Promise<boolean> {
  try {
    await fetchApi<{ success: boolean }>('/notifications/read-all', {
      method: 'POST',
      token,
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Referrals
// ─────────────────────────────────────────────────────────────

export interface ReferralDashboard {
  referralCode: string;
  commissionRates: {
    t1: number;
    t2: number;
    t3: number;
  };
  unclaimedPayout: number;
  totalReferrals: {
    t1: number;
    t2: number;
    t3: number;
    total: number;
  };
  totalEarnings: {
    total: number;
    t1: number;
    t2: number;
    t3: number;
  };
  referralVolume: {
    t1: number;
    t2: number;
    t3: number;
    total: number;
  };
  recentReferrals: Array<{
    id: string;
    tier: number;
    user: {
      id: string;
      handle: string;
      walletAddress: string | null;
    };
    joinedAt: string;
  }>;
  recentEarnings: Array<{
    id: string;
    tier: number;
    symbol: string;
    commissionAmount: number;
    earnedAt: string;
    isPaid: boolean;
  }>;
  payoutHistory: Array<{
    id: string;
    amount: number;
    status: string;
    walletAddress: string;
    txSignature: string | null;
    createdAt: string;
    processedAt: string | null;
  }>;
}

export interface ReferralListItem {
  id: string;
  handle: string;
  walletAddress: string | null;
  tier: number;
  joinedAt: string;
  totalTrades: number;
  totalVolume: number;
  totalEarnings: number;
}

export interface ReferralsListResponse {
  referrals: ReferralListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ReferralEarning {
  id: string;
  traderId: string;
  traderHandle: string;
  tier: number;
  symbol: string;
  tradeFee: number;
  tradeValue: number;
  commissionPercent: number;
  commissionAmount: number;
  isPaid: boolean;
  earnedAt: string;
  paidAt: string | null;
}

export interface EarningsListResponse {
  earnings: ReferralEarning[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ClaimPayoutResponse {
  success: boolean;
  payout: {
    id: string;
    amount: number;
    status: string;
    walletAddress: string;
    createdAt: string;
  };
  earningsClaimed: number;
  message: string;
}

export async function getReferralDashboard(token: string): Promise<ReferralDashboard> {
  return fetchApi<ReferralDashboard>('/referrals/dashboard', { token });
}

export async function getReferralsList(
  token: string,
  page = 1,
  pageSize = 20,
  tier?: number
): Promise<ReferralsListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (tier) params.append('tier', tier.toString());

  return fetchApi<ReferralsListResponse>(`/referrals/list?${params.toString()}`, { token });
}

export async function getEarningsList(
  token: string,
  page = 1,
  pageSize = 20,
  tier?: number,
  isPaid?: boolean
): Promise<EarningsListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (tier) params.append('tier', tier.toString());
  if (isPaid !== undefined) params.append('isPaid', isPaid.toString());

  return fetchApi<EarningsListResponse>(`/referrals/earnings?${params.toString()}`, { token });
}

export async function claimReferralPayout(token: string): Promise<ClaimPayoutResponse> {
  return fetchApi<ClaimPayoutResponse>('/referrals/claim', {
    method: 'POST',
    token,
  });
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
    const result = await getLeaderboard(range);
    return result.entries || [];
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
  // Notifications
  getNotifications,
  getUnreadNotificationCount,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  // Referrals
  getReferralDashboard,
  getReferralsList,
  getEarningsList,
  claimReferralPayout,
};
