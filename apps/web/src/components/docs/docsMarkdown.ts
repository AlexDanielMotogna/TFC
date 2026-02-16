export const DOCS_MARKDOWN = `# Trading Fight Club -- User Guide

---

## What is Trading Fight Club

Trading Fight Club is a competitive trading platform where you go head-to-head against another trader in real-time. Both players stake the same amount of USDC, trade perpetual futures on 40+ markets, and the one with the best return on investment (ROI%) at the end of the timer wins.

All trading happens on Pacifica, a decentralized perpetuals exchange on Solana. Trading Fight Club never holds your funds -- it provides the competitive layer, live scoreboard, leaderboards, prizes, and referral rewards on top of the trading infrastructure.

### What You Can Do

- Trade 40+ perpetual futures markets (crypto, stocks, forex) with up to 50x leverage
- Challenge other traders to 1v1 duels with stakes from $100 to $5,000 USDC
- Watch your fight unfold in real-time with live PnL tracking
- Climb the weekly leaderboard and earn prizes from the prize pool
- Invite friends with your referral code and earn commissions on their trades

---

## Getting Started

### Step 1 -- Connect Your Wallet

Click "Join Beta" on the landing page. You will be prompted to connect a Solana wallet. Supported wallets include Phantom, Solflare, Backpack, and any Solana-compatible mobile wallet.

No email or password is needed. Your wallet is your identity.

### Step 2 -- Beta Access

Trading Fight Club is currently in beta. After connecting your wallet:

- If you have not applied yet, you will see an "Apply for Beta Access" form.
- Once submitted, your application will be reviewed. The page auto-refreshes every 30 seconds, or you can click "Check Access" manually.
- For faster approval, follow the instructions on screen to engage with the project on X (Twitter).
- Once approved, you gain full access to the platform.

### Step 3 -- Link Your Pacifica Account

To trade, you need a Pacifica account with deposited USDC. The platform will guide you through linking your Pacifica trading account.

Once linked, you are ready to trade and fight.

### Step 4 -- Deposit Funds

Make sure you have USDC deposited in your Pacifica account. You can deposit directly through the platform using the "Deposit" button on the trading page. Your balance, equity, and available margin are displayed at all times.

---

## Trading

Trading Fight Club gives you access to a full-featured trading terminal powered by Pacifica.

### Available Markets

Over 40 perpetual futures contracts are available, including:

- **Crypto**: BTC, ETH, SOL, and popular memecoins
- **Stocks**: TSLA, NVDA, and others
- **Forex**: Major currency pairs

### Order Types

| Order Type | How It Works |
|---|---|
| Market | Executes immediately at the best available price |
| Limit | Executes only when the market reaches your specified price |
| Stop Market | Places a market order when the price hits your trigger level |
| Stop Limit | Places a limit order when the price hits your trigger level |

### Leverage

You can trade with leverage from 1x up to 50x, depending on the market. Set your desired leverage before placing an order. You can also switch between Cross and Isolated margin modes.

### Risk Management

- **Take Profit (TP)**: Automatically close your position when it reaches a target profit level.
- **Stop Loss (SL)**: Automatically close your position to limit losses if the price moves against you.
- **Reduce Only**: Place orders that can only reduce your current position, not open a new one.
- **Partial TP/SL**: Set multiple take profit and stop loss levels at different amounts.

### Order Size

- The minimum order size is $11 USDC.
- The size input shows both the token amount and the USD equivalent.
- Prices are automatically rounded to valid increments for each market.

### Stop Order Direction

Stop orders follow standard exchange rules:

- **Buy Stop (Long)**: Your trigger price must be above the current market price. The order triggers when the price rises to your level.
- **Sell Stop (Short)**: Your trigger price must be below the current market price. The order triggers when the price drops to your level.

If you want to enter a long position below the current price, use a Limit order instead.

### Charts and Order Book

The trading page includes:

- **TradingView-style candlestick charts** with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, and more)
- **Live order book** showing real-time bid and ask levels
- **Recent trades** feed
- **Real-time price updates** refreshing every second

### Managing Positions

Your open positions are displayed below the chart showing:

- Entry price and current price
- Unrealized PnL in USDC and percentage
- Leverage and margin used
- Estimated liquidation price

You can close positions with a market or limit order, set or modify TP/SL, and adjust margin.

---

## Fights (1v1 Duels)

Fights are the core of Trading Fight Club. Two traders stake the same amount, trade for a set duration, and the one with the higher ROI% wins.

### Creating a Fight

1. Go to the Arena page and click "Create Fight".
2. Choose your **duration**: 5, 15, 30, 60, 120, or 240 minutes.
3. Choose your **stake**: $100, $250, $500, $1,000, $2,500, or $5,000 USDC.
4. Confirm and your fight will appear in the Arena as "Pending".
5. Your fight will wait up to 15 minutes for an opponent. If no one joins, it is automatically cancelled.

### Joining a Fight

Browse the Arena for pending fights. Click "Join Fight" on any open fight that matches your preferred stake and duration. The fight begins immediately once you join.

### During a Fight

Once a fight is live:

- **Trade freely** on any market using market, limit, stop, or stop-limit orders.
- **Live scoreboard** shows both your PnL% and your opponent's PnL% updating every second.
- **Performance chart** plots both players' PnL over time so you can see who is leading.
- **Fight timer** counts down the remaining time.
- **Fight Capital** panel shows how much of your stake you have used and how much is still available.
- A **30-second warning** appears before the fight ends.

### Stake Limit (Fight Capital)

During a fight, your trading is limited to the stake amount. The system tracks your capital usage:

- When you open a position, that notional value is counted against your stake.
- When you close a position, that capital becomes available again for new trades.
- The total capital you have ever committed during the fight cannot exceed the stake.

For example, with a $100 stake:

- You open a $60 position. Available: $40.
- You close the $60 position. Available: $40 (not $100 -- the $60 high-water mark is remembered).
- You can open a new position up to $40.

### Blocked Symbols

If you have open positions on Pacifica before a fight starts, those symbols are blocked during the fight. This prevents pre-positioned advantages. Close any unwanted positions before creating or joining a fight.

### How the Winner is Decided

- Only **closed positions** count. If you have open positions when the timer ends, their unrealized PnL does not count.
- The winner is determined by **ROI%**, not absolute dollar PnL. This keeps fights fair regardless of how much of your stake you used.
- Trading fees are included in the PnL calculation.
- If both players finish with nearly identical ROI% (within 0.0001%), the fight is a draw.
- If one player did not trade and the other had a loss, the player who did not trade wins.

### Fight Statuses

| Status | Meaning |
|---|---|
| PENDING | Waiting for an opponent to join (up to 15 minutes) |
| LIVE | Fight is in progress |
| FINISHED | Fight ended normally with a winner (or draw) |
| NO CONTEST | Fight was invalidated by the anti-cheat system |
| CANCELLED | Fight was cancelled before starting |

### Fight Results

After a fight ends, you can view the detailed results page showing:

- Both players' final PnL% and USDC results
- Number of trades each player made
- Complete trade history with symbols, sides, sizes, prices, and fees
- ROI breakdown

---

## Arena

The Arena is your hub for finding and managing fights. It has four tabs:

| Tab | What It Shows |
|---|---|
| LIVE | Fights currently in progress with real-time PnL updates |
| PENDING | Fights waiting for an opponent -- join one or create your own |
| FINISHED | Recently completed fights with results |
| MY FIGHTS | Your personal fight history |

Fight cards in the Arena show the participants, stake amount, duration, and current status. Click any fight to view its details or spectate a live fight.

---

## Leaderboard

The leaderboard ranks all fighters by performance. There are two views:

### This Week

Rankings for the current week (Monday to Sunday UTC). Stats cards at the top show:

- Total fighters on the leaderboard
- Weekly fees collected across the platform
- Current prize pool (10% of fees)
- Time remaining until the week resets

### All Time

Cumulative rankings across all weeks since launch.

### Rankings Table

The leaderboard displays:

| Column | Description |
|---|---|
| Rank | Position with medal icons for top 3 |
| Fighter | Username and avatar |
| Fights | Total fights participated |
| Record | Wins / Losses / Draws |
| Win Rate | Visual progress bar showing win percentage |
| Avg PnL | Average PnL% per fight |
| Total PnL | Cumulative PnL in USDC |

The top 3 fighters are highlighted in a podium display at the top of the page.

---

## Weekly Prizes

Every week, 10% of all platform trading fees are distributed as prizes to the top 3 traders on the weekly leaderboard.

### Prize Distribution

| Place | Share of Weekly Fees |
|---|---|
| 1st | 5% |
| 2nd | 3% |
| 3rd | 2% |

### How It Works

1. Throughout the week, trading fees accumulate in the prize pool.
2. On Sunday at midnight UTC, the week is finalized.
3. The top 3 fighters from the weekly leaderboard receive their prizes.
4. Prizes appear on the **Rewards** page with status "Ready to Claim".
5. Click "Claim" to receive your prize as a USDC transfer to your Solana wallet.
6. Once claimed, you can view the on-chain transaction on Solscan.

### Rewards Page

Your Rewards page shows:

- **Current Standing**: Your rank if you are in the top 3 and estimated prize amount.
- **Total Prizes**: How many prizes you have won.
- **Total Earned**: Sum of all prize amounts.
- **Prize History**: A table of every prize with rank, week period, amount, status, and claim button.

---

## Referral Program

Earn commissions when the traders you refer place trades on the platform.

### How to Refer

1. Go to the **Referrals** page.
2. Copy your unique referral code or referral link.
3. Share it with friends and other traders.
4. When they sign up using your link and start trading, you earn commissions.

### Commission Tiers

Trading Fight Club has a three-tier referral structure:

| Tier | Relationship | Commission |
|---|---|---|
| Tier 1 | Users you directly referred | 34% of their trading fees |
| Tier 2 | Users referred by your Tier 1 referrals | 12% of their trading fees |
| Tier 3 | Users referred by your Tier 2 referrals | 4% of their trading fees |

### Claiming Earnings

- Your accumulated referral earnings are shown on the dashboard.
- When your balance reaches the minimum payout threshold ($10 USDC), the "Claim Payout" button becomes active.
- Click "Claim" to receive your earnings as a USDC transfer to your Solana wallet.
- Payout history with transaction links is available in the Payouts tab.

### Referral Dashboard

The referral page has three tabs:

- **Overview**: Recent referrals and recent earnings at a glance.
- **Referrals**: Full list of everyone you have referred, with their tier and join date.
- **Payouts**: Complete payout history with status (Completed, Processing, Pending, Failed) and on-chain transaction links.

---

## Fees

### Trading Fees

| Fee Type | Rate |
|---|---|
| Maker Fee (Pacifica) | ~0.065% |
| Taker Fee (Pacifica) | ~0.090% |
| TFC Platform Fee | 0.05% |

The TFC platform fee is applied automatically through the Pacifica Builder Code system. Total cost per trade is the Pacifica fee plus the 0.05% TFC fee.

### Where Fees Go

- 90% of TFC platform fees are retained by the platform.
- 10% of weekly fees are redistributed as prizes to the top 3 weekly performers.
- Referral commissions are paid from the TFC platform fee portion.

---

## Fair Play and Anti-Cheat

Trading Fight Club has a built-in anti-cheat system that validates every fight at settlement. This ensures all competitions are fair.

### Rules

**No Idle Fights**: If neither player trades or both finish with near-zero PnL, the fight is declared "No Contest". You must actively trade to compete.

**Minimum Volume**: Each participant must trade at least $10 notional during the fight. Fights with insufficient activity are flagged.

**No External Trading**: All trades during a fight must go through Trading Fight Club. If the system detects trades executed directly on Pacifica outside the platform during your fight, you will be disqualified and your opponent wins.

**Matchup Limits**: The same two players cannot fight more than 10 times in a 24-hour period. This prevents collusion and wash trading.

**IP Monitoring**: If both participants in a fight repeatedly share the same IP address, those fights may be declared "No Contest".

### What Happens on Violation

- Fights with violations are marked as "No Contest" -- no winner is declared.
- If only one player cheated (e.g., external trades), the other player wins.
- If both players cheated, the fight is "No Contest".
- All violations are logged and may result in account restrictions.

---

## Security and Privacy

### Non-Custodial

Trading Fight Club never holds your funds. All your capital stays in your Pacifica account on the Solana blockchain. The platform only facilitates the competitive layer.

### Wallet-Based Authentication

Your Solana wallet is your login. No passwords are stored. Authentication works by signing a message with your wallet, which the platform verifies cryptographically.

### Trading Security

- All trade executions are signed server-side with expiry windows to prevent replay attacks.
- Your private keys are never exposed to the frontend.
- The platform proxies all trading requests through its backend, adding an extra layer of security.

### Data Privacy

- Your wallet address is public (as it is on any blockchain).
- IP addresses are collected only for anti-cheat purposes and are never exposed through the platform.
- Trading data is not shared with third parties.

---

## Frequently Asked Questions

**Do I need to deposit funds into Trading Fight Club?**

No. Your funds stay in your Pacifica account. Trading Fight Club connects to Pacifica and places trades on your behalf. You deposit and withdraw directly to and from Pacifica.

**Is Trading Fight Club custodial?**

No. The platform never holds your funds. All trading occurs on the Pacifica decentralized exchange.

**What happens to my open positions when a fight ends?**

Open positions at the end of a fight do not count toward your fight PnL. Only positions you closed during the fight window are used for the ROI calculation. Your positions remain open on Pacifica after the fight.

**Can I trade when I am not in a fight?**

Yes. When you are not in an active fight, you can trade freely without any capital restrictions.

**What if both players do not trade?**

The fight is declared "No Contest". No winner is determined.

**How are winners decided?**

By ROI percentage, not dollar amount. If you used $50 of your $100 stake and made $5, your ROI is 10%. If your opponent used the full $100 and made $8, their ROI is 8%. You win.

**What wallets work with Trading Fight Club?**

Any Solana-compatible wallet: Phantom, Solflare, Backpack, and mobile wallets.

**What is the minimum trade size?**

$11 USDC notional value per order.

**What is the minimum referral payout?**

$10 USDC. Once your accumulated referral earnings reach this threshold, you can claim them.

**Can I be in more than one fight at a time?**

No. You can only participate in one active fight at a time. You can also have one pending fight waiting for an opponent.

**What happens if a fight has a "No Contest" result?**

No winner is declared. This typically happens when anti-cheat rules detect a violation, or when neither player actively traded.

**How long do pending fights last?**

A fight waiting for an opponent will automatically cancel after 15 minutes if no one joins.

**Can I cancel a fight I created?**

Pending fights that have not been joined can be cancelled. Once an opponent joins and the fight goes live, it cannot be cancelled.

**Where can I see my fight history?**

In the Arena under the "My Fights" tab, or on your profile page.

**How do I withdraw my earnings?**

Prize and referral payouts are sent directly to your Solana wallet as USDC. You can withdraw funds from your Pacifica trading account using the "Withdraw" button on the trading page.
`;
