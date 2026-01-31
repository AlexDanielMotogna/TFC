'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { BetaGate } from '@/components/BetaGate';
import { api, type Fight } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// Tooltip component with styled popup
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-surface-300 bg-surface-800 border border-surface-600 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
        {text}
      </span>
    </span>
  );
}

interface FightTrade {
  id: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  fee: string;
  pnl: string | null;
  leverage: number | null;
  notional: string;
  executedAt: string;
  participantUserId: string;
}

interface FightWithTrades extends Fight {
  trades?: FightTrade[];
}

export default function FightResultsPage() {
  const params = useParams();
  const router = useRouter();
  const fightId = params?.id as string;

  const { isAuthenticated, user } = useAuth();
  const { token } = useAuthStore();

  const [fight, setFight] = useState<FightWithTrades | null>(null);
  const [trades, setTrades] = useState<FightTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Set page title
  useEffect(() => {
    document.title = 'Fight Results - Trading Fight Club';
  }, []);
  const [error, setError] = useState<string | null>(null);

  // Fetch fight data
  useEffect(() => {
    const fetchFight = async () => {
      try {
        const data = await api.getFight(fightId);
        setFight(data);

        // If fight is still LIVE, redirect to trade page
        if (data.status === 'LIVE') {
          router.push(`/trade?fight=${fightId}`);
          return;
        }

        // If fight is WAITING, redirect to lobby
        if (data.status === 'WAITING') {
          router.push('/trade');
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fight');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFight();
  }, [fightId, router]);

  // Fetch trades for this fight
  useEffect(() => {
    if (!token || !fightId || !fight || fight.status === 'LIVE') return;

    const fetchTrades = async () => {
      try {
        const response = await fetch(`/api/fights/${fightId}/trades`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setTrades(result.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
      }
    };

    fetchTrades();
  }, [fightId, token, fight]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format price with appropriate precision (5 decimals for small prices, 2 for large)
  const formatPrice = (price: number) => {
    if (price < 1) return price.toFixed(5);
    if (price < 100) return price.toFixed(3);
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return (
      <BetaGate>
        <div className="min-h-screen bg-surface-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </BetaGate>
    );
  }

  if (error || !fight) {
    return (
      <BetaGate>
        <div className="min-h-screen bg-surface-900 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-xl mb-4 text-surface-400">{error || 'Fight not found'}</p>
            <Link href="/trade" className="btn-primary">
              Back to Lobby
            </Link>
          </div>
        </div>
      </BetaGate>
    );
  }

  // Get participants with their results
  const participantA = fight.participants?.[0];
  const participantB = fight.participants?.[1];

  // Helper to parse Decimal values from API (come as strings)
  const parseDecimal = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value) || 0;
  };

  // Determine winner (only if there's a winnerId set)
  const winner = fight.winnerId
    ? fight.participants?.find((p) => p.userId === fight.winnerId)
    : null;
  const loser = fight.winnerId
    ? fight.participants?.find((p) => p.userId !== fight.winnerId)
    : null;

  // Check if current user won
  const isCurrentUserWinner = winner?.userId === user?.id;
  const isCurrentUserParticipant = fight.participants?.some((p) => p.userId === user?.id);

  // Get trades for each participant
  const participantATrades = trades.filter((t) => t.participantUserId === participantA?.userId);
  const participantBTrades = trades.filter((t) => t.participantUserId === participantB?.userId);

  // Calculate PnL breakdown for each participant
  const calculatePnlBreakdown = (participantTrades: FightTrade[]) => {
    let totalFees = 0;
    let realizedPnl = 0;

    for (const trade of participantTrades) {
      // Fees are stored as negative values in trade.fee
      totalFees += Math.abs(parseFloat(trade.fee || '0'));
      // PnL from closing trades (includes fees already)
      if (trade.pnl) {
        realizedPnl += parseFloat(trade.pnl);
      }
    }

    // Net PnL is the realized PnL (which already includes fees from Pacifica)
    const netPnl = realizedPnl;

    return {
      totalFees,
      realizedPnl,
      netPnl,
      tradesCount: participantTrades.length,
    };
  };

  const pnlBreakdownA = calculatePnlBreakdown(participantATrades);
  const pnlBreakdownB = calculatePnlBreakdown(participantBTrades);

  return (
    <BetaGate>
      <div className="min-h-screen bg-surface-900 text-white">
        {/* Header */}
      <header className="border-b border-surface-700 bg-surface-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/trade"
              className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>Back to Lobby</span>
            </Link>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  fight.status === 'FINISHED'
                    ? 'bg-surface-700 text-surface-300'
                    : 'bg-loss-500/20 text-loss-400'
                }`}
              >
                {fight.status === 'FINISHED' ? 'Completed' : 'Cancelled'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Result Banner */}
        <div className="text-center mb-8">
          {fight.isDraw ? (
            <>
              <h1 className="text-4xl font-display font-bold text-surface-300 mb-2">
                DRAW
              </h1>
              <p className="text-surface-400">Both traders finished with equal performance</p>
            </>
          ) : fight.status === 'CANCELLED' ? (
            <>
              <h1 className="text-4xl font-display font-bold text-loss-400 mb-2">
                CANCELLED
              </h1>
              <p className="text-surface-400">This fight was cancelled</p>
            </>
          ) : isCurrentUserParticipant ? (
            isCurrentUserWinner ? (
              <>
                <h1 className="text-4xl font-display font-bold text-win-400 mb-2">
                  VICTORY!
                </h1>
                <p className="text-surface-400">Congratulations, you won this fight!</p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-display font-bold text-loss-400 mb-2">
                  DEFEAT
                </h1>
                <p className="text-surface-400">Better luck next time!</p>
              </>
            )
          ) : (
            <>
              <h1 className="text-4xl font-display font-bold text-white mb-2">
                FIGHT RESULTS
              </h1>
              <p className="text-surface-400">
                Winner: <span className="text-win-400 font-semibold">{winner?.user?.handle || 'Unknown'}</span>
              </p>
            </>
          )}
        </div>

        {/* VS Card */}
        <div className="card p-4 sm:p-6 mb-6 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[280px]">
            {/* Participant A */}
            <div className={`flex-1 text-center ${winner?.userId === participantA?.userId ? 'opacity-100' : fight.winnerId ? 'opacity-60' : 'opacity-100'}`}>
              <div className="relative inline-block mb-2 sm:mb-3">
                <div
                  className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold ${
                    winner?.userId === participantA?.userId
                      ? 'bg-gradient-to-br from-win-500 to-win-600 ring-4 ring-win-500/30'
                      : 'bg-surface-700'
                  }`}
                >
                  {participantA?.user?.handle?.[0]?.toUpperCase() || '?'}
                </div>
                {fight.winnerId && winner?.userId === participantA?.userId && (
                  <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-lg sm:text-2xl">👑</div>
                )}
              </div>
              <h3 className="font-display font-bold text-sm sm:text-lg text-white mb-1 truncate max-w-[80px] sm:max-w-none mx-auto">
                {participantA?.user?.handle || 'Unknown'}
              </h3>
              <p
                className={`text-lg sm:text-2xl font-mono font-bold ${
                  parseDecimal(participantA?.finalPnlPercent) >= 0 ? 'text-win-400' : 'text-loss-400'
                }`}
              >
                {parseDecimal(participantA?.finalPnlPercent) >= 0 ? '+' : ''}
                {parseDecimal(participantA?.finalPnlPercent).toFixed(4)}%
              </p>
              <p className="text-xs sm:text-sm text-surface-400 mt-1">
                ${parseDecimal(participantA?.finalScoreUsdc).toFixed(4)} USDC
              </p>
              <p className="text-[10px] sm:text-xs text-surface-500 mt-1 sm:mt-2">
                {participantATrades.length} trades
              </p>
              {participantA?.externalTradesDetected && (
                <p className="text-[10px] sm:text-xs text-amber-500 mt-1" title={`External trade IDs: ${participantA.externalTradeIds?.join(', ') || 'N/A'}`}>
                  External trades detected
                </p>
              )}
            </div>

            {/* VS */}
            <div className="px-2 sm:px-6 flex-shrink-0">
              <div className="text-xl sm:text-3xl font-display font-bold text-surface-600">VS</div>
            </div>

            {/* Participant B */}
            <div className={`flex-1 text-center ${winner?.userId === participantB?.userId ? 'opacity-100' : fight.winnerId ? 'opacity-60' : 'opacity-100'}`}>
              <div className="relative inline-block mb-2 sm:mb-3">
                <div
                  className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold ${
                    winner?.userId === participantB?.userId
                      ? 'bg-gradient-to-br from-win-500 to-win-600 ring-4 ring-win-500/30'
                      : 'bg-surface-700'
                  }`}
                >
                  {participantB?.user?.handle?.[0]?.toUpperCase() || '?'}
                </div>
                {fight.winnerId && winner?.userId === participantB?.userId && (
                  <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-lg sm:text-2xl">👑</div>
                )}
              </div>
              <h3 className="font-display font-bold text-sm sm:text-lg text-white mb-1 truncate max-w-[80px] sm:max-w-none mx-auto">
                {participantB?.user?.handle || 'Waiting...'}
              </h3>
              {participantB && (
                <>
                  <p
                    className={`text-lg sm:text-2xl font-mono font-bold ${
                      parseDecimal(participantB?.finalPnlPercent) >= 0 ? 'text-win-400' : 'text-loss-400'
                    }`}
                  >
                    {parseDecimal(participantB?.finalPnlPercent) >= 0 ? '+' : ''}
                    {parseDecimal(participantB?.finalPnlPercent).toFixed(4)}%
                  </p>
                  <p className="text-xs sm:text-sm text-surface-400 mt-1">
                    ${parseDecimal(participantB?.finalScoreUsdc).toFixed(4)} USDC
                  </p>
                  <p className="text-[10px] sm:text-xs text-surface-500 mt-1 sm:mt-2">
                    {participantBTrades.length} trades
                  </p>
                  {participantB?.externalTradesDetected && (
                    <p className="text-[10px] sm:text-xs text-amber-500 mt-1" title={`External trade IDs: ${participantB.externalTradeIds?.join(', ') || 'N/A'}`}>
                      External trades detected
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fight Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4 text-center">
            <p className="text-surface-400 text-sm mb-1">Duration</p>
            <p className="font-display font-bold text-lg text-white">
              {formatDuration(fight.durationMinutes)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-surface-400 text-sm mb-1">Stake</p>
            <p className="font-display font-bold text-lg text-white">
              ${fight.stakeUsdc}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-surface-400 text-sm mb-1">Started</p>
            <p className="font-display font-bold text-lg text-white">
              {fight.startedAt ? formatTime(fight.startedAt) : '-'}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-surface-400 text-sm mb-1">Ended</p>
            <p className="font-display font-bold text-lg text-white">
              {fight.endedAt ? formatTime(fight.endedAt) : '-'}
            </p>
          </div>
        </div>

        {/* PnL Breakdown */}
        {trades.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Participant A Breakdown */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-sm font-bold">
                  {participantA?.user?.handle?.[0]?.toUpperCase() || '?'}
                </div>
                <h4 className="font-semibold text-white">{participantA?.user?.handle || 'Unknown'}</h4>
                {winner?.userId === participantA?.userId && <span className="text-xs">👑</span>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <Tooltip text="Number of trades executed during the fight">
                    <span className="text-surface-400">Trades</span>
                  </Tooltip>
                  <span className="text-white font-mono">{pnlBreakdownA.tradesCount}</span>
                </div>
                <div className="flex justify-between">
                  <Tooltip text="Profit/loss from price movement (before fees)">
                    <span className="text-surface-400">Position PnL</span>
                  </Tooltip>
                  <span className={`font-mono ${(parseDecimal(participantA?.finalScoreUsdc) + pnlBreakdownA.totalFees) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                    {(parseDecimal(participantA?.finalScoreUsdc) + pnlBreakdownA.totalFees) >= 0 ? '+' : '-'}${Math.abs(parseDecimal(participantA?.finalScoreUsdc) + pnlBreakdownA.totalFees).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <Tooltip text="Total trading fees (TFC 0.05% + Pacifica)">
                    <span className="text-surface-400">Fees</span>
                  </Tooltip>
                  <span className="text-loss-400 font-mono">-${pnlBreakdownA.totalFees.toFixed(4)}</span>
                </div>
                <div className="border-t border-surface-700 pt-2 mt-2">
                  <div className="flex justify-between">
                    <Tooltip text="Position PnL minus fees">
                      <span className="text-white font-semibold">Final Result</span>
                    </Tooltip>
                    <span className={`font-mono font-bold ${parseDecimal(participantA?.finalScoreUsdc) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {parseDecimal(participantA?.finalScoreUsdc) >= 0 ? '+' : '-'}${Math.abs(parseDecimal(participantA?.finalScoreUsdc)).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <Tooltip text="Return on Investment (PnL / Margin used)">
                      <span className="text-surface-500">ROI</span>
                    </Tooltip>
                    <span className={`font-mono ${parseDecimal(participantA?.finalPnlPercent) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {parseDecimal(participantA?.finalPnlPercent) >= 0 ? '+' : ''}{parseDecimal(participantA?.finalPnlPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Participant B Breakdown */}
            {participantB && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-sm font-bold">
                    {participantB?.user?.handle?.[0]?.toUpperCase() || '?'}
                  </div>
                  <h4 className="font-semibold text-white">{participantB?.user?.handle || 'Unknown'}</h4>
                  {winner?.userId === participantB?.userId && <span className="text-xs">👑</span>}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <Tooltip text="Number of trades executed during the fight">
                      <span className="text-surface-400">Trades</span>
                    </Tooltip>
                    <span className="text-white font-mono">{pnlBreakdownB.tradesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <Tooltip text="Profit/loss from price movement (before fees)">
                      <span className="text-surface-400">Position PnL</span>
                    </Tooltip>
                    <span className={`font-mono ${(parseDecimal(participantB?.finalScoreUsdc) + pnlBreakdownB.totalFees) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {(parseDecimal(participantB?.finalScoreUsdc) + pnlBreakdownB.totalFees) >= 0 ? '+' : '-'}${Math.abs(parseDecimal(participantB?.finalScoreUsdc) + pnlBreakdownB.totalFees).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <Tooltip text="Total trading fees (TFC 0.05% + Pacifica)">
                      <span className="text-surface-400">Fees</span>
                    </Tooltip>
                    <span className="text-loss-400 font-mono">-${pnlBreakdownB.totalFees.toFixed(4)}</span>
                  </div>
                  <div className="border-t border-surface-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <Tooltip text="Position PnL minus fees">
                        <span className="text-white font-semibold">Final Result</span>
                      </Tooltip>
                      <span className={`font-mono font-bold ${parseDecimal(participantB?.finalScoreUsdc) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        {parseDecimal(participantB?.finalScoreUsdc) >= 0 ? '+' : '-'}${Math.abs(parseDecimal(participantB?.finalScoreUsdc)).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <Tooltip text="Return on Investment (PnL / Margin used)">
                        <span className="text-surface-500">ROI</span>
                      </Tooltip>
                      <span className={`font-mono ${parseDecimal(participantB?.finalPnlPercent) >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        {parseDecimal(participantB?.finalPnlPercent) >= 0 ? '+' : ''}{parseDecimal(participantB?.finalPnlPercent).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trade History */}
        {trades.length > 0 && (
          <div className="card p-4 mb-6">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wide mb-4">
              Trade History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 uppercase tracking-wider border-b border-surface-700">
                    <th className="text-left py-2 px-2">
                      <Tooltip text="Time when the trade was executed">Time</Tooltip>
                    </th>
                    <th className="text-left py-2 px-2">
                      <Tooltip text="Trader who placed this order">Trader</Tooltip>
                    </th>
                    <th className="text-left py-2 px-2">
                      <Tooltip text="Trading pair and leverage used">Symbol</Tooltip>
                    </th>
                    <th className="text-left py-2 px-2">
                      <Tooltip text="BUY = Long, SELL = Short">Side</Tooltip>
                    </th>
                    <th className="text-right py-2 px-2">
                      <Tooltip text="Amount of the asset traded">Size</Tooltip>
                    </th>
                    <th className="text-right py-2 px-2">
                      <Tooltip text="Total position value (Size × Price)">Notional</Tooltip>
                    </th>
                    <th className="text-right py-2 px-2">
                      <Tooltip text="Execution price per unit">Price</Tooltip>
                    </th>
                    <th className="text-right py-2 px-2">
                      <Tooltip text="Trading fee paid to Pacifica">Fee</Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => {
                    const trader = fight.participants?.find(
                      (p) => p.userId === trade.participantUserId
                    );
                    const isWinnerTrade = trade.participantUserId === winner?.userId;

                    return (
                      <tr
                        key={trade.id}
                        className="border-b border-surface-700/50 hover:bg-surface-800/30"
                      >
                        <td className="py-2 px-2 text-surface-400 font-mono text-xs">
                          <Tooltip text={new Date(trade.executedAt).toLocaleString()}>
                            {formatTime(trade.executedAt)}
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2">
                          <span className={isWinnerTrade ? 'text-win-400' : 'text-surface-300'}>
                            {trader?.user?.handle || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-white">
                          <Tooltip text={trade.leverage ? `${trade.leverage}x leverage` : 'Leverage not recorded'}>
                            {trade.symbol.replace('-USD', '')}
                            {trade.leverage && (
                              <span className="text-xs text-surface-400 ml-1">{trade.leverage}x</span>
                            )}
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2">
                          <Tooltip text={trade.side === 'BUY' ? 'Long position (betting price goes up)' : 'Short position (betting price goes down)'}>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                trade.side === 'BUY'
                                  ? 'bg-win-500/20 text-win-400'
                                  : 'bg-loss-500/20 text-loss-400'
                              }`}
                            >
                              {trade.side}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-white">
                          <Tooltip text={`${parseFloat(trade.amount)} ${trade.symbol.replace('-USD', '')}`}>
                            {parseFloat(trade.amount).toFixed(6)}
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-primary-400">
                          <Tooltip text="Total position value in USD">
                            ${trade.notional || (parseFloat(trade.amount) * parseFloat(trade.price)).toFixed(2)}
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-surface-300">
                          <Tooltip text="Execution price per unit">
                            ${formatPrice(parseFloat(trade.price))}
                          </Tooltip>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-surface-400">
                          <Tooltip text="Trading fee (TFC 0.05% + Pacifica)">
                            {trade.fee ? (
                              <span>-${Math.abs(parseFloat(trade.fee)).toFixed(4)}</span>
                            ) : (
                              <span className="text-surface-500">-</span>
                            )}
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No trades message */}
        {trades.length === 0 && (
          <div className="card p-8 mb-6 text-center">
            <p className="text-surface-400">No trades were executed during this fight</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/trade"
            className="px-6 py-3 bg-surface-700 hover:bg-surface-600 rounded-lg font-semibold text-center transition-colors"
          >
            Back to Lobby
          </Link>
          <Link
            href="/trade"
            className="px-6 py-3 bg-primary-500 hover:bg-primary-400 rounded-lg font-semibold text-center transition-colors"
          >
            Trade Now
          </Link>
          {loser && isCurrentUserWinner && (
            <button
              onClick={() => {
                // TODO: Implement rematch functionality
                alert('Rematch feature coming soon!');
              }}
              className="px-6 py-3 bg-accent-500 hover:bg-accent-400 rounded-lg font-semibold text-center transition-colors"
            >
              Challenge Again
            </button>
          )}
        </div>

        {/* Fight Date Footer */}
        <div className="text-center mt-8 text-surface-500 text-sm">
          Fight completed on {fight.endedAt ? formatDate(fight.endedAt) : formatDate(fight.createdAt)}
        </div>
      </main>
      </div>
    </BetaGate>
  );
}
