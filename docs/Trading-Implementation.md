# Trading Implementation Technical Guide

This guide documents the complete technical implementation of trading functionality in TradeFighters. Use this as a reference for understanding how order placement, position management, and trade tracking works.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Order Placement](#order-placement)
4. [Order Form Validation](#order-form-validation)
5. [Leverage Management](#leverage-management)
6. [Position Management](#position-management)
7. [Order Cancellation](#order-cancellation)
8. [Position Monitoring & PnL](#position-monitoring--pnl)
9. [WebSocket Real-Time Updates](#websocket-real-time-updates)
10. [Terminal Duel Trade Tracking](#terminal-duel-trade-tracking)
11. [Complete Trading Flow](#complete-trading-flow)

---

## Overview

The trading system integrates with Pacifica Exchange to provide:

- **Market & Limit Orders** with configurable leverage (1x-50x)
- **Position Management** with Take Profit/Stop Loss
- **Real-time Updates** via WebSocket for positions, orders, and trades
- **Capital Cap Validation** for Terminal Duels
- **PnL Tracking** with ROE calculation

**Key Concept**: All trading operations require wallet signatures for authentication. The platform acts as a UI layer over Pacifica's trading engine.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
├──────────────────────────────────────────────────────────────────┤
│  Order Form Component                                            │
│      ↓                                                            │
│  Validation (balance, margin, size)                              │
│      ↓                                                            │
│  Sign with Wallet (Solana)                                       │
│      ↓                                                            │
│  POST to Pacifica API                                            │
│      ↓                                                            │
│  React Query Cache Invalidation                                  │
│      ↓                                                            │
│  WebSocket Real-Time Updates                                     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    PACIFICA EXCHANGE                              │
│  - Order Matching Engine                                         │
│  - Position Tracking                                             │
│  - WebSocket Event Streams                                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    TRADEFIGHTERS BACKEND                          │
│  - Ingest trades via WebSocket                                   │
│  - Match to active terminal duels                                │
│  - Apply capital cap validation                                  │
│  - Calculate and broadcast PnL                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Order Placement

### Order Form Component

**File**: [apps/web/src/app/(private)/terminal/components/order-form.tsx](apps/web/src/app/(private)/terminal/components/order-form.tsx)

The order form is the main trading interface with these features:

#### Features

1. **Order Types**
   - Market Order (executes immediately at current price)
   - Limit Order (executes when price reaches specified level)

2. **Trade Direction**
   - Long (buy/bid) - profit when price increases
   - Short (sell/ask) - profit when price decreases

3. **Size Entry**
   - Input in USD notional value
   - Quick-select buttons: 25%, 50%, 75%, 100% of available balance
   - Converts to token amount: `amount = USD / markPrice`

4. **Leverage Control**
   - Slider from 1x to market maximum (up to 50x)
   - Dynamically updates margin required and liquidation price

5. **Take Profit / Stop Loss**
   - Optional TP/SL configuration
   - Set specific price levels for automatic exit

6. **Order Summary**
   - Order Value (notional in USD)
   - Margin Required (`orderValue / leverage`)
   - Est. Liquidation Price
   - Total Fees (0.15% total)

#### Key Code Sections

```tsx
// Calculate margin required
const marginRequired = useMemo(() => {
  if (!orderValue || !leverage) return 0;
  return orderValue / leverage;
}, [orderValue, leverage]);

// Calculate liquidation price
const liquidationPrice = useMemo(() => {
  if (!currentPrice || !leverage) return null;

  const liquidationFactor = (1 / leverage) * 0.9; // 90% of theoretical

  if (isLong) {
    return currentPrice * (1 - liquidationFactor);
  } else {
    return currentPrice * (1 + liquidationFactor);
  }
}, [currentPrice, leverage, isLong]);

// Calculate fees
const fees = useMemo(() => {
  if (!orderValue) return 0;
  const PACIFICA_FEE = 0.0005; // 0.05%
  const TRADEFIGHTERS_FEE = 0.001; // 0.10%
  return orderValue * (PACIFICA_FEE + TRADEFIGHTERS_FEE);
}, [orderValue]);
```

### Market Order Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-create-order.ts](apps/web/src/app/(private)/terminal/hooks/use-create-order.ts#L1)

#### Implementation

```typescript
export function useCreateMarketOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMarketOrderParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Step 1: Sign the operation with wallet
      const { signature, timestamp } = await createSignedMarketOrder(wallet, {
        symbol: params.symbol,
        side: params.side,
        amount: params.amount,
        reduce_only: params.reduceOnly ?? false,
      });

      // Step 2: Add TP/SL if configured
      const stopOrders: any = {};
      if (params.takeProfit) {
        stopOrders.take_profit = { stop_price: params.takeProfit };
      }
      if (params.stopLoss) {
        stopOrders.stop_loss = { stop_price: params.stopLoss };
      }

      // Step 3: Send to Pacifica API
      const response = await pacificaApiClient.createMarketOrder(
        account,
        {
          symbol: params.symbol,
          side: params.side,
          amount: params.amount,
          slippage_percent: '0.5', // 0.5% slippage tolerance
          reduce_only: params.reduceOnly ?? false,
          builder_code: params.builderCode,
          ...stopOrders,
        },
        signature,
        timestamp
      );

      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate relevant caches to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'account'] });

      toast.success(`Market order created: ${data.order_id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create market order: ${error.message}`);
    },
  });
}
```

#### API Endpoint

```
POST /api/v1/orders/create_market
```

**Request Body**:
```typescript
{
  account: string              // Wallet address
  symbol: string               // e.g., "SOL", "ETH"
  side: 'bid' | 'ask'         // Long or Short
  amount: string              // Token quantity (2 decimal places)
  slippage_percent: string    // Default "0.5" (0.5%)
  reduce_only: boolean        // false for opening positions
  take_profit?: {
    stop_price: string        // TP trigger price
  }
  stop_loss?: {
    stop_price: string        // SL trigger price
  }
  builder_code?: string       // Affiliate/referral code
  signature: string           // Wallet signature
  timestamp: number           // Unix timestamp
  expiry_window: number       // 5000ms
}
```

**Response**:
```typescript
{
  success: boolean
  data: {
    order_id: number
    client_order_id: string
    symbol: string
    side: 'bid' | 'ask'
    amount: string
    price: string            // Filled price
    status: string
    created_at: number
  }
}
```

### Limit Order Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-create-order.ts](apps/web/src/app/(private)/terminal/hooks/use-create-order.ts#L50)

```typescript
export function useCreateLimitOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLimitOrderParams) => {
      const account = wallet.publicKey!.toBase58();

      const { signature, timestamp } = await createSignedLimitOrder(wallet, {
        symbol: params.symbol,
        side: params.side,
        price: params.price,      // User-specified limit price
        amount: params.amount,
        reduce_only: params.reduceOnly ?? false,
        post_only: params.postOnly ?? false,
      });

      const response = await pacificaApiClient.createLimitOrder(
        account,
        {
          symbol: params.symbol,
          side: params.side,
          price: params.price,
          amount: params.amount,
          tif: params.tif ?? 'GTC',  // Time In Force: GTC, IOC, ALO, TOB
          reduce_only: params.reduceOnly ?? false,
          post_only: params.postOnly ?? false,
          builder_code: params.builderCode,
        },
        signature,
        timestamp
      );

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'orders'] });
      toast.success(`Limit order created: ${data.order_id}`);
    },
  });
}
```

#### Time In Force Options

- **GTC** (Good Till Cancel) - Order stays until filled or manually cancelled
- **IOC** (Immediate Or Cancel) - Fill immediately, cancel remainder
- **ALO** (Add Liquidity Only) - Only execute as maker (adds liquidity to book)
- **TOB** (Top Of Book) - Only execute at best price in book

---

## Order Form Validation

**File**: [apps/web/src/app/(private)/terminal/components/order-form.tsx](apps/web/src/app/(private)/terminal/components/order-form.tsx#L200)

### Validation Checks

```typescript
// Constants
const MIN_BALANCE_USD = 100;
const LOT_SIZE = 0.01;

// 1. Account validation
const { account, isValid } = useValidatedAccount();
if (!isValid) {
  return <div>Please connect and validate your wallet</div>;
}

// 2. Minimum balance check
const { data: accountInfo } = useAccountInfo(account);
const availableBalance = parseFloat(accountInfo?.available_balance ?? '0');

if (availableBalance < MIN_BALANCE_USD) {
  return (
    <div className="text-red-500">
      Minimum balance required: ${MIN_BALANCE_USD}
    </div>
  );
}

// 3. Margin calculation
const marginRequired = orderValue / leverage;

if (marginRequired > availableBalance) {
  setError('Insufficient margin. Reduce size or increase available balance.');
  return;
}

// 4. Order size validation
const orderSize = orderValue / currentPrice;
const roundedSize = Math.floor(orderSize / LOT_SIZE) * LOT_SIZE;

if (roundedSize < LOT_SIZE) {
  setError('Order size too small. Minimum: 0.01 tokens');
  return;
}

// 5. Submit order
handleSubmit(roundedSize);
```

### Form Submission Flow

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Prepare order payload
  const orderParams: CreateMarketOrderParams = {
    symbol: selectedSymbol,
    side: isLong ? 'bid' : 'ask',
    amount: orderSize.toFixed(2), // 2 decimal places
    reduceOnly: false,
    builderCode: getBuilderCode(),
  };

  // Add TP/SL if configured
  if (takeProfit) {
    orderParams.takeProfit = takeProfit.toString();
  }
  if (stopLoss) {
    orderParams.stopLoss = stopLoss.toString();
  }

  // Execute mutation
  await createMarketOrder(orderParams);
};
```

---

## Leverage Management

### Set Leverage Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-set-leverage.ts](apps/web/src/app/(private)/terminal/hooks/use-set-leverage.ts)

```typescript
export function useSetLeverage() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetLeverageParams) => {
      const account = wallet.publicKey!.toBase58();

      // Sign operation
      const { signature, timestamp } = await createSignedUpdateLeverage(wallet, {
        symbol: params.symbol,
        leverage: params.leverage.toString(),
      });

      // Send to API
      const response = await pacificaApiClient.setLeverage(
        account,
        {
          symbol: params.symbol,
          leverage: params.leverage.toString(),
        },
        signature,
        timestamp
      );

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pacifica', 'account-settings'],
      });
      toast.success(`Leverage updated to ${variables.leverage}x for ${variables.symbol}`);
    },
  });
}
```

#### API Endpoint

```
POST /api/v1/account/update_leverage
```

**Request Body**:
```typescript
{
  account: string
  symbol: string
  leverage: string          // e.g., "10" for 10x
  signature: string
  timestamp: number
}
```

### Get Account Settings Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-account-info.ts](apps/web/src/app/(private)/terminal/hooks/use-account-info.ts#L50)

```typescript
export function useAccountSettings(account: string | null) {
  return useQuery({
    queryKey: ['pacifica', 'account-settings', account],
    queryFn: async () => {
      if (!account) throw new Error('Account required');
      const response = await pacificaApiClient.getAccountSettings(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: 30000,  // Poll every 30 seconds
    staleTime: 20000,
  });
}
```

**Response Schema**:
```typescript
{
  settings: Array<{
    symbol: string
    leverage: string        // Current leverage for this symbol
    max_leverage: string    // Maximum allowed leverage
  }>
}
```

### Leverage in Order Form

```tsx
// Get market info for max leverage
const { data: marketInfo } = useSymbolMarket(selectedSymbol);
const maxLeverage = parseInt(marketInfo?.max_leverage ?? '1');

// Leverage slider
<Slider
  min={1}
  max={maxLeverage}
  step={1}
  value={[leverage]}
  onValueChange={([value]) => setLeverage(value)}
/>

// Display
<div>Leverage: {leverage}x</div>
```

---

## Position Management

### Position Display Component

**File**: [apps/web/src/app/(private)/terminal/components/positions-table.tsx](apps/web/src/app/(private)/terminal/components/positions-table.tsx)

### Fetch Positions Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-positions.ts](apps/web/src/app/(private)/terminal/hooks/use-positions.ts)

```typescript
export function usePositions(account: string | null) {
  return useQuery({
    queryKey: ['pacifica', 'positions', account],
    queryFn: async () => {
      if (!account) throw new Error('Account required');
      const response = await pacificaApiClient.getPositions(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: 3000,  // Poll every 3 seconds
    staleTime: 2000,
  });
}
```

#### API Endpoint

```
GET /api/v1/positions?account={address}
```

**Response Schema**:
```typescript
{
  positions: Array<{
    symbol: string
    side: 'bid' | 'ask'         // Long or Short
    amount: string              // Token quantity
    entry_price: string         // Average entry price
    margin: string              // For isolated margin
    funding: string             // Accumulated funding fees
    isolated: boolean           // Margin mode
    liquidation_price: string   // From WebSocket
    created_at: number
    updated_at: number
  }>
}
```

### Position Enrichment

```typescript
// Enrich position data with real-time calculations
function enrichPosition(position: Position) {
  // 1. Get current mark price
  const { data: prices } = usePrices();
  const markPrice = parseFloat(prices?.[position.symbol] ?? '0');

  // 2. Calculate unrealized PnL
  const entryPrice = parseFloat(position.entry_price);
  const size = parseFloat(position.amount);

  let unrealizedPnl = 0;
  if (position.side === 'bid') {
    // Long: profit when price increases
    unrealizedPnl = (markPrice - entryPrice) * size;
  } else {
    // Short: profit when price decreases
    unrealizedPnl = (entryPrice - markPrice) * size;
  }

  // 3. Get leverage for this symbol
  const { data: settings } = useAccountSettings(account);
  const symbolSettings = settings?.settings.find(s => s.symbol === position.symbol);
  const leverage = parseFloat(symbolSettings?.leverage ?? '1');

  // 4. Calculate margin used
  const margin = parseFloat(position.margin) || ((entryPrice * size) / leverage);

  // 5. Calculate ROE (Return on Equity)
  const roe = (unrealizedPnl / margin) * 100;

  return {
    ...position,
    markPrice,
    unrealizedPnl,
    leverage,
    margin,
    roe,
  };
}
```

### Take Profit / Stop Loss Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-set-tp-sl.ts](apps/web/src/app/(private)/terminal/hooks/use-set-tp-sl.ts)

```typescript
export function useSetTpSl() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetTpSlParams) => {
      const account = wallet.publicKey!.toBase58();

      const { signature, timestamp } = await createSignedSetPositionTpsl(wallet, {
        symbol: params.symbol,
        side: params.side,
        take_profit: params.takeProfit ? { stop_price: params.takeProfit } : undefined,
        stop_loss: params.stopLoss ? { stop_price: params.stopLoss } : undefined,
      });

      const response = await pacificaApiClient.setPositionTpSl(
        account,
        {
          symbol: params.symbol,
          side: params.side,
          take_profit: params.takeProfit ? { stop_price: params.takeProfit } : null,
          stop_loss: params.stopLoss ? { stop_price: params.stopLoss } : null,
        },
        signature,
        timestamp
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'positions'] });
      toast.success('TP/SL updated');
    },
  });
}
```

#### API Endpoint

```
POST /api/v1/positions/tpsl
```

**Request Body**:
```typescript
{
  account: string
  symbol: string
  side: 'bid' | 'ask'
  take_profit?: {
    stop_price: string
  } | null
  stop_loss?: {
    stop_price: string
  } | null
  signature: string
  timestamp: number
}
```

### Close Position

To close a position, create an order with `reduce_only: true` and opposite side:

```typescript
// Close long position
await createMarketOrder({
  symbol: 'SOL',
  side: 'ask',           // Opposite of position side
  amount: position.amount,  // Full position size
  reduceOnly: true,      // Important: prevents opening new position
});
```

---

## Order Cancellation

### Cancel Order Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-cancel-order.ts](apps/web/src/app/(private)/terminal/hooks/use-cancel-order.ts)

```typescript
export function useCancelOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      const account = wallet.publicKey!.toBase58();

      // Determine if stop order (TP/SL) or regular order
      const isStop = isStopOrder(params.orderType);

      // Sign cancel operation
      const { signature, timestamp } = await createSignedCancelOrder(wallet, {
        order_id: params.orderId,
      });

      // Route to correct endpoint
      if (isStop) {
        return await pacificaApiClient.cancelStopOrder(
          account,
          {
            symbol: params.symbol,
            order_id: params.orderId,
          },
          signature,
          timestamp
        );
      } else {
        return await pacificaApiClient.cancelOrder(
          account,
          {
            symbol: params.symbol,
            order_id: params.orderId,
          },
          signature,
          timestamp
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacifica', 'orders'] });
      toast.success('Order cancelled');
    },
  });
}

