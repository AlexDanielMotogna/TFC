/**
 * Symbol mapping between TFC (BTC-USD) format and exchange-specific formats.
 *
 * TFC uses: BTC-USD, ETH-USD, SOL-USD
 * Pacifica uses: BTC, ETH, SOL
 * Binance uses: BTCUSDT, ETHUSDT, SOLUSDT
 * Bybit uses: BTCUSDT, ETHUSDT, SOLUSDT
 */

interface SymbolMapping {
  pacifica: string;
  binance: string;
  bybit: string;
}

/**
 * Complete symbol mapping for all supported assets.
 * Key is TFC format (e.g., "BTC-USD")
 */
const SYMBOL_MAP: Record<string, SymbolMapping> = {
  // Major coins
  'BTC-USD': { pacifica: 'BTC', binance: 'BTCUSDT', bybit: 'BTCUSDT' },
  'ETH-USD': { pacifica: 'ETH', binance: 'ETHUSDT', bybit: 'ETHUSDT' },
  'SOL-USD': { pacifica: 'SOL', binance: 'SOLUSDT', bybit: 'SOLUSDT' },
  'BNB-USD': { pacifica: 'BNB', binance: 'BNBUSDT', bybit: 'BNBUSDT' },
  'XRP-USD': { pacifica: 'XRP', binance: 'XRPUSDT', bybit: 'XRPUSDT' },
  'DOGE-USD': { pacifica: 'DOGE', binance: 'DOGEUSDT', bybit: 'DOGEUSDT' },
  'ADA-USD': { pacifica: 'ADA', binance: 'ADAUSDT', bybit: 'ADAUSDT' },
  'AVAX-USD': { pacifica: 'AVAX', binance: 'AVAXUSDT', bybit: 'AVAXUSDT' },
  'LINK-USD': { pacifica: 'LINK', binance: 'LINKUSDT', bybit: 'LINKUSDT' },

  // Layer 1s
  'SUI-USD': { pacifica: 'SUI', binance: 'SUIUSDT', bybit: 'SUIUSDT' },
  'APT-USD': { pacifica: 'APT', binance: 'APTUSDT', bybit: 'APTUSDT' },
  'SEI-USD': { pacifica: 'SEI', binance: 'SEIUSDT', bybit: 'SEIUSDT' },
  'TIA-USD': { pacifica: 'TIA', binance: 'TIAUSDT', bybit: 'TIAUSDT' },
  'INJ-USD': { pacifica: 'INJ', binance: 'INJUSDT', bybit: 'INJUSDT' },

  // Layer 2s / Ethereum ecosystem
  'ARB-USD': { pacifica: 'ARB', binance: 'ARBUSDT', bybit: 'ARBUSDT' },
  'OP-USD': { pacifica: 'OP', binance: 'OPUSDT', bybit: 'OPUSDT' },
  'STX-USD': { pacifica: 'STX', binance: 'STXUSDT', bybit: 'STXUSDT' },
  'IMX-USD': { pacifica: 'IMX', binance: 'IMXUSDT', bybit: 'IMXUSDT' },

  // DeFi
  'AAVE-USD': { pacifica: 'AAVE', binance: 'AAVEUSDT', bybit: 'AAVEUSDT' },
  'JUP-USD': { pacifica: 'JUP', binance: 'JUPUSDT', bybit: 'JUPUSDT' },
  'PENDLE-USD': { pacifica: 'PENDLE', binance: 'PENDLEUSDT', bybit: 'PENDLEUSDT' },
  'ENA-USD': { pacifica: 'ENA', binance: 'ENAUSDT', bybit: 'ENAUSDT' },

  // AI / Data
  'RENDER-USD': { pacifica: 'RENDER', binance: 'RENDERUSDT', bybit: 'RENDERUSDT' },
  'FET-USD': { pacifica: 'FET', binance: 'FETUSDT', bybit: 'FETUSDT' },

  // Memecoins
  'WIF-USD': { pacifica: 'WIF', binance: 'WIFUSDT', bybit: 'WIFUSDT' },
  'KPEPE-USD': { pacifica: '1000PEPE', binance: '1000PEPEUSDT', bybit: '1000PEPEUSDT' },
  'WLD-USD': { pacifica: 'WLD', binance: 'WLDUSDT', bybit: 'WLDUSDT' },
  'HYPE-USD': { pacifica: 'HYPE', binance: 'HYPEUSDT', bybit: 'HYPEUSDT' },

  // Other
  'ZEC-USD': { pacifica: 'ZEC', binance: 'ZECUSDT', bybit: 'ZECUSDT' },
  'PAXG-USD': { pacifica: 'PAXG', binance: 'PAXGUSDT', bybit: 'PAXGUSDT' },
};

