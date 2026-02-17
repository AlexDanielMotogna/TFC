/**
 * Prompt Builder
 * Constructs the system and user prompts for Claude.
 * Formats market data and instructs Claude to return actionable trading signals.
 */

import type { MarketDataBundle, RiskProfile, CandleData, OpenPosition } from './types/AiBias.types';

const MAX_PROMPT_CHARS = 14_000; // Safety limit on prompt size

const SYSTEM_PROMPT = `You are a quantitative trading signal analyst. You analyze multi-timeframe market data and produce actionable trading signals.

CRITICAL RULES — you must follow these exactly:
1. You MUST output one of three signals: LONG, SHORT, or STAY_OUT.
2. For LONG or SHORT signals: provide exact entry price, stop loss, take profit, suggested leverage, and risk percentage.
3. For STAY_OUT signals: set entry, stopLoss, takeProfit, suggestedLeverage, and riskPercent all to 0.
4. confidence must be an integer between 0 and 100.
5. NEVER use these words: "guaranteed", "will happen", "definitely", "certainly", "risk-free".
6. Stop loss placement must respect support/resistance levels from the candle data.
7. The risk/reward ratio must be at least 1.5:1 for any LONG or SHORT signal. If no setup has adequate R:R, output STAY_OUT.
8. For LONG signals: stopLoss < entry < takeProfit.
9. For SHORT signals: takeProfit < entry < stopLoss.
10. Include the disclaimer in every response.
11. If the user has open positions, provide specific advice for EACH position in the positionAdvice array.
12. positionAdvice actions: HOLD (keep position), CLOSE (exit now), ADD (increase size), REDUCE (decrease size), MOVE_SL (adjust stop loss).
13. If the user has no open positions, positionAdvice must be an empty array [].
14. Keep ALL "detail" strings under 300 characters. Be concise.

You analyze: trend direction across timeframes, volume patterns, funding rates, open interest, order book imbalances, support/resistance from candle structures, AND the user's current open positions.

OUTPUT FORMAT: You must respond with valid JSON only, no markdown, no explanation outside the JSON.`;

const RISK_INSTRUCTIONS: Record<RiskProfile, string> = {
  conservative: `Conservative profile:
- Only signal LONG or SHORT when 3+ indicators align strongly.
- Default to STAY_OUT when uncertain.
- Wider stop losses at key structural levels.
- Leverage: 1x to 3x maximum.
- Risk per trade: 1-2% of portfolio.
- Minimum confidence threshold: 70%.`,

  moderate: `Moderate profile:
- Signal LONG or SHORT when 2+ indicators align.
- Balanced stop losses.
- Leverage: 3x to 5x maximum.
- Risk per trade: 2-3% of portfolio.
- Minimum confidence threshold: 55%.`,

  aggressive: `Aggressive profile:
- Signal LONG or SHORT on a single strong indicator if conviction is high.
- Tighter stop losses closer to entry.
- Leverage: 5x to 10x maximum.
- Risk per trade: 3-5% of portfolio.
- Minimum confidence threshold: 40%.`,
};

export class PromptBuilder {
  /**
   * Build the system prompt (static, cacheable by Claude API).
   */
  static buildSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  /**
   * Build the user prompt with market data, risk profile, and open positions.
   */
  static buildUserPrompt(data: MarketDataBundle, riskProfile: RiskProfile, openPositions?: OpenPosition[]): string {
    const { snapshot, candles1h, candles4h, candles1d, orderbook } = data;

    const sections = [
      `ANALYZE: ${snapshot.symbol}`,
      `RISK PROFILE: ${riskProfile.toUpperCase()}`,
      RISK_INSTRUCTIONS[riskProfile],
      '',
      '--- CURRENT MARKET ---',
      `Price: ${snapshot.currentPrice}`,
      `Mark: ${snapshot.markPrice}`,
      `24h Change: ${snapshot.change24h.toFixed(2)}%`,
      `24h Volume: $${formatLargeNumber(snapshot.volume24h)}`,
      `Open Interest: $${formatLargeNumber(snapshot.openInterest)}`,
      `Funding Rate: ${(snapshot.fundingRate * 100).toFixed(4)}%`,
      '',
      '--- 1H CANDLES (last 20) ---',
      formatCandles(candles1h.slice(-20)),
      '',
      '--- 4H CANDLES (last 10) ---',
      formatCandles(candles4h.slice(-10)),
      '',
      '--- 1D CANDLES (last 7) ---',
      formatCandles(candles1d.slice(-7)),
      '',
      '--- ORDER BOOK (top 5 each side) ---',
      `Bids: ${orderbook.bids.slice(0, 5).map(([p, s]) => `${p}@${s.toFixed(2)}`).join(', ')}`,
      `Asks: ${orderbook.asks.slice(0, 5).map(([p, s]) => `${p}@${s.toFixed(2)}`).join(', ')}`,
    ];

    // Add open positions section if user has any
    if (openPositions && openPositions.length > 0) {
      sections.push('');
      sections.push('--- USER OPEN POSITIONS ---');
      sections.push('Analyze each position and provide specific advice in positionAdvice array.');
      for (const pos of openPositions) {
        const pnl = parseFloat(pos.unrealizedPnl);
        const pnlSign = pnl >= 0 ? '+' : '';
        sections.push(
          `${pos.symbol} ${pos.side} | Size: ${pos.size} | Entry: $${pos.entryPrice} | Mark: $${pos.markPrice} | Lev: ${pos.leverage}x | PnL: ${pnlSign}$${pos.unrealizedPnl} | Liq: $${pos.liquidationPrice}`
        );
      }
    } else {
      sections.push('');
      sections.push('--- USER OPEN POSITIONS ---');
      sections.push('No open positions. positionAdvice must be an empty array [].');
    }

    sections.push('');
    sections.push('--- REQUIRED JSON OUTPUT ---');
    sections.push(JSON.stringify({
      signal: 'LONG | SHORT | STAY_OUT',
      confidence: 'integer 0-100',
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      suggestedLeverage: 0,
      riskPercent: 0,
      summary: '2-3 sentences explaining the signal rationale',
      riskProfile,
      keyFactors: [
        { factor: 'Name', bias: 'bullish | bearish | neutral', detail: 'explanation' },
      ],
      positionAdvice: [
        { symbol: 'BTC-USD', action: 'HOLD | CLOSE | ADD | REDUCE | MOVE_SL', detail: 'specific advice for this position' },
      ],
      disclaimer: 'AI-generated trading signal based on publicly available data. Not financial advice. You are 100% responsible for your trading decisions.',
    }, null, 0));

    const prompt = sections.join('\n');

    // Safety: truncate if too large
    if (prompt.length > MAX_PROMPT_CHARS) {
      return prompt.slice(0, MAX_PROMPT_CHARS);
    }

    return prompt;
  }
}

function formatCandles(candles: CandleData[]): string {
  return candles
    .map(c => {
      const date = new Date(c.timestamp).toISOString().slice(0, 16);
      return `${date} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${formatLargeNumber(c.volume)}`;
    })
    .join('\n');
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
