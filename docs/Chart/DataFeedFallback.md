# Chart Data Feed Fallback System

## Problem

Pacifica API solo tiene datos de velas/candles desde **Junio 2025**. Los usuarios necesitan ver históricos más largos para análisis técnico profesional (medias móviles de 200 periodos, etc.).

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ChartDataAggregator                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Priority-based Data Resolution              │   │
│  │                                                          │   │
│  │  1. Pacifica API (Jun 2025+) ← Primary for recent data  │   │
│  │  2. Binance API (Years+)     ← Fallback for history     │   │
│  │  3. Bybit API (backup)       ← Secondary fallback       │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Smart Caching Layer (Redis)                │   │
│  │  - Cache historical data permanently (immutable)         │   │
│  │  - Cache recent data with TTL (5min for 1m candles)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Unified Response Format                     │   │
│  │  { t, o, h, l, c, v } - Same as Pacifica format         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Sources

### 1. Pacifica API (Primary - Current)
- **Coverage**: Jun 2025 - Present
- **Cost**: Free (already integrated)
- **Use for**: Real-time data, recent candles
- **Endpoint**: `https://api.pacifica.fi/api/v1/kline`

### 2. Binance Futures API (Secondary - Historical)
- **Coverage**: 2019 - Present (6+ years)
- **Symbols**: BTC, ETH, SOL, DOGE, XRP, LINK, etc.
- **Intervals**: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
- **Rate Limit**: 1200 req/min
- **Endpoint**: `GET https://fapi.binance.com/fapi/v1/klines`
- **Cost**: Free

### 3. Bybit API (Tertiary - Backup)
- **Coverage**: 2020 - Present
- **Symbols**: Major perpetuals
- **Rate Limit**: 1000 candles per request
- **Cost**: Free

## Symbol Mapping

| TFC Symbol | Pacifica | Binance Futures | Bybit |
|------------|----------|-----------------|-------|
| BTC-USD    | BTC      | BTCUSDT         | BTCUSDT |
| ETH-USD    | ETH      | ETHUSDT         | ETHUSDT |
| SOL-USD    | SOL      | SOLUSDT         | SOLUSDT |
| DOGE-USD   | DOGE     | DOGEUSDT        | DOGEUSDT |
| XRP-USD    | XRP      | XRPUSDT         | XRPUSDT |
| LINK-USD   | LINK     | LINKUSDT        | LINKUSDT |
| AVAX-USD   | AVAX     | AVAXUSDT        | AVAXUSDT |
| SUI-USD    | SUI      | SUIUSDT         | SUIUSDT |
| KPEPE-USD  | 1000PEPE | 1000PEPEUSDT    | 1000PEPEUSDT |
| WIF-USD    | WIF      | WIFUSDT         | WIFUSDT |

## Files to Create (Backend - apps/api)

```
apps/api/src/lib/chart-data/
├── types.ts                    # Candle interface, DataSource interface
├── symbolMapping.ts            # TFC → Exchange symbol conversion
├── ChartDataAggregator.ts      # Main orchestrator
├── adapters/
│   ├── BinanceAdapter.ts       # Normaliza formato Binance
│   ├── BybitAdapter.ts         # Normaliza formato Bybit
│   └── PacificaAdapter.ts      # Normaliza formato Pacifica
└── sources/
    ├── BinanceSource.ts        # Binance Futures API client
    ├── BybitSource.ts          # Bybit API client
    └── PacificaSource.ts       # Pacifica API client

apps/api/src/routes/
└── chart-data.ts               # GET /api/chart/candles endpoint
```

## Files to Modify (Frontend - apps/web)

```
apps/web/src/hooks/useCandles.ts           # Use new backend endpoint
apps/web/src/lib/tradingview/PacificaDatafeed.ts  # Use new backend endpoint
```

## Implementation Details

### 1. Unified Candle Type (`types.ts`)

```typescript
export interface Candle {
  t: number;  // timestamp (ms)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

export interface DataSource {
  name: string;
  fetchCandles(symbol: string, interval: string, start: number, end: number): Promise<Candle[]>;
  getHistoricalStart(): Date;
}

export type Interval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';
```

