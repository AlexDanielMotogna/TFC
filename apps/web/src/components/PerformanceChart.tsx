'use client';

import { useState, useMemo, ComponentType } from 'react';
import {
  LineChart as RLineChart,
  Line as RLine,
  BarChart as RBarChart,
  Bar as RBar,
  Cell as RCell,
  XAxis as RXAxis,
  YAxis as RYAxis,
  CartesianGrid as RCartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer as RResponsiveContainer,
  ReferenceLine as RReferenceLine,
} from 'recharts';

// Type workaround for recharts components (incompatible with React 18 strict mode)
/* eslint-disable @typescript-eslint/no-explicit-any */
const ResponsiveContainer = RResponsiveContainer as ComponentType<any>;
const LineChart = RLineChart as ComponentType<any>;
const BarChart = RBarChart as ComponentType<any>;
const Line = RLine as ComponentType<any>;
const Bar = RBar as ComponentType<any>;
const Cell = RCell as ComponentType<any>;
const XAxis = RXAxis as ComponentType<any>;
const YAxis = RYAxis as ComponentType<any>;
const CartesianGrid = RCartesianGrid as ComponentType<any>;
const Tooltip = RTooltip as ComponentType<any>;
const ReferenceLine = RReferenceLine as ComponentType<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */
import type { Fight } from '@/lib/api';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface PerformanceChartProps {
  fights: Fight[];
  userId: string;
}

type ChartType = 'cumulative' | 'individual' | 'winrate';

export function PerformanceChart({ fights, userId }: PerformanceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('cumulative');

  // Filter and sort finished fights by date
  const finishedFights = useMemo(() => {
    return fights
      .filter((f) => f.status === 'FINISHED' && f.endedAt)
      .sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime());
  }, [fights]);

  // Process data for cumulative PnL chart
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return finishedFights.map((fight, index) => {
      const myParticipant = fight.participants?.find((p) => p.userId === userId);
      const pnl = myParticipant?.finalScoreUsdc
        ? parseFloat(String(myParticipant.finalScoreUsdc))
        : 0;
      cumulative += pnl;

      return {
        index: index + 1,
        date: new Date(fight.endedAt!).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        pnl: parseFloat(cumulative.toFixed(2)),
        fightId: fight.id,
      };
    });
  }, [finishedFights, userId]);

  // Process data for individual fights chart
  const individualData = useMemo(() => {
    return finishedFights.map((fight, index) => {
      const myParticipant = fight.participants?.find((p) => p.userId === userId);
      const pnl = myParticipant?.finalScoreUsdc
        ? parseFloat(String(myParticipant.finalScoreUsdc))
        : 0;

      return {
        index: index + 1,
        date: new Date(fight.endedAt!).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        pnl: parseFloat(pnl.toFixed(2)),
        fightId: fight.id,
      };
    });
  }, [finishedFights, userId]);

  // Process data for win rate trend (rolling 10-fight average)
  const winRateData = useMemo(() => {
    const windowSize = 10;
    return finishedFights.map((fight, index) => {
      const startIndex = Math.max(0, index - windowSize + 1);
      const window = finishedFights.slice(startIndex, index + 1);

      const wins = window.filter((f) => f.winnerId === userId).length;
      const winRate = window.length > 0 ? (wins / window.length) * 100 : 0;

      return {
        index: index + 1,
        date: new Date(fight.endedAt!).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        winRate: parseFloat(winRate.toFixed(1)),
        fightId: fight.id,
      };
    });
  }, [finishedFights, userId]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-900 border border-surface-700 p-3 rounded-lg shadow-lg">
          <p className="text-surface-300 text-xs mb-1">Fight #{label}</p>
          <p className="text-surface-400 text-xs mb-2">{payload[0].payload.date}</p>
          {chartType === 'cumulative' && (
            <p className={`font-semibold ${payload[0].value >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
              {payload[0].value >= 0 ? '+' : ''}${payload[0].value}
            </p>
          )}
          {chartType === 'individual' && (
            <p className={`font-semibold ${payload[0].value >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
              {payload[0].value >= 0 ? '+' : ''}${payload[0].value}
            </p>
          )}
          {chartType === 'winrate' && (
            <p className="font-semibold text-primary-400">
              {payload[0].value}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (finishedFights.length === 0) {
    return (
      <div className="h-48 bg-surface-800 rounded-lg flex items-center justify-center border border-surface-700">
        <p className="text-surface-500">No fight history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Type Tabs - responsive */}
      <div className="flex gap-1 sm:gap-2">
        <button
          onClick={() => setChartType('cumulative')}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors flex-1 sm:flex-none justify-center ${
            chartType === 'cumulative'
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
              : 'bg-surface-800 text-surface-400 hover:bg-surface-700 border border-surface-700'
          }`}
        >
          <ShowChartIcon sx={{ fontSize: 16 }} />
          <span className="text-xs sm:text-sm font-medium">PnL</span>
        </button>
        <button
          onClick={() => setChartType('individual')}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors flex-1 sm:flex-none justify-center ${
            chartType === 'individual'
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
              : 'bg-surface-800 text-surface-400 hover:bg-surface-700 border border-surface-700'
          }`}
        >
          <BarChartIcon sx={{ fontSize: 16 }} />
          <span className="text-xs sm:text-sm font-medium">Results</span>
        </button>
        <button
          onClick={() => setChartType('winrate')}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors flex-1 sm:flex-none justify-center ${
            chartType === 'winrate'
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
              : 'bg-surface-800 text-surface-400 hover:bg-surface-700 border border-surface-700'
          }`}
        >
          <TrendingUpIcon sx={{ fontSize: 16 }} />
          <span className="text-xs sm:text-sm font-medium">Win %</span>
        </button>
      </div>

      {/* Chart */}
      <div className="h-64 bg-surface-800/50 rounded-lg p-2 sm:p-4 border border-surface-700">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'cumulative' && (
            <LineChart data={cumulativeData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="index"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickFormatter={(value: number) => `#${value}`}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickFormatter={(value: number) => `$${value}`}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
          {chartType === 'individual' && (
            <BarChart data={individualData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="index"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickFormatter={(value: number) => `#${value}`}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickFormatter={(value: number) => `$${value}`}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {individualData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? '#26A69A' : '#EF5350'}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
          {chartType === 'winrate' && (
            <LineChart data={winRateData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="index"
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickFormatter={(value: number) => `#${value}`}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="#52525b" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="winRate"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
