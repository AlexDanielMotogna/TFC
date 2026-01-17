'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const PACIFICA_API_BASE = 'https://api.pacifica.fi';
const PACIFICA_WS_URL = 'wss://ws.pacifica.fi/ws';

interface PriceData {
  symbol: string;
  price: number;        // mark price
  oracle: number;       // oracle price
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  funding: number;
  nextFunding: number;
  lastUpdate: number;
  maxLeverage: number;
  tickSize: number;     // tick size for price increments
  lotSize: number;      // lot size for amount increments
}

interface UsePricesOptions {
  symbols?: string[];
}

// Map Pacifica symbol back to our format
const pacificaToSymbol = (pacificaSymbol: string): string => {
  if (pacificaSymbol === '1000PEPE') return 'KPEPE-USD';
  return `${pacificaSymbol}-USD`;
};

// Pacifica WebSocket price stream format
interface PacificaWsPriceData {
  symbol: string;
  mark: string;
  oracle: string;
  mid: string;
  funding: string;
  next_funding: string;
  open_interest: string;
  volume_24h: string;
  yesterday_price: string;
  timestamp: number;
}

interface PacificaPricesMessage {
  channel: 'prices';
  data: PacificaWsPriceData[];
}

// Pacifica API response types (for initial market info)
interface PacificaMarketInfo {
  symbol: string;
  max_leverage: number;
  tick_size: string;
  lot_size: string;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
}

interface PacificaApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: string | null;
}

// Cache for market info (leverage, etc.) - doesn't change often
let marketInfoCache: Record<string, PacificaMarketInfo> = {};
let marketInfoLoaded = false;

// Exported market interface for components
export interface Market {
  symbol: string;       // "BTC-USD"
  name: string;         // "Bitcoin"
  maxLeverage: number;  // 50
}

// Symbol to name mapping for display
const symbolNames: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  HYPE: 'Hyperliquid',
  XMR: 'Monero',
  ZEC: 'Zcash',
  XRP: 'XRP',
  ENA: 'Ethena',
  SUI: 'Sui',
  PUMP: 'Pump',
  LTC: 'Litecoin',
  PAXG: 'PAX Gold',
  '1000PEPE': 'kPEPE',
  KPEPE: 'kPEPE',
  LIT: 'Litentry',
  FARTCOIN: 'Fartcoin',
  XAG: 'Silver',
  DOGE: 'Dogecoin',
  NVDA: 'Nvidia',
  AAVE: 'Aave',
  BCH: 'Bitcoin Cash',
  WLFI: 'WorldLibertyFi',
  JUP: 'Jupiter',
  XPL: 'XPL',
  TAO: 'Bittensor',
  ADA: 'Cardano',
  CL: 'Crude Oil',
  UNI: 'Uniswap',
  AVAX: 'Avalanche',
  ARB: 'Arbitrum',
  WIF: 'dogwifhat',
  VIRTUAL: 'Virtual',
  ICP: 'Internet Computer',
  LINK: 'Chainlink',
  '1000BONK': 'kBONK',
  KBONK: 'kBONK',
  ASTER: 'Aster',
  TRUMP: 'Trump',
  LDO: 'Lido DAO',
  PENGU: 'Pudgy Penguins',
  NEAR: 'NEAR Protocol',
  ZK: 'zkSync',
  WLD: 'Worldcoin',
  PIPPIN: 'Pippin',
  ZZ: 'ZZ',
  STRK: 'Starknet',
  CRV: 'Curve',
  MON: 'Mon Protocol',
};

export function usePrices(_options: UsePricesOptions = {}) {
  // We now track ALL symbols from API automatically

  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch market info (for leverage limits) - only once via REST
  const fetchMarketInfo = useCallback(async () => {
    if (marketInfoLoaded) return;

    try {
      const response = await fetch(`${PACIFICA_API_BASE}/api/v1/info`);
      const result: PacificaApiResponse<PacificaMarketInfo[]> = await response.json();

      if (result.success && result.data) {
        const marketList: Market[] = [];

        result.data.forEach((market) => {
          marketInfoCache[market.symbol] = market;

          // Convert to our Market format
          const ourSymbol = pacificaToSymbol(market.symbol);
          marketList.push({
            symbol: ourSymbol,
            name: symbolNames[market.symbol] || market.symbol,
            maxLeverage: market.max_leverage,
          });
        });

        // Sort by volume (will be updated when prices come in)
        setMarkets(marketList);
        marketInfoLoaded = true;
      }
    } catch (err) {
      console.error('Failed to fetch market info:', err);
    }
  }, []);

  // Process WebSocket price data - now processes ALL symbols from API
  const processPriceData = useCallback((data: PacificaWsPriceData[]) => {
    const newPrices: Record<string, PriceData> = {};

    data.forEach((priceData) => {
      const ourSymbol = pacificaToSymbol(priceData.symbol);
      const markPrice = parseFloat(priceData.mark);
      const oraclePrice = parseFloat(priceData.oracle);
      const yesterdayPrice = parseFloat(priceData.yesterday_price);
      const change24h = yesterdayPrice > 0
        ? ((oraclePrice - yesterdayPrice) / yesterdayPrice) * 100
        : 0;

      const marketInfo = marketInfoCache[priceData.symbol];

      newPrices[ourSymbol] = {
        symbol: ourSymbol,
        price: markPrice,
        oracle: oraclePrice,
        change24h,
        high24h: oraclePrice * 1.02, // API doesn't provide 24h high/low directly
        low24h: oraclePrice * 0.98,
        volume24h: parseFloat(priceData.volume_24h),
        openInterest: parseFloat(priceData.open_interest) * oraclePrice,
        funding: parseFloat(priceData.funding) * 100, // Convert to percentage
        nextFunding: parseFloat(priceData.next_funding) * 100,
        lastUpdate: priceData.timestamp,
        maxLeverage: marketInfo?.max_leverage || 10,
        tickSize: marketInfo?.tick_size ? parseFloat(marketInfo.tick_size) : 0.01,
        lotSize: marketInfo?.lot_size ? parseFloat(marketInfo.lot_size) : 0.00001,
      };
    });

    setPrices(prev => ({ ...prev, ...newPrices }));
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(PACIFICA_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);

        // Subscribe to prices stream (all symbols)
        ws.send(JSON.stringify({
          method: 'subscribe',
          params: {
            source: 'prices'
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: PacificaPricesMessage = JSON.parse(event.data);

          if (message.channel === 'prices' && message.data) {
            processPriceData(message.data);
          }
        } catch (err) {
          console.error('Failed to parse prices message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
      setError('Failed to connect');
    }
  }, [processPriceData]);

  // Initial setup
  useEffect(() => {
    // Fetch market info first, then connect WebSocket
    fetchMarketInfo().then(() => {
      connect();
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchMarketInfo, connect]);

  const getPrice = useCallback(
    (symbol: string): PriceData | null => {
      return prices[symbol] || null;
    },
    [prices]
  );

  const formatPrice = useCallback((price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  }, []);

  return {
    prices,
    markets,
    isConnected,
    error,
    getPrice,
    formatPrice,
  };
}
