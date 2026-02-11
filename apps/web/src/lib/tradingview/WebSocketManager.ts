/**
 * WebSocket Manager for TradingView Datafeed
 * Manages connections and subscriptions to Pacifica WebSocket
 */

const PACIFICA_WS_URL = 'wss://ws.pacifica.fi/ws';

export interface Bar {
  time: number;  // Milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Subscription {
  symbol: string;
  interval: string;
  onTick: (bar: Bar) => void;
  listenerGuid: string;
}

interface PacificaCandleMessage {
  channel: 'candle';
  data: {
    t: number;   // start time ms
    T: number;   // end time ms
    s: string;   // symbol
    i: string;   // interval
    o: string;   // open
    c: string;   // close
    h: string;   // high
    l: string;   // low
    v: string;   // volume
    n: number;   // number of trades
  };
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  constructor() {
    // Singleton instance will connect when first subscription is made
  }

  /**
   * Subscribe to real-time candle updates
   */
  subscribe(
    symbol: string,
    interval: string,
    onTick: (bar: Bar) => void,
    listenerGuid: string
  ): void {
    // Store subscription
    this.subscriptions.set(listenerGuid, {
      symbol,
      interval,
      onTick,
      listenerGuid,
    });

    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    } else {
      // Already connected, send subscribe message
      this.sendSubscribe(symbol, interval);
    }
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(listenerGuid: string): void {
    const subscription = this.subscriptions.get(listenerGuid);
    if (!subscription) return;

    // Remove subscription
    this.subscriptions.delete(listenerGuid);

    // Check if any other subscriptions use the same symbol/interval
    const hasOtherSubscriptions = Array.from(this.subscriptions.values()).some(
      (sub) => sub.symbol === subscription.symbol && sub.interval === subscription.interval
    );

    // If no other subscriptions for this symbol/interval, unsubscribe from WebSocket
    if (!hasOtherSubscriptions && this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(subscription.symbol, subscription.interval);
    }

    // If no more subscriptions, close connection after a delay
    if (this.subscriptions.size === 0) {
      setTimeout(() => {
        if (this.subscriptions.size === 0) {
          this.disconnect();
        }
      }, 5000);
    }
  }

  private connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(PACIFICA_WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('[TradingView WS] Connected');

        // Subscribe to all active subscriptions
        const uniqueSubs = new Map<string, { symbol: string; interval: string }>();
        this.subscriptions.forEach((sub) => {
          const key = `${sub.symbol}:${sub.interval}`;
          if (!uniqueSubs.has(key)) {
            uniqueSubs.set(key, { symbol: sub.symbol, interval: sub.interval });
          }
        });

        uniqueSubs.forEach(({ symbol, interval }) => {
          this.sendSubscribe(symbol, interval);
        });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[TradingView WS] Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('[TradingView WS] Disconnected');
        this.isConnecting = false;
        this.ws = null;

        // Reconnect if there are active subscriptions
        if (this.subscriptions.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[TradingView WS] Failed to connect:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.subscriptions.size > 0) {
        this.connect();
      }
    }, 3000);
  }

  private sendSubscribe(symbol: string, interval: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        method: 'subscribe',
        params: {
          source: 'candle',
          symbol,
          interval,
        },
      })
    );
    console.log(`[TradingView WS] Subscribed to ${symbol} ${interval}`);
  }

  private sendUnsubscribe(symbol: string, interval: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        method: 'unsubscribe',
        params: {
          source: 'candle',
          symbol,
          interval,
        },
      })
    );
    console.log(`[TradingView WS] Unsubscribed from ${symbol} ${interval}`);
  }

  private handleMessage(data: string): void {
    try {
      const message: PacificaCandleMessage = JSON.parse(data);

      if (message.channel !== 'candle' || !message.data) return;

      const { s: symbol, i: interval } = message.data;

      // Create bar object (time in milliseconds for TradingView)
      const bar: Bar = {
        time: message.data.t,
        open: parseFloat(message.data.o),
        high: parseFloat(message.data.h),
        low: parseFloat(message.data.l),
        close: parseFloat(message.data.c),
        volume: parseFloat(message.data.v),
      };

      // Notify all matching subscriptions
      this.subscriptions.forEach((sub) => {
        if (sub.symbol === symbol && sub.interval === interval) {
          sub.onTick(bar);
        }
      });
    } catch (error) {
      // Ignore parse errors
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
