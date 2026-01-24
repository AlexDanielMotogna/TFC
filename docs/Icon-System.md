# Centralized Icon System

## Overview

All feature icons across the Trade Fight Club application are centralized in a single file to ensure consistency and prevent duplication.

**Location:** `apps/web/src/components/icons/FeatureIcons.tsx`

## Why Centralized Icons?

1. **Consistency**: Same icons used everywhere (landing page, notifications, modals, etc.)
2. **Maintainability**: Update an icon in one place, reflected everywhere
3. **Documentation**: Icons are documented with their purpose and color themes
4. **Prevents Duplication**: No need to copy/paste SVG paths across files

## Icon Reference

### Trading Icons

| Icon | Component | Purpose | Color Theme | SVG Description |
|------|-----------|---------|-------------|-----------------|
| Leverage | `LeverageIcon` | Leverage trading features | Orange | Trending up arrow |
| Long & Short | `LongShortIcon` | Trade notifications, positions | Green | Up/down arrows |
| Market Orders | `MarketOrdersIcon` | Order notifications, instant execution | Primary/Cyan | Clock |
| Stop Loss | `StopLossIcon` | Stop loss features & notifications | Red | Circle with slash (protection) |
| Take Profit | `TakeProfitIcon` | Take profit features & notifications | Green | Dollar sign in circle |
| Flip Position | `FlipPositionIcon` | Position reversal | Primary/Cyan | Reversing arrows |

### Fight Icons

| Icon | Component | Purpose | Color Theme | SVG Description |
|------|-----------|---------|-------------|-----------------|
| Fight Capital Limit | `FightCapitalLimitIcon` | Fair fight capital limits | Violet | Balance/scales |
| Fight Banner | `FightBannerIcon` | Fight notifications, live status | Orange | Lightning bolt |
| Fight Only Filter | `FightOnlyFilterIcon` | Fight-only position filter | Violet | Filter funnel |

### System Icons

| Icon | Component | Purpose | Color Theme | SVG Description |
|------|-----------|---------|-------------|-----------------|
| Deposit/Withdraw | `DepositWithdrawIcon` | Fund management | Green | Credit card |
| Prize | `PrizeIcon` | Prize claims, rewards | Yellow/Gold | Trophy |
| Info | `InfoIcon` | Generic system notifications | Surface/Gray | Circle with info |
| Bell | `BellIcon` | Notification bell button | N/A | Bell |

## Usage

### Import Icons

```typescript
import {
  TakeProfitIcon,
  StopLossIcon,
  LongShortIcon
} from '@/components/icons/FeatureIcons';
```

### Use in Components

```typescript
// Simple usage
<TakeProfitIcon className="w-5 h-5 text-green-400" />

// With wrapper (like notifications)
<div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
  <TakeProfitIcon className="w-4 h-4 text-green-400" />
</div>
```

## Files Using Centralized Icons

1. **apps/web/src/components/NotificationBell.tsx**
   - Uses: `LongShortIcon`, `MarketOrdersIcon`, `TakeProfitIcon`, `StopLossIcon`, `FightBannerIcon`, `InfoIcon`, `BellIcon`
   - Purpose: Display correct icons for different notification types

2. **apps/web/src/components/landing/MobileAppSection.tsx**
   - Uses: All trading and fight icons
   - Purpose: Display feature cards on landing page

## Notification Type to Icon Mapping

| Notification Type | Icon Component | Color Theme | Description |
|-------------------|----------------|-------------|-------------|
| `TRADE` | `LongShortIcon` | Green (bg-green-500/20) | Long/short position trades |
| `ORDER` | `MarketOrdersIcon` | Primary/Cyan (bg-primary-500/20) | Market order executions |
| `TAKE_PROFIT` | `TakeProfitIcon` | Green (bg-green-500/20) | Take profit triggers |
| `STOP_LOSS` | `StopLossIcon` | Red (bg-red-500/20) | Stop loss triggers |
| `LEVERAGE` | `LeverageIcon` | Orange (bg-orange-500/20) | Leverage changes/warnings |
| `FLIP_POSITION` | `FlipPositionIcon` | Primary/Cyan (bg-primary-500/20) | Position reversals |
| `DEPOSIT` | `DepositWithdrawIcon` | Green (bg-green-500/20) | Deposit confirmations |
| `WITHDRAW` | `DepositWithdrawIcon` | Green (bg-green-500/20) | Withdrawal confirmations |
| `FIGHT` | `FightBannerIcon` | Orange (bg-orange-500/20) | Fight status updates |
| `FIGHT_LIMIT` | `FightCapitalLimitIcon` | Violet (bg-violet-500/20) | Fight capital limit alerts |
| `PRIZE_CLAIMED` | `PrizeIcon` | Yellow (bg-yellow-500/20) | Prize claimed notifications |
| default | `InfoIcon` | Gray (bg-surface-600) | Generic system notifications |

## Adding New Icons

1. Add the icon component to `apps/web/src/components/icons/FeatureIcons.tsx`
2. Include JSDoc documentation with:
   - Purpose/usage description
   - Color theme
   - Example of where it's used
3. Export the component
4. Update this documentation file
5. Use the icon in your components via import

## Important Rules

1. **NEVER** create duplicate icon definitions in other files
2. **ALWAYS** import icons from `@/components/icons/FeatureIcons`
3. **DOCUMENT** any new icons you add with JSDoc comments
4. **TEST** icons in both landing page and notifications to ensure consistency
5. If you need to modify an icon, update it in `FeatureIcons.tsx` only

## Color Themes

Icons use these color themes for consistency:

- **Orange**: Leverage, Fight Banner (warning/action)
- **Green**: Long/Short trades, Take Profit, Deposit/Withdraw (success/profit)
- **Red**: Stop Loss (danger/protection)
- **Primary/Cyan**: Market Orders, Flip Position (primary actions)
- **Violet**: Fight Capital Limit, Fight Only Filter (special fight features)
- **Yellow/Gold**: Prize (rewards/achievements)
- **Gray**: System/Info (neutral information)

## Visual Reference

See the landing page demo section (`/#demo`) for a visual reference of all icons in action.

## Related Files

- Icon definitions: [apps/web/src/components/icons/FeatureIcons.tsx](../apps/web/src/components/icons/FeatureIcons.tsx)
- Notification usage: [apps/web/src/components/NotificationBell.tsx](../apps/web/src/components/NotificationBell.tsx)
- Landing page usage: [apps/web/src/components/landing/MobileAppSection.tsx](../apps/web/src/components/landing/MobileAppSection.tsx)