/**
 * Convert TFC symbol to exchange-specific format.
 * @param tfcSymbol - TFC format symbol (e.g., "BTC-USD")
 * @param source - Target exchange ("binance" | "bybit" | "pacifica")
 * @returns Exchange-specific symbol or null if not found
 */
export function mapSymbol(
  tfcSymbol: string,
  source: 'binance' | 'bybit' | 'pacifica'
): string | null {
  const mapping = SYMBOL_MAP[tfcSymbol];
  if (!mapping) {
    // Try to generate a mapping for unknown symbols
    const base = tfcSymbol.replace('-USD', '');
    if (source === 'pacifica') return base;
    if (source === 'binance' || source === 'bybit') return `${base}USDT`;
    return null;
  }
  return mapping[source];
}

/**
 * Convert Pacifica symbol to TFC format.
 * @param pacificaSymbol - Pacifica format symbol (e.g., "BTC")
 * @returns TFC format symbol (e.g., "BTC-USD")
 */
export function pacificaToTfc(pacificaSymbol: string): string {
  // Find the TFC symbol that maps to this Pacifica symbol
  for (const [tfcSymbol, mapping] of Object.entries(SYMBOL_MAP)) {
    if (mapping.pacifica === pacificaSymbol) {
      return tfcSymbol;
    }
  }
  // Default: add -USD suffix
  if (pacificaSymbol === '1000PEPE') return 'KPEPE-USD';
  return `${pacificaSymbol}-USD`;
}

/**
 * Check if a symbol is supported by a specific exchange.
 */
export function isSymbolSupported(
  tfcSymbol: string,
  source: 'binance' | 'bybit' | 'pacifica'
): boolean {
  const mapping = SYMBOL_MAP[tfcSymbol];
  return mapping !== undefined && mapping[source] !== undefined;
}

/**
 * Get all supported TFC symbols.
 */
export function getAllSymbols(): string[] {
  return Object.keys(SYMBOL_MAP);
}

/**
 * Interval mapping between TFC/Pacifica format and Binance/Bybit formats.
 */
const INTERVAL_MAP: Record<string, { binance: string; bybit: string }> = {
  '1m': { binance: '1m', bybit: '1' },
  '3m': { binance: '3m', bybit: '3' },
  '5m': { binance: '5m', bybit: '5' },
  '15m': { binance: '15m', bybit: '15' },
  '30m': { binance: '30m', bybit: '30' },
  '1h': { binance: '1h', bybit: '60' },
  '2h': { binance: '2h', bybit: '120' },
  '4h': { binance: '4h', bybit: '240' },
  '8h': { binance: '8h', bybit: '480' },
  '12h': { binance: '12h', bybit: '720' },
  '1d': { binance: '1d', bybit: 'D' },
};

/**
 * Convert TFC/Pacifica interval to exchange-specific format.
 */
export function mapInterval(
  interval: string,
  source: 'binance' | 'bybit'
): string {
  const mapping = INTERVAL_MAP[interval];
  if (!mapping) return interval;
  return mapping[source];
}
