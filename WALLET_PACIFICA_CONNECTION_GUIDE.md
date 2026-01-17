# Wallet Connection & Pacifica Account Verification Guide

This guide documents how the wallet connection and Pacifica account verification flow works in TradeFighters. Use this as a reference for implementing similar functionality in other projects.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Provider Hierarchy](#provider-hierarchy)
4. [Solana Wallet Setup](#solana-wallet-setup)
5. [Authentication Flow](#authentication-flow)
6. [Wallet Validation](#wallet-validation)
7. [Pacifica Account Verification](#pacifica-account-verification)
8. [Account Info & Balance Fetching](#account-info--balance-fetching)
9. [Operation Signing](#operation-signing)
10. [WebSocket Integration](#websocket-integration)
11. [Complete Flow Diagram](#complete-flow-diagram)

---

## Overview

The connection flow works in stages:

1. **Wallet Connection** - User connects Solana wallet via wallet adapter
2. **Platform Authentication** - Wallet signs a nonce to authenticate with TradeFighters backend
3. **Wallet Validation** - Ensures connected wallet matches the registered wallet
4. **Pacifica Account Check** - Verifies the wallet has an account on Pacifica exchange
5. **Real-time Data** - WebSocket subscriptions for account data

**Key Concept**: Pacifica doesn't have traditional login - it uses the Solana wallet address as the account identifier. All operations are authenticated via wallet signatures.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  SolanaProvider (wallet adapter)                                │
│       ↓                                                         │
│  AuthProvider (JWT auth with wallet signature)                  │
│       ↓                                                         │
│  useValidatedAccount (wallet matches registered?)               │
│       ↓                                                         │
│  PacificaAccountGuard (account exists on Pacifica?)             │
│       ↓                                                         │
│  Terminal Components (trading UI)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Pacifica Exchange                             │
│  - REST API: /api/v1/account, /api/v1/orders, etc.              │
│  - WebSocket: Real-time prices, positions, orders               │
│  - Auth: Wallet signature verification                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Provider Hierarchy

The app wraps components in this order (from `layout.tsx`):

```tsx
<QueryProvider>              {/* TanStack React Query */}
  <SolanaProvider>           {/* Wallet Adapter */}
    <AuthProvider>           {/* JWT/Token Management */}
      <SocketProvider>       {/* WebSocket for duels */}
        <PacificaStateProvider>    {/* Event ordering (last_order_id) */}
          <PacificaWebSocketProvider>  {/* Trading data streams */}
            {children}
          </PacificaWebSocketProvider>
        </PacificaStateProvider>
      </SocketProvider>
    </AuthProvider>
  </SolanaProvider>
</QueryProvider>
```

---

## Solana Wallet Setup

**File**: `apps/web/src/providers/solana-provider.tsx`

### Implementation

```tsx
'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { FC, ReactNode, useMemo } from 'react';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_ENDPOINT || clusterApiUrl(network),
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

### Key Points

- **`wallets={[]}`**: Empty array lets wallet-standard auto-detect installed wallets (Phantom, Solflare, etc.)
- **`autoConnect`**: Attempts to reconnect on page reload
- **`endpoint`**: Configurable via `NEXT_PUBLIC_SOLANA_ENDPOINT` env var

### Dependencies

```bash
pnpm add @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/web3.js
```

---

## Authentication Flow

**File**: `apps/web/src/providers/auth-provider.tsx`

The authentication flow signs a nonce with the wallet to prove ownership.

### Step-by-Step Flow

```tsx
// 1. Get nonce from backend
const { message } = await apiClient.getNonce(walletAddress);

// 2. Encode message to bytes
const messageBytes = new TextEncoder().encode(message);

// 3. Sign with wallet (triggers wallet popup)
const signatureBytes = await signMessage(messageBytes);

// 4. Encode signature as base58
const signature = bs58.encode(signatureBytes);

// 5. Verify signature and get JWT token
const response = await apiClient.verifySignature({
  walletAddress,
  signature,
  message,
});

// 6. Store token and user data
login(response.accessToken, response.user);
```

### Full Implementation

```tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { publicKey, signMessage, connected, disconnect } = useWallet();

  // Prevent duplicate auth attempts
  const hasAttemptedRef = useRef(false);
  const isAuthenticatingRef = useRef(false);

  // Load stored auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Authenticate when wallet connects
  useEffect(() => {
    const authenticate = async () => {
      // Guards
      if (!connected || !publicKey || !signMessage) return;
      if (user) return; // Already authenticated
      if (hasAttemptedRef.current) return; // Already tried
      if (isAuthenticatingRef.current) return; // In progress

      hasAttemptedRef.current = true;
      isAuthenticatingRef.current = true;

      try {
        const walletAddress = publicKey.toBase58();

        // Step 1: Get nonce
        const { message } = await apiClient.getNonce(walletAddress);

        // Step 2: Sign message
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(messageBytes);
        const signature = bs58.encode(signatureBytes);

        // Step 3: Verify and get token
        const response = await apiClient.verifySignature({
          walletAddress,
          signature,
          message,
        });

        // Step 4: Store auth data
        login(response.accessToken, response.user);

      } catch (error) {
        console.error('Authentication failed:', error);

        // Check if user cancelled the signature request
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('User rejected') ||
            errorMessage.includes('cancelled')) {
          // User cancelled - disconnect wallet
          disconnect();
        }
      } finally {
        isAuthenticatingRef.current = false;
      }
    };

    authenticate();
  }, [connected, publicKey, signMessage, user, disconnect]);

  // Reset attempt flag when wallet disconnects
  useEffect(() => {
    if (!connected) {
      hasAttemptedRef.current = false;
    }
  }, [connected]);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    disconnect();
  }, [disconnect]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Error Handling

Handle these common scenarios:

```tsx
// User cancelled signature request
if (errorMessage.includes('User rejected')) {
  disconnect();
  return;
}

// Wallet doesn't support signing
if (!signMessage) {
  toast.error('Your wallet does not support message signing');
  disconnect();
  return;
}

// Network error
if (error.name === 'NetworkError') {
  toast.error('Network error. Please try again.');
  hasAttemptedRef.current = false; // Allow retry
  return;
}
```

---

## Wallet Validation

**File**: `apps/web/src/lib/hooks/use-validated-account.ts`

This hook ensures the connected wallet matches the registered wallet (prevents wallet switching).

### Implementation

```tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';

export interface ValidatedAccountResult {
  account: string | null;
  isValid: boolean;
  isAuthenticated: boolean;
  isWalletConnected: boolean;
  error: string | null;
}

export function useValidatedAccount(): ValidatedAccountResult {
  const { user, isAuthenticated } = useAuth();
  const { publicKey, connected } = useWallet();

  return useMemo(() => {
    // Case 1: User not authenticated
    if (!isAuthenticated || !user) {
      return {
        account: null,
        isValid: false,
        isAuthenticated: false,
        isWalletConnected: connected,
        error: 'User not authenticated',
      };
    }

    // Case 2: No wallet connected
    if (!connected || !publicKey) {
      return {
        account: null,
        isValid: false,
        isAuthenticated: true,
        isWalletConnected: false,
        error: 'Wallet not connected',
      };
    }

    const connectedWallet = publicKey.toBase58();

    // Case 3: Wallet mismatch - CRITICAL SECURITY CHECK
    if (connectedWallet !== user.walletAddress) {
      return {
        account: null,
        isValid: false,
        isAuthenticated: true,
        isWalletConnected: true,
        error: 'Connected wallet does not match registered wallet',
      };
    }

    // Case 4: Valid - all checks pass
    return {
      account: connectedWallet,
      isValid: true,
      isAuthenticated: true,
      isWalletConnected: true,
      error: null,
    };
  }, [user, isAuthenticated, publicKey, connected]);
}
```

### Usage

```tsx
function TradingComponent() {
  const { account, isValid, error } = useValidatedAccount();

  if (!isValid) {
    return <div className="text-red-500">{error}</div>;
  }

  // Safe to use account for trading operations
  return <OrderForm account={account} />;
}
```

---

## Pacifica Account Verification

**File**: `apps/web/src/app/(private)/terminal/components/pacifica-account-guard.tsx`

This component checks if the wallet has an account on Pacifica exchange.

### Implementation

```tsx
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useValidatedAccount } from '@/lib/hooks/use-validated-account';
import { pacificaApiClient } from '@/lib/pacifica/api-client';

interface PacificaAccountGuardProps {
  children: React.ReactNode;
}

export function PacificaAccountGuard({ children }: PacificaAccountGuardProps) {
  const { account } = useValidatedAccount();
  const queryClient = useQueryClient();

  const {
    data: accountInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['pacifica', 'account', account],
    queryFn: async () => {
      if (!account) throw new Error('Account address is required');
      const response = await pacificaApiClient.getAccountInfo(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: false,   // No auto-refetch
    retry: false,             // Don't auto-retry on error
    staleTime: Infinity,      // Keep data until manual refetch
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({
      queryKey: ['pacifica', 'account', account]
    });
  };

  // Show verification screen while checking
  if (isLoading) {
    return <PacificaVerificationScreen status="loading" />;
  }

  // Show error if account doesn't exist
  if (error || !accountInfo) {
    return (
      <PacificaVerificationScreen
        status="error"
        onRetry={handleRetry}
        message="No Pacifica account found for this wallet. Please create an account on Pacifica first."
      />
    );
  }

  // Account verified - render children
  return <>{children}</>;
}

function PacificaVerificationScreen({
  status,
  onRetry,
  message
}: {
  status: 'loading' | 'error';
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {status === 'loading' ? (
        <>
          <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent" />
          <p className="mt-4 text-neutral-400">Verifying Pacifica account...</p>
        </>
      ) : (
        <>
          <p className="text-red-400">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 bg-primary rounded hover:bg-primary/80"
            >
              Verify Again
            </button>
          )}
          <a
            href="https://pacifica.exchange"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-blue-400 hover:underline"
          >
            Go to Pacifica Exchange
          </a>
        </>
      )}
    </div>
  );
}
```

### Usage in Layout

```tsx
// apps/web/src/app/(private)/terminal/layout.tsx
export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PacificaAccountGuard>
      {children}
    </PacificaAccountGuard>
  );
}
```

---

## Account Info & Balance Fetching

**File**: `apps/web/src/lib/pacifica/api-client.ts`

### API Client Methods

```typescript
class PacificaApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.exchange';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get account info (balance, equity, margin)
   */
  async getAccountInfo(account: string): Promise<AccountInfoResponse> {
    const params = new URLSearchParams({ account });
    return this.request<AccountInfoResponse>(`/api/v1/account?${params.toString()}`);
  }

  /**
   * Get account settings (leverage per symbol)
   */
  async getAccountSettings(account: string): Promise<AccountSettingsResponse> {
    const params = new URLSearchParams({ account });
    return this.request<AccountSettingsResponse>(`/api/v1/account/settings?${params.toString()}`);
  }
}

export const pacificaApiClient = new PacificaApiClient();
```

### React Query Hooks

**File**: `apps/web/src/app/(private)/terminal/hooks/use-account-info.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { pacificaApiClient } from '@/lib/pacifica/api-client';

/**
 * Fetch account info with real-time polling
 */
export function useAccountInfo(account: string | null) {
  return useQuery({
    queryKey: ['pacifica', 'account', account],
    queryFn: async () => {
      if (!account) throw new Error('Account address is required');
      const response = await pacificaApiClient.getAccountInfo(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: 5000,  // Poll every 5 seconds
    staleTime: 3000,        // Consider stale after 3 seconds
  });
}

/**
 * Fetch account settings (leverage configuration)
 */
export function useAccountSettings(account: string | null) {
  return useQuery({
    queryKey: ['pacifica', 'account-settings', account],
    queryFn: async () => {
      if (!account) throw new Error('Account address is required');
      const response = await pacificaApiClient.getAccountSettings(account);
      return response.data;
    },
    enabled: !!account,
    refetchInterval: 30000,  // Poll every 30 seconds
    staleTime: 20000,
  });
}
```

### Account Info Response Schema

```typescript
// packages/shared/src/schemas/pacifica/account.ts
import { z } from 'zod/v4';

export const accountInfoSchema = z.object({
  account: z.string(),           // Wallet address
  balance: z.string(),           // Total balance (as string for precision)
  equity: z.string(),            // Current equity
  unrealized_pnl: z.string(),    // Unrealized P&L
  margin_used: z.string(),       // Margin currently in use
  available_balance: z.string(), // Available for trading
});

export type AccountInfo = z.infer<typeof accountInfoSchema>;
```

---

## Operation Signing

**File**: `apps/web/src/lib/pacifica/signing.ts`

All trading operations require wallet signatures for authentication.

### Core Signing Function

```typescript
import { WalletContextState } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export type PacificaOperationType =
  | 'create_market_order'
  | 'create_order'
  | 'cancel_order'
  | 'cancel_stop_order'
  | 'cancel_all_orders'
  | 'set_position_tpsl'
  | 'update_leverage'
  | 'approve_builder_code'
  | 'revoke_builder_code'
  | 'claim_referral_code';

/**
 * Recursively sort JSON keys (Pacifica spec requirement)
 * Ensures consistent message format for signature verification
 */
function recursivelySortJson(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(recursivelySortJson);
  }
  if (obj !== null && typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = recursivelySortJson((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}

/**
 * Sign a Pacifica operation with the wallet
 */
export async function signPacificaOperation<T extends Record<string, unknown>>(params: {
  wallet: WalletContextState;
  data: T;
  operationType: PacificaOperationType;
}): Promise<{ signature: string; timestamp: number }> {
  const { wallet, data, operationType } = params;

  // 1. Validate wallet
  if (!wallet.connected || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  if (!wallet.signMessage) {
    throw new Error('Wallet does not support message signing');
  }

  // 2. Create signing data structure
  const timestamp = Date.now();
  const dataToSign = {
    timestamp,
    expiry_window: 5000,  // 5 second expiry
    type: operationType,
    data: { ...data },
  };

  // 3. Sort keys recursively (required by Pacifica)
  const sortedData = recursivelySortJson(dataToSign);

  // 4. Convert to compact JSON string
  const message = JSON.stringify(sortedData);
  const messageBytes = new TextEncoder().encode(message);

  // 5. Sign with wallet
  const signatureBytes = await wallet.signMessage(messageBytes);

  // 6. Encode signature as base58
  const signature = bs58.encode(signatureBytes);

  return { signature, timestamp };
}
```

### Helper Functions for Common Operations

```typescript
/**
 * Create a signed market order
 */
export async function createSignedMarketOrder(
  wallet: WalletContextState,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    reduce_only?: boolean;
  }
) {
  return signPacificaOperation({
    wallet,
    operationType: 'create_market_order',
    data: {
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      reduce_only: params.reduce_only ?? false,
    },
  });
}

/**
 * Create a signed limit order
 */
export async function createSignedLimitOrder(
  wallet: WalletContextState,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    price: string;
    amount: string;
    reduce_only?: boolean;
    post_only?: boolean;
  }
) {
  return signPacificaOperation({
    wallet,
    operationType: 'create_order',
    data: {
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      amount: params.amount,
      reduce_only: params.reduce_only ?? false,
      post_only: params.post_only ?? false,
    },
  });
}

/**
 * Create a signed cancel order request
 */
export async function createSignedCancelOrder(
  wallet: WalletContextState,
  params: {
    order_id: number;
  }
) {
  return signPacificaOperation({
    wallet,
    operationType: 'cancel_order',
    data: {
      order_id: params.order_id,
    },
  });
}

/**
 * Create a signed leverage update
 */
export async function createSignedUpdateLeverage(
  wallet: WalletContextState,
  params: {
    symbol: string;
    leverage: string;
  }
) {
  return signPacificaOperation({
    wallet,
    operationType: 'update_leverage',
    data: {
      symbol: params.symbol,
      leverage: params.leverage,
    },
  });
}
```

### Sending Signed Request to Pacifica

```typescript
async createMarketOrder(
  account: string,
  params: MarketOrderParams,
  signature: string,
  timestamp: number
): Promise<OrderResponse> {
  return this.request<OrderResponse>('/api/v1/orders/market', {
    method: 'POST',
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
      expiry_window: 5000,
    }),
  });
}
```

---

## WebSocket Integration

**File**: `apps/web/src/providers/pacifica-websocket-provider.tsx`

### WebSocket Client

```typescript
class PacificaWebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string) {}

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Pacifica WebSocket connected');
      this.reconnectAttempts = 0;
      // Resubscribe to all channels
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }

  subscribe(channel: string, params: Record<string, any>, callback: (data: any) => void) {
    const key = this.getSubscriptionKey(channel, params);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());

      // Send subscription request
      this.send({
        method: 'subscribe',
        params: {
          source: channel,
          ...params,
        },
      });
    }

    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  private handleMessage(message: any) {
    const { channel, data } = message;
    const key = this.getSubscriptionKey(channel, message);

    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

### Provider and Hooks

```tsx
const PacificaWebSocketContext = createContext<PacificaWebSocketClient | null>(null);

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
 * Subscribe to order book
 */
export function usePacificaOrderBook(
  symbol: string | null,
  onData: (orderBook: WsOrderBookData) => void,
  aggLevel: number = 1
) {
  const client = useContext(PacificaWebSocketContext);

  useEffect(() => {
    if (!client || !symbol) return;

    return client.subscribe('book', { symbol, agg_level: aggLevel }, onData);
  }, [client, symbol, aggLevel, onData]);
}
```

---

## Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                                   │
└──────────────────────────────────────────────────────────────────────┘

1. USER OPENS APP
   │
   ▼
2. CONNECT WALLET (SolanaProvider)
   │  - User clicks "Connect Wallet"
   │  - Wallet modal opens
   │  - User selects wallet (Phantom, Solflare, etc.)
   │
   ▼
3. SIGN NONCE (AuthProvider)
   │  - Backend generates nonce
   │  - Wallet prompts for signature
   │  - Backend verifies signature
   │  - JWT token returned
   │
   ▼
4. VALIDATE WALLET (useValidatedAccount)
   │  - Check: Is user authenticated?
   │  - Check: Is wallet connected?
   │  - Check: Does connected wallet match registered wallet?
   │
   ▼
5. VERIFY PACIFICA ACCOUNT (PacificaAccountGuard)
   │  - Call: GET /api/v1/account?account={wallet}
   │  - If error: Show "Create account on Pacifica" message
   │  - If success: Proceed to terminal
   │
   ▼
6. LOAD ACCOUNT DATA
   │  - useAccountInfo: Balance, equity, margin
   │  - useAccountSettings: Leverage per symbol
   │  - WebSocket: Real-time positions, orders, trades
   │
   ▼
7. READY TO TRADE
   │  - User can view positions
   │  - User can place orders (signed with wallet)
   │  - User can manage leverage
   │
   ▼
8. EXECUTE TRADE
   │  - Sign operation with wallet
   │  - Send to Pacifica API with signature
   │  - Receive confirmation via WebSocket
   └─────────────────────────────────────────────────────────────────────
```

---

## Summary of Key Files

| File | Purpose |
|------|---------|
| `providers/solana-provider.tsx` | Wallet adapter setup |
| `providers/auth-provider.tsx` | JWT auth with wallet signature |
| `lib/hooks/use-validated-account.ts` | Validates wallet matches registered |
| `terminal/components/pacifica-account-guard.tsx` | Verifies Pacifica account exists |
| `lib/pacifica/api-client.ts` | REST API client |
| `lib/pacifica/signing.ts` | Operation signing with wallet |
| `providers/pacifica-websocket-provider.tsx` | Real-time data streams |
| `terminal/hooks/use-account-info.ts` | Account data hooks |

---

## Environment Variables

```env
# Solana RPC endpoint
NEXT_PUBLIC_SOLANA_ENDPOINT=https://api.devnet.solana.com

# Pacifica API
NEXT_PUBLIC_PACIFICA_API_URL=https://api.pacifica.exchange
NEXT_PUBLIC_PACIFICA_WS_URL=wss://ws.pacifica.exchange
```
