/**
 * Global number formatting utilities for the trading app.
 * Handles all price ranges from BTC ($100k+) to memecoins ($0.00001)
 */

/**
 * Format price with appropriate decimal places based on magnitude.
 * Matches Pacifica's formatting style.
 */
export function formatPrice(price: number): string {
  if (price === 0) return '0.00';

  // Large prices (BTC, ETH, etc.)
  if (price >= 10000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Medium prices ($100-$10000)
  if (price >= 100) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Small prices ($1-$100)
  if (price >= 1) {
    return price.toFixed(4);
  }

  // Micro prices ($0.01-$1)
  if (price >= 0.01) {
    return price.toFixed(5);
  }

  // Nano prices ($0.0001-$0.01)
  if (price >= 0.0001) {
    return price.toFixed(6);
  }

  // Ultra small prices (memecoins)
  return price.toFixed(8);
}

/**
 * Format USD value with appropriate formatting.
 * Uses K, M, B suffixes for large numbers.
 */
export function formatUSD(value: number, options?: { compact?: boolean }): string {
  if (value === 0) return '$0.00';

  const compact = options?.compact ?? false;

  if (compact || value >= 1_000_000_000) {
    if (value >= 1_000_000_000) {
      return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
    }
    if (value >= 1_000_000) {
      return '$' + (value / 1_000_000).toFixed(2) + 'M';
    }
    if (value >= 1_000) {
      return '$' + (value / 1_000).toFixed(2) + 'K';
    }
  }

  return '$' + value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format volume with appropriate suffixes.
 */
export function formatVolume(value: number): string {
  if (value === 0) return '0';

  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(4);
}

/**
 * Format quantity/size with appropriate decimal places.
 */
export function formatQuantity(size: number): string {
  if (size === 0) return '0';

  if (size >= 1_000_000) {
    return (size / 1_000_000).toFixed(2) + 'M';
  }
  if (size >= 1_000) {
    return (size / 1_000).toFixed(2) + 'K';
  }
  if (size >= 100) {
    return size.toFixed(2);
  }
  if (size >= 1) {
    return size.toFixed(3);
  }
  if (size >= 0.01) {
    return size.toFixed(4);
  }
  return size.toFixed(6);
}

/**
 * Format percentage with sign.
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(decimals) + '%';
}

/**
 * Format funding rate (usually very small percentages).
 */
export function formatFundingRate(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(4) + '%';
}

/**
 * Get the appropriate number of decimal places for a price.
 */
export function getPriceDecimals(price: number): number {
  if (price >= 10000) return 2;
  if (price >= 100) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 5;
  if (price >= 0.0001) return 6;
  return 8;
}

/**
 * Format date/time for tables (e.g., "Feb 5, 01:23:50")
 * Standard format used across all tables in the app.
 */
export function formatDateTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
}

/**
 * Format date/time without seconds (e.g., "Feb 5, 01:23")
 * Used in FightCard and profile tables.
 */
export function formatDateTimeShort(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
}

/**
 * Extract base token from symbol (BTC-USD -> BTC)
 */
export function getBaseToken(symbol: string): string {
  if (symbol === 'KPEPE-USD') return '1KPEPE';
  return symbol.replace('-USD', '');
}

/**
 * Map our symbol format to Pacifica format
 */
export function symbolToPacifica(symbol: string): string {
  if (symbol === 'KPEPE-USD') return '1000PEPE';
  return symbol.replace('-USD', '');
}
