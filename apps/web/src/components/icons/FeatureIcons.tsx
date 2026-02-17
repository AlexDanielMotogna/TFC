/**
 * CENTRALIZED FEATURE ICONS
 *
 * This file contains all feature icons used across the application.
 * DO NOT create duplicate icon definitions elsewhere - always import from here.
 *
 * Each icon is documented with its purpose and where it's used.
 *
 * Icon Definitions:
 * - Leverage: Trending up arrow - represents leverage trading (orange)
 * - LongShort: Up/down arrows - represents long and short positions (green)
 * - MarketOrders: Clock - represents instant market execution (primary/cyan)
 * - StopLoss: Circle with slash - represents protection/stop loss (red)
 * - TakeProfit: Dollar sign in circle - represents profit taking (green)
 * - FlipPosition: Reversing arrows - represents position reversal (primary/cyan)
 * - FightCapitalLimit: Balance/scales - represents fair fight limits (violet)
 * - DepositWithdraw: Credit card - represents fund management (green)
 * - FightBanner: Lightning bolt - represents live fight status (orange)
 * - FightOnly: Filter - represents fight-only filter (violet)
 * - Prize: Trophy - represents prize claims and rewards (yellow/gold)
 * - AiSignal: Brain/CPU - represents AI-powered trading signals (orange/red)
 *
 * Usage:
 * import { LongShortIcon, TakeProfitIcon } from '@/components/icons/FeatureIcons';
 *
 * <LongShortIcon className="w-5 h-5" />
 */

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Leverage Icon - Trending up arrow
 * Used for: Leverage trading features
 * Color theme: Orange
 */
export function LeverageIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

/**
 * Long & Short Icon - Up and down arrows
 * Used for: Trade notifications, long/short positions
 * Color theme: Green
 */
export function LongShortIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

/**
 * Market Orders Icon - Clock
 * Used for: Order notifications, instant execution features
 * Color theme: Primary/Cyan
 */
export function MarketOrdersIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Stop Loss Icon - Circle with slash (protection shield)
 * Used for: Stop loss features and notifications
 * Color theme: Red
 */
export function StopLossIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

/**
 * Take Profit Icon - Dollar sign in circle
 * Used for: Take profit features and notifications
 * Color theme: Green
 */
export function TakeProfitIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Flip Position Icon - Reversing arrows
 * Used for: Position reversal features
 * Color theme: Primary/Cyan
 */
export function FlipPositionIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

/**
 * Fight Capital Limit Icon - Balance/scales
 * Used for: Fair fight capital limit features
 * Color theme: Violet
 */
export function FightCapitalLimitIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

/**
 * Deposit/Withdraw Icon - Credit card
 * Used for: Fund management features
 * Color theme: Green
 */
export function DepositWithdrawIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

/**
 * Fight Banner Icon - Lightning bolt
 * Used for: Fight notifications, live fight status
 * Color theme: Orange
 */
export function FightBannerIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

/**
 * Fight Only Filter Icon - Filter
 * Used for: Fight-only position filter features
 * Color theme: Violet
 */
export function FightOnlyFilterIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

/**
 * Order Types Icon - List with different order types
 * Used for: Order type selection (Market, Limit, Stop Market, Stop Limit)
 * Color theme: Primary/Blue
 */
export function OrderTypesIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6v0m0 4v0m0 4v0m0 4v0" />
    </svg>
  );
}

/**
 * Batch Orders Icon - Multiple stacked orders
 * Used for: Batch/multiple order execution
 * Color theme: Violet/Purple
 */
export function BatchOrdersIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

/**
 * AI Signal Icon - Brain/CPU chip
 * Used for: AI Signal Trading Bot feature
 * Color theme: Orange/Red
 */
export function AiSignalIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.59v1.19a2.25 2.25 0 01-2.25 2.25h-3.242a2.25 2.25 0 01-2.25-2.25v-1.19a2.25 2.25 0 00-.659-1.59L5 14.5m14 0V9a2 2 0 00-2-2M5 14.5V9a2 2 0 012-2" />
    </svg>
  );
}

/**
 * System/Info Icon - Circle with info symbol
 * Used for: Generic system notifications
 * Color theme: Surface/Gray
 */
export function InfoIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

/**
 * Prize/Trophy Icon - Award trophy
 * Used for: Prize claims, rewards notifications
 * Color theme: Yellow/Gold
 */
export function PrizeIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

/**
 * Bell Icon - Notification bell
 * Used for: Notification bell button
 */
export function BellIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}