### 2. Data Adapters

Each source returns data in different formats. Adapters normalize to unified format:

```typescript
// BinanceAdapter.ts
// Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
export function adaptBinanceCandle(raw: any[]): Candle {
  return {
    t: raw[0],
    o: parseFloat(raw[1]),
    h: parseFloat(raw[2]),
    l: parseFloat(raw[3]),
    c: parseFloat(raw[4]),
    v: parseFloat(raw[5]),
  };
}

// BybitAdapter.ts
// Bybit format: [startTime, open, high, low, close, volume, turnover]
export function adaptBybitCandle(raw: string[]): Candle {
  return {
    t: parseInt(raw[0]),
    o: parseFloat(raw[1]),
    h: parseFloat(raw[2]),
    l: parseFloat(raw[3]),
    c: parseFloat(raw[4]),
    v: parseFloat(raw[5]),
  };
}

// PacificaAdapter.ts
// Pacifica format: { t, T, o, h, l, c, v, n }
export function adaptPacificaCandle(raw: any): Candle {
  return {
    t: raw.t,
    o: parseFloat(raw.o),
    h: parseFloat(raw.h),
    l: parseFloat(raw.l),
    c: parseFloat(raw.c),
    v: parseFloat(raw.v),
  };
}
```

### 3. ChartDataAggregator Logic

```typescript
export class ChartDataAggregator {
  private pacificaStartDate = new Date('2025-06-01');

  async getCandles(symbol: string, interval: string, start: number, end: number): Promise<Candle[]> {
    const pacificaStart = this.pacificaStartDate.getTime();

    // Case 1: All data within Pacifica range (Jun 2025+)
    if (start >= pacificaStart) {
      return this.fetchFromPacifica(symbol, interval, start, end);
    }

    // Case 2: Split request - historical from Binance + recent from Pacifica
    const historicalEnd = Math.min(end, pacificaStart);
    const recentStart = pacificaStart;

    const [historical, recent] = await Promise.all([
      this.fetchHistorical(symbol, interval, start, historicalEnd),
      end > pacificaStart
        ? this.fetchFromPacifica(symbol, interval, recentStart, end)
        : Promise.resolve([])
    ]);

    return this.mergeCandles(historical, recent);
  }

  private async fetchHistorical(symbol, interval, start, end): Promise<Candle[]> {
    // Try Binance first, fallback to Bybit
    try {
      return await binanceSource.fetchCandles(symbol, interval, start, end);
    } catch (error) {
      console.warn('Binance failed, trying Bybit:', error);
      return await bybitSource.fetchCandles(symbol, interval, start, end);
    }
  }

  private mergeCandles(historical: Candle[], recent: Candle[]): Candle[] {
    const map = new Map<number, Candle>();
    historical.forEach(c => map.set(c.t, c));
    recent.forEach(c => map.set(c.t, c)); // Recent overwrites historical
    return Array.from(map.values()).sort((a, b) => a.t - b.t);
  }
}
```

### 4. API Endpoint

```typescript
// apps/api/src/routes/chart-data.ts
router.get('/api/chart/candles', async (req, res) => {
  const { symbol, interval, start, end } = req.query;

  const aggregator = new ChartDataAggregator();
  const candles = await aggregator.getCandles(
    symbol as string,
    interval as string,
    parseInt(start as string),
    parseInt(end as string)
  );

  res.json({ success: true, data: candles });
});
```

### 5. Frontend Integration

Update `useCandles.ts` to call backend:

```typescript
const fetchHistoricalCandles = async () => {
  const endTime = Date.now();
  const startTime = endTime - getInitialDays() * 24 * 60 * 60 * 1000;

  const response = await fetch(
    `/api/chart/candles?symbol=${symbol}&interval=${interval}&start=${startTime}&end=${endTime}`
  );
  const { data } = await response.json();

  // Convert to lightweight-charts format
  return data.map((c: Candle) => ({
    time: Math.floor(c.t / 1000) as UTCTimestamp,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
};
```

## Interval Mapping