// Helper to identify stop orders
function isStopOrder(orderType: string): boolean {
  return [
    'stop_limit',
    'stop_market',
    'take_profit_limit',
    'take_profit_market',
    'stop_loss_limit',
    'stop_loss_market',
  ].includes(orderType);
}
```

#### API Endpoints

**Regular Orders**:
```
POST /api/v1/orders/cancel
```

**Stop Orders (TP/SL)**:
```
POST /api/v1/orders/stop/cancel
```

**Request Body** (Note: `account` NOT in signed data):
```typescript
{
  account: string         // Added to payload, NOT signed
  symbol: string
  order_id?: number
  client_order_id?: string
  signature: string       // Signs only symbol + order_id
  timestamp: number
}
```

### Cancel All Orders Hook

```typescript
export function useCancelAllOrders() {
  const wallet = useWallet();

  return useMutation({
    mutationFn: async (params?: { symbol?: string }) => {
      const account = wallet.publicKey!.toBase58();

      const { signature, timestamp } = await signPacificaOperation({
        wallet,
        operationType: 'cancel_all_orders',
        data: {
          all_symbols: !params?.symbol,
          exclude_reduce_only: false,
          ...(params?.symbol && { symbol: params.symbol }),
        },
      });

      return await pacificaApiClient.cancelAllOrders(
        account,
        {
          all_symbols: !params?.symbol,
          exclude_reduce_only: false,
          symbol: params?.symbol,
        },
        signature,
        timestamp
      );
    },
  });
}
```

---

## Position Monitoring & PnL

### Account Info Hook

**File**: [apps/web/src/app/(private)/terminal/hooks/use-account-info.ts](apps/web/src/app/(private)/terminal/hooks/use-account-info.ts)

```typescript
export function useAccountInfo(account: string | null) {
  return useQuery({
    queryKey: ['pacifica', 'account', account],
    queryFn: async () => {
      if (!account) throw new Error('Account required');
      const response = await pacificaApiClient.getAccountInfo(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: 5000,  // Poll every 5 seconds
    staleTime: 3000,
  });
}
```

**Response Schema**:
```typescript
{
  account: string           // Wallet address
  balance: string           // Total balance
  equity: string            // Current equity
  unrealized_pnl: string    // Unrealized P&L across all positions
  margin_used: string       // Total margin in use
  available_balance: string // Available for trading
}
```

### Position PnL Display

```tsx
function PositionRow({ position }: { position: Position }) {
  const { data: prices } = usePrices();
  const markPrice = parseFloat(prices?.[position.symbol] ?? '0');
  const entryPrice = parseFloat(position.entry_price);
  const size = parseFloat(position.amount);

  // Calculate unrealized PnL
  const pnl = position.side === 'bid'
    ? (markPrice - entryPrice) * size
    : (entryPrice - markPrice) * size;

  // Calculate ROE
  const margin = parseFloat(position.margin);
  const roe = (pnl / margin) * 100;

  return (
    <div>
      <div>Symbol: {position.symbol}</div>
      <div>Side: {position.side === 'bid' ? 'Long' : 'Short'}</div>
      <div>Size: {size}</div>
      <div>Entry: ${entryPrice.toFixed(2)}</div>
      <div>Mark: ${markPrice.toFixed(2)}</div>
      <div className={pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
        PnL: ${pnl.toFixed(2)} ({roe.toFixed(2)}%)
      </div>
      <div>Liquidation: ${position.liquidation_price}</div>
    </div>
  );
}
```

---

## WebSocket Real-Time Updates

### Backend WebSocket Service

**File**: [apps/api/src/modules/pacifica/pacifica-websocket.service.ts](apps/api/src/modules/pacifica/pacifica-websocket.service.ts)

The backend maintains a persistent WebSocket connection to Pacifica for ingesting trades.

```typescript
@Injectable()
export class PacificaWebSocketService implements OnModuleInit {
  private ws: WebSocket | null = null;
  private subscribedAccounts = new Set<string>();

  async onModuleInit() {
    this.connect();
    // Sync subscriptions every 30 seconds
    setInterval(() => this.syncSubscriptions(), 30000);
  }

  private connect() {
    this.ws = new WebSocket('wss://api.pacifica.fi/ws');

    this.ws.on('open', () => {
      console.log('Pacifica WebSocket connected');
      this.resubscribeAll();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', () => {
      setTimeout(() => this.connect(), 5000); // Reconnect after 5s
    });
  }

  private async handleMessage(message: any) {
    if (message.source === 'account_trades') {
      await this.handleTrade(message);
    }
  }

  private async handleTrade(trade: any) {
    // Find active terminal duels for this account
    const activeDuels = await this.findActiveDuelsForAccount(trade.u);

    for (const duel of activeDuels) {
      // Save trade to database
      await this.saveTrade(duel.id, trade);

      // Calculate and broadcast PnL update
      const pnl = await this.calculateDuelPnL(duel.id);
      this.eventEmitter.emit('DUEL_PNL_UPDATE', pnl);
    }
  }

  async subscribeToAccount(account: string) {
    this.subscribedAccounts.add(account);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        params: {
          source: 'account_trades',
          account,
        },
      }));
    }
  }
}
```

### Frontend WebSocket Client

**File**: [apps/web/src/lib/pacifica/websocket-client.ts](apps/web/src/lib/pacifica/websocket-client.ts)

```typescript
export class PacificaWebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private url: string) {}

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'pong') {
        return; // Heartbeat response
      }

      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  subscribe(channel: string, params: Record<string, any>, callback: (data: any) => void) {
    const key = this.getSubscriptionKey(channel, params);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());

      // Send subscription request
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'subscribe',
          params: { source: channel, ...params },
        }));
      }
    }

    this.subscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  private handleMessage(message: any) {
    const key = this.getSubscriptionKey(message.source, message);
    const callbacks = this.subscriptions.get(key);

    if (callbacks) {
      callbacks.forEach((callback) => callback(message));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### WebSocket Provider & Hooks

**File**: [apps/web/src/providers/pacifica-websocket-provider.tsx](apps/web/src/providers/pacifica-websocket-provider.tsx)

```tsx
export function PacificaWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PacificaWebSocketClient | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://ws.pacifica.exchange';
    const wsClient = new PacificaWebSocketClient(wsUrl);
    wsClient.connect();
    setClient(wsClient);

    return () => {
      wsClient.disconnect();
    };
  }, []);

  return (
    <PacificaWebSocketContext.Provider value={client}>
      {children}
    </PacificaWebSocketContext.Provider>
  );
}

/**
 * Subscribe to account positions
 */
export function usePacificaAccountPositions(
  account: string | null,
  onData: (positions: WsPositionData[]) => void
) {
  const client = useContext(PacificaWebSocketContext);

  useEffect(() => {
    if (!client || !account) return;
    return client.subscribe('account_positions', { account }, onData);
  }, [client, account, onData]);
}

/**
 * Subscribe to account orders
 */
export function usePacificaAccountOrders(
  account: string | null,
  onData: (orders: WsOrderData[]) => void
) {
  const client = useContext(PacificaWebSocketContext);

  useEffect(() => {
    if (!client || !account) return;
    return client.subscribe('account_orders', { account }, onData);
  }, [client, account, onData]);
}

/**
 * Subscribe to account trades
 */
export function usePacificaAccountTrades(
  account: string | null,
  onData: (trade: WsTradeData) => void
) {
  const client = useContext(PacificaWebSocketContext);

  useEffect(() => {
    if (!client || !account) return;
    return client.subscribe('account_trades', { account }, onData);
  }, [client, account, onData]);
}
```

### WebSocket Message Formats

#### Account Trades (Abbreviated Format)

```typescript
{
  h: number          // history_id
  i: number          // order_id
  I: string | null   // client_order_id
  u: string          // account address
  s: string          // symbol
  p: string          // price
  o: string          // oracle_price
  a: string          // amount
  te: string         // event_type: 'fulfill_taker' | 'fulfill_maker' | 'auto_deleverage'
  ts: string         // side: 'open_long' | 'open_short' | 'close_long' | 'close_short'
  tc: string         // cause: 'normal' | 'market_liquidation' | 'backstop_liquidation' | 'settlement'
  f: string          // fee
  n: string          // net_pnl
  t: number          // timestamp
  li: number         // last_order_id (nonce for deduplication)
}
```

#### Account Positions (Abbreviated Format)

```typescript
{
  s: string          // symbol
  d: 'bid' | 'ask'   // direction (Long/Short)
  a: string          // amount
  p: string          // average_price
  m: string          // margin
  f: string          // funding
  i: boolean         // isolated
  l: string | null   // liquidation_price
  t: number          // timestamp
}
```

---

## Terminal Duel Trade Tracking

### Trade Ingestion Endpoint

**File**: [apps/api/src/modules/pacifica/pacifica.controller.ts](apps/api/src/modules/pacifica/pacifica.controller.ts)

```typescript
@Post('trades')
async saveTrade(@Body() trade: SaveTradeDto) {
  // 1. Find user by wallet address
  const user = await this.prisma.user.findUnique({
    where: { walletAddress: trade.accountAddress },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 2. Find active terminal duels for this user
  const tradeTime = new Date(trade.timestamp);

  const activeDuels = await this.prisma.duel.findMany({
    where: {
      status: DuelStatus.DRAFT, // DRAFT = active
      duelType: DuelType.TERMINAL,
      OR: [
        { authorId: user.id },
        { opponentId: user.id },
      ],
      startsAt: { lte: tradeTime },
      endsAt: { gte: tradeTime },
    },
  });

  if (activeDuels.length === 0) {
    return { message: 'No active terminal duels found' };
  }

  // 3. Save trade for each active duel
  for (const duel of activeDuels) {
    await this.prisma.terminalDuelTrade.create({
      data: {
        duelId: duel.id,
        userId: user.id,
        historyId: trade.historyId,
        orderId: trade.orderId,
        symbol: trade.symbol,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        oraclePrice: trade.oraclePrice,
        fee: trade.fee,
        netPnl: trade.netPnl,
        eventType: trade.eventType,
        cause: trade.cause,
        timestamp: tradeTime,
      },
    });

    // 4. Calculate PnL with capital cap validation
    const pnl = await this.calculateDuelPnL(duel.id);

    // 5. Broadcast update
    this.eventEmitter.emit('DUEL_PNL_UPDATE', pnl);
  }

  return { success: true };
}
```

### Capital Cap Validation

```typescript
private async analyzeTradesWithCapitalCap(
  trades: Trade[],
  capitalCap: number
): Promise<AnalyzedTrade[]> {
  const openPositions = new Map<string, OpenPosition>();
  const analyzedTrades: AnalyzedTrade[] = [];

  for (const trade of trades) {
    const posKey = trade.symbol;
    const notional = parseFloat(trade.amount) * parseFloat(trade.price);

    // Check if opening a position
    if (trade.side === 'open_long' || trade.side === 'open_short') {
      const existingPos = openPositions.get(posKey);
      const newNotional = (existingPos?.notional ?? 0) + notional;

      // Check capital cap
      if (newNotional > capitalCap) {
        analyzedTrades.push({
          ...trade,
          excluded: true,
          exclusionReason: TerminalTradeExclusionReason.EXCEEDS_CAPITAL_CAP,
        });
        continue;
      }

      // Update open position
      openPositions.set(posKey, {
        symbol: trade.symbol,
        notional: newNotional,
        amount: (existingPos?.amount ?? 0) + parseFloat(trade.amount),
      });

      analyzedTrades.push({ ...trade, excluded: false });
    }
    // Check if closing a position
    else if (trade.side === 'close_long' || trade.side === 'close_short') {
      const existingPos = openPositions.get(posKey);

      // Ensure there's an open position to close
      if (!existingPos || existingPos.amount === 0) {
        analyzedTrades.push({
          ...trade,
          excluded: true,
          exclusionReason: TerminalTradeExclusionReason.CLOSE_WITHOUT_OPEN,
        });
        continue;
      }

      // Reduce open position
      const closeAmount = parseFloat(trade.amount);
      const newAmount = existingPos.amount - closeAmount;
      const newNotional = (newAmount / existingPos.amount) * existingPos.notional;

      if (newAmount <= 0) {
        openPositions.delete(posKey); // Position fully closed
      } else {
        openPositions.set(posKey, {
          ...existingPos,
          amount: newAmount,
          notional: newNotional,
        });
      }

      analyzedTrades.push({ ...trade, excluded: false });
    }
  }

  return analyzedTrades;
}
```

### PnL Calculation

```typescript
private async calculateDuelPnL(duelId: string) {
  // Fetch duel with capital cap
  const duel = await this.prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      author: true,
      opponent: true,
      terminalMetadata: true,
    },
  });

  const capitalCap = duel.terminalMetadata.startCapitalCap;

  // Fetch trades for author
  const authorTrades = await this.prisma.terminalDuelTrade.findMany({
    where: { duelId, userId: duel.authorId },
    orderBy: { timestamp: 'asc' },
  });

  // Fetch trades for opponent
  const opponentTrades = await this.prisma.terminalDuelTrade.findMany({
    where: { duelId, userId: duel.opponentId },
    orderBy: { timestamp: 'asc' },
  });

  // Analyze with capital cap
  const authorAnalyzed = await this.analyzeTradesWithCapitalCap(authorTrades, capitalCap);
  const opponentAnalyzed = await this.analyzeTradesWithCapitalCap(opponentTrades, capitalCap);

  // Calculate PnL from valid trades only
  const authorPnL = authorAnalyzed
    .filter(t => !t.excluded)
    .reduce((sum, t) => sum + parseFloat(t.netPnl), 0);

  const opponentPnL = opponentAnalyzed
    .filter(t => !t.excluded)
    .reduce((sum, t) => sum + parseFloat(t.netPnl), 0);

  return {
    duelId,
    authorPnL,
    opponentPnL,
    authorTradeCount: authorAnalyzed.filter(t => !t.excluded).length,
    opponentTradeCount: opponentAnalyzed.filter(t => !t.excluded).length,
  };
}
```

### Duel Resolution on End

**File**: [apps/api/src/modules/duel-resolver-terminal/duel-resolver-terminal.service.ts](apps/api/src/modules/duel-resolver-terminal/duel-resolver-terminal.service.ts)

```typescript
async resolveDuel(duelId: string): Promise<void> {
  const duel = await this.prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      author: true,
      opponent: true,
      terminalMetadata: true,
    },
  });

  // Fetch trade history from Pacifica API
  const authorTrades = await this.pacificaService.getTradesHistory(
    duel.author.walletAddress,
    duel.startsAt,
    duel.endsAt
  );

  const opponentTrades = await this.pacificaService.getTradesHistory(
    duel.opponent.walletAddress,
    duel.startsAt,
    duel.endsAt
  );

  // Calculate total PnL
  const authorPnL = authorTrades.reduce((sum, t) => sum + parseFloat(t.netPnl), 0);
  const opponentPnL = opponentTrades.reduce((sum, t) => sum + parseFloat(t.netPnl), 0);

  // Determine winner
  let winner: 'author' | 'opponent' | 'draw';
  if (authorPnL > opponentPnL) {
    winner = 'author';
  } else if (opponentPnL > authorPnL) {
    winner = 'opponent';
  } else {
    winner = 'draw';
  }

  // Settle on-chain
  const settlementTx = await this.settleDuelOnChain(duel, winner);

  // Update duel status
  await this.prisma.duel.update({
    where: { id: duelId },
    data: {
      status: DuelStatus.COMPLETED,
      winner,
      settlementTx,
      resolvedAt: new Date(),
    },
  });
}
```

---

## Complete Trading Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      USER INITIATES TRADE                         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  1. VALIDATION                                                    │
│     - Check wallet connected                                     │
│     - Check minimum balance ($100 USD)                           │
│     - Calculate margin required                                  │
│     - Verify sufficient margin available                         │
│     - Round order size to LOT_SIZE (0.01)                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  2. SIGN WITH WALLET                                              │
│     - Create operation data (symbol, side, amount, etc.)         │
│     - Add timestamp and expiry_window                            │
│     - Sort JSON keys recursively                                 │
│     - Sign with Solana wallet → Base58 signature                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  3. SEND TO PACIFICA API                                          │
│     - POST /api/v1/orders/create_market (or /create for limit)  │
│     - Include account, params, signature, timestamp              │
│     - Pacifica verifies signature and executes                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  4. ORDER EXECUTION                                               │
│     - Market order: fills at current mark price                  │
│     - Limit order: enters order book, waits for price            │
│     - Deducts fees: 0.05% (Pacifica) + 0.10% (TradeFighters)    │
│     - Creates/updates position                                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  5. WEBSOCKET REAL-TIME UPDATE                                    │
│     - Pacifica sends trade event via WebSocket                   │
│     - Frontend: Update React Query cache                         │
│     - Backend: Save trade to DB for terminal duels              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  6. BACKEND PROCESSING (Terminal Duels)                          │
│     - Find active duels for user                                 │
│     - Match trade to duel timeframe                              │
│     - Apply capital cap validation                               │
│     - Calculate PnL with exclusions                              │
│     - Broadcast DUEL_PNL_UPDATE event                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  7. UI UPDATE                                                     │
│     - React Query refetch positions                              │
│     - Display position with:                                     │
│       * Entry price                                              │
│       * Mark price (real-time)                                   │
│       * Unrealized PnL                                           │
│       * ROE%                                                      │
│       * Liquidation price                                        │
│     - Show toast notification with order_id                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Summary of Key Files

| File | Purpose |
|------|---------|
| [order-form.tsx](apps/web/src/app/(private)/terminal/components/order-form.tsx) | Main trading UI |
| [use-create-order.ts](apps/web/src/app/(private)/terminal/hooks/use-create-order.ts) | Market/limit order hooks |
| [use-set-leverage.ts](apps/web/src/app/(private)/terminal/hooks/use-set-leverage.ts) | Leverage management |
| [use-positions.ts](apps/web/src/app/(private)/terminal/hooks/use-positions.ts) | Position fetching |
| [use-set-tp-sl.ts](apps/web/src/app/(private)/terminal/hooks/use-set-tp-sl.ts) | TP/SL management |
| [use-cancel-order.ts](apps/web/src/app/(private)/terminal/hooks/use-cancel-order.ts) | Order cancellation |
| [use-account-info.ts](apps/web/src/app/(private)/terminal/hooks/use-account-info.ts) | Account balance/equity |
| [signing.ts](apps/web/src/lib/pacifica/signing.ts) | Wallet signature logic |
| [websocket-client.ts](apps/web/src/lib/pacifica/websocket-client.ts) | Frontend WebSocket client |
| [pacifica-websocket-provider.tsx](apps/web/src/providers/pacifica-websocket-provider.tsx) | WebSocket provider & hooks |
| [pacifica-websocket.service.ts](apps/api/src/modules/pacifica/pacifica-websocket.service.ts) | Backend WebSocket service |
| [pacifica.controller.ts](apps/api/src/modules/pacifica/pacifica.controller.ts) | Trade ingestion & PnL |
| [duel-resolver-terminal.service.ts](apps/api/src/modules/duel-resolver-terminal/duel-resolver-terminal.service.ts) | Duel resolution |

---

## Environment Variables

```env
# Pacifica API
NEXT_PUBLIC_PACIFICA_API_URL=https://api.pacifica.exchange
NEXT_PUBLIC_PACIFICA_WS_URL=wss://ws.pacifica.exchange
```

---

## Key Concepts Summary

1. **All orders require wallet signatures** - No traditional API keys
2. **Leverage affects margin and liquidation price** - Higher leverage = less margin, closer liquidation
3. **Positions updated real-time via WebSocket** - No polling needed for position updates
4. **Capital cap validation for terminal duels** - Prevents exceeding max position size
5. **PnL calculated from trade history** - Sum of netPnl from all valid trades
6. **Fees: 0.15% total** - 0.05% Pacifica + 0.10% TradeFighters
7. **Order size minimum: 0.01 tokens** - Rounded to LOT_SIZE
8. **Minimum balance: $100 USD** - Required to trade