| TFC/Pacifica | Binance | Bybit |
|--------------|---------|-------|
| 1m           | 1m      | 1     |
| 3m           | 3m      | 3     |
| 5m           | 5m      | 5     |
| 15m          | 15m     | 15    |
| 30m          | 30m     | 30    |
| 1h           | 1h      | 60    |
| 2h           | 2h      | 120   |
| 4h           | 4h      | 240   |
| 8h           | 8h      | 480   |
| 12h          | 12h     | 720   |
| 1d           | 1d      | D     |

## Caching Strategy

```typescript
// Historical data (before Jun 2025) - cache forever (immutable)
if (end < pacificaStartDate) {
  await redis.set(cacheKey, JSON.stringify(candles));
}

// Recent data - short TTL based on interval
const ttl = interval === '1m' ? 60 : interval === '5m' ? 300 : 600;
await redis.setex(cacheKey, ttl, JSON.stringify(candles));
```

## Testing Checklist

1. **Historical Data Test**
   - Open BTC-USD chart on 1D timeframe
   - Scroll left past June 2025
   - Verify candles load from Binance (check Network tab)
   - Verify no gaps between Binance and Pacifica data

2. **Symbol Coverage Test**
   - Test all major symbols: BTC, ETH, SOL, DOGE
   - Verify symbol mapping works correctly

3. **Interval Test**
   - Test intervals: 1m, 5m, 15m, 1h, 4h, 1d
   - Verify data loads correctly for each

4. **Fallback Test**
   - Simulate Binance failure
   - Verify fallback to Bybit works

5. **Performance Test**
   - Measure initial load time
   - Verify smooth infinite scroll

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Binance rate limits (1200/min) | Request queuing, aggressive caching |
| Symbol not on Binance | Bybit fallback, warning for unavailable history |
| Price differences between exchanges | Pacifica is source of truth for Jun 2025+ |
| CORS issues | Backend proxy handles all external calls |

## API Response Formats Reference

### Binance Futures Klines
```
GET /fapi/v1/klines?symbol=BTCUSDT&interval=1h&startTime=X&endTime=Y&limit=1500

Response: [
  [
    1499040000000,      // Open time
    "0.01634000",       // Open
    "0.80000000",       // High
    "0.01575800",       // Low
    "0.01577100",       // Close
    "148976.11427815",  // Volume
    1499644799999,      // Close time
    "2434.19055334",    // Quote asset volume
    308,                // Number of trades
    "1756.87402397",    // Taker buy base asset volume
    "28.46694368",      // Taker buy quote asset volume
    "0"                 // Ignore
  ]
]
```

### Bybit Klines
```
GET /v5/market/kline?category=linear&symbol=BTCUSDT&interval=60&start=X&end=Y

Response: {
  "result": {
    "list": [
      [
        "1670608800000",  // startTime
        "17071",          // openPrice
        "17073",          // highPrice
        "17027",          // lowPrice
        "17055.5",        // closePrice
        "268611",         // volume
        "15.86175288"     // turnover
      ]
    ]
  }
}
```

### Pacifica Klines
```
GET /api/v1/kline?symbol=BTC&interval=1h&start_time=X&end_time=Y

Response: {
  "success": true,
  "data": [
    {
      "t": 1499040000000,  // open time (ms)
      "T": 1499043599999,  // close time (ms)
      "s": "BTC",          // symbol
      "i": "1h",           // interval
      "o": "0.01634000",   // open
      "c": "0.01577100",   // close
      "h": "0.80000000",   // high
      "l": "0.01575800",   // low
      "v": "148976.11",    // volume
      "n": 308             // number of trades
    }
  ]
}
```

## Current Implementation Status

- [ ] Create types.ts
- [ ] Create symbolMapping.ts
- [ ] Create adapters (Binance, Bybit, Pacifica)
- [ ] Create BinanceSource.ts
- [ ] Create BybitSource.ts
- [ ] Create PacificaSource.ts
- [ ] Create ChartDataAggregator.ts
- [ ] Create API endpoint /api/chart/candles
- [ ] Update useCandles hook
- [ ] Test with BTC-USD chart
