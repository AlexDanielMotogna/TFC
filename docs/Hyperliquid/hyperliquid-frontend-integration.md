# Hyperliquid Frontend Integration Plan

## Overview

This document provides step-by-step instructions for integrating Hyperliquid exchange support into the TradeFightClub frontend, enabling users to switch between Pacifica (Solana) and Hyperliquid (EVM) exchanges.

**Status**: Backend fully tested ✅ | Frontend implementation pending 🚧

---

## Context & Constraints

### What's Already Working
- ✅ **Backend**: `hyperliquid-order-router.ts` - Fully tested on testnet (market, limit, stop orders, leverage, margin mode)
- ✅ **WS System**: `HyperliquidWsAdapter` - Factory pattern implementation
- ✅ **Signing Layer**: `HyperliquidSigner` - Client-side signing abstraction
- ✅ **API Routes**: All 10 routes accept `exchange` param and route correctly
- ✅ **Hooks**: `useOrders.ts` hooks are exchange-agnostic via `useSigner()`

### Current Limitations
- ❌ **Auth Flow**: `/api/auth/connect` only supports Solana wallets (Ed25519)
- ❌ **Frontend**: No EVM wallet support (need ECDSA signature verification)
- ❌ **UI**: No exchange switcher component
- ❌ **DB Constraint**: `ExchangeConnection.userId` has `@unique` - one exchange per user at a time (acceptable for MVP)

### Key Requirements
1. Add EVM wallet support (wagmi + viem)
2. Dual authentication system (Solana Ed25519 + EVM ECDSA)
3. Exchange switcher UI
4. Hyperliquid agent wallet setup flow (one-time)
5. Connection state synchronization

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ExchangeSwitcher UI → Select Pacifica or Hyperliquid       │
│         ↓                                                    │
│  WalletButton → Show Solana or EVM wallet based on exchange │
│         ↓                                                    │
│  Auth Hook → useAuth (Solana) OR useEvmAuth (EVM)          │
│         ↓                                                    │
│  API Call → /api/auth/connect OR /api/auth/connect-evm     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     Backend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Auth Service → Verify Ed25519 OR ECDSA signature          │
│         ↓                                                    │
│  Database → Store user + ExchangeConnection                 │
│         ↓                                                    │
│  Return JWT + exchange connection status                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Trading Flow (Existing)                    │
├─────────────────────────────────────────────────────────────┤
│  useSigner() → Get correct signer (Pacifica/Hyperliquid)   │
│         ↓                                                    │
│  API Routes → getOrderRouter(exchangeType)                  │
│         ↓                                                    │
│  Order Router → Execute on correct exchange                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Install EVM Wallet Dependencies

**File**: `apps/web/package.json`

**Action**: Add wagmi ecosystem packages

```bash
npm install wagmi viem @wagmi/connectors @wagmi/core
```

**Why**:
- `wagmi` - React hooks for Ethereum
- `viem` - TypeScript Ethereum library (faster than ethers)
- `@wagmi/connectors` - Wallet connectors (MetaMask, WalletConnect, etc.)
- `@wagmi/core` - Core wagmi functionality

**Already Have**:
- `@tanstack/react-query` ✅ (required by wagmi)
- `ethers` ✅ (for signature verification on backend)

**Verification**:
```bash
npm list wagmi viem @wagmi/connectors @wagmi/core
```

---

### Step 2: Create EVM Wallet Provider

**File**: `apps/web/src/components/EvmWalletProvider.tsx` (NEW)

**Purpose**: Configure and provide wagmi context for EVM wallets

**Implementation**:

```typescript
'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Create wagmi config
const config = createConfig({
  chains: [arbitrum, arbitrumSepolia],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});

// Create a separate QueryClient for wagmi (isolated from main app)
const queryClient = new QueryClient();

interface EvmWalletProviderProps {
  children: ReactNode;
}

export function EvmWalletProvider({ children }: EvmWalletProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Key Decisions**:
- **Chains**: Arbitrum Sepolia (testnet) + Arbitrum One (mainnet)
  - Hyperliquid requires Arbitrum for EVM compatibility
- **Connectors**:
  - `injected()` - Supports any injected wallet (MetaMask, Rainbow, etc.)
  - `metaMask()` - Specific MetaMask support
- **Separate QueryClient**: Prevents conflicts with main app's React Query instance

**Environment Variables** (add to `.env.local`):
```bash
NEXT_PUBLIC_ENABLE_TESTNETS=true  # For Arbitrum Sepolia
```

**Verification**:
- Provider compiles without errors
- No console warnings about missing dependencies

---

### Step 3: Wire EVM Provider into App

**File**: `apps/web/src/components/WalletProvider.tsx` (MODIFY)

**Current State**: Only wraps with Solana wallet providers

**Action**: Add EVM provider wrapper alongside Solana providers

**Implementation**:

```typescript
'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  // ... other Solana wallets
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';
import { EvmWalletProvider } from './EvmWalletProvider'; // NEW IMPORT

require('@solana/wallet-adapter-react-ui/styles.css');

export default function WalletProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // ... other wallets
    ],
    []
  );

  return (
    // EVM Provider wraps Solana providers - both are always active
    <EvmWalletProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {children}
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </EvmWalletProvider>
  );
}
```

**Key Point**: Both providers are ALWAYS mounted. The exchange context will determine which wallet UI to show.

**Verification**:
- No React errors about multiple QueryClient instances
- Both Solana and EVM wallet contexts are available

---

### Step 4: Create EVM Auth Hook

**File**: `apps/web/src/hooks/useEvmAuth.ts` (NEW)

**Purpose**: Handle EVM wallet authentication (parallel to `useAuth.ts` for Solana)

**Implementation**:

```typescript
'use client';

import { useCallback, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';

export function useEvmAuth() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const {
    token,
    evmWalletAddress,
    hyperliquidConnected,
    agentApproved,
    setToken,
    setEvmAuth,
    setHyperliquidConnected,
    logout
  } = useAuthStore();

  // Auto-login when EVM wallet connects
  useEffect(() => {
    if (isConnected && address && !token && !evmWalletAddress) {
      handleLogin();
    }
  }, [isConnected, address, token, evmWalletAddress]);

  const handleLogin = useCallback(async () => {
    if (!address) {
      toast.error('No wallet connected');
      return;
    }

    try {
      // Sign authentication message
      const signature = await signMessageAsync({ message: AUTH_MESSAGE });

      // Authenticate with backend
      const res = await fetch('/api/auth/connect-evm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Authentication failed');
      }

      const data = await res.json();

      // Update auth store
      setToken(data.token);
      setEvmAuth(address, data.hyperliquidConnected, data.agentApproved);

      toast.success('Connected to Hyperliquid');
    } catch (error: any) {
      console.error('EVM auth error:', error);
      if (error.message.includes('User rejected')) {
        toast.error('Signature rejected');
      } else {
        toast.error(error.message || 'Failed to authenticate');
      }
    }
  }, [address, signMessageAsync, setToken, setEvmAuth]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    logout();
  }, [disconnect, logout]);

  return {
    address,
    isConnected,
    connect,
    connectors,
    disconnect: handleDisconnect,
    login: handleLogin,
    hyperliquidConnected,
    agentApproved,
  };
}
```

**Key Features**:
- Auto-login when wallet connects (same pattern as Solana `useAuth`)
- Uses `personal_sign` (via `useSignMessage`) for authentication
- Stores state in same Zustand store as Solana auth
- Returns connection status (`hyperliquidConnected`, `agentApproved`)

**Verification**:
- Hook compiles without TypeScript errors
- Store methods exist (will add in Step 7)

---

### Step 5: Create EVM Auth API Endpoint

**File**: `apps/web/src/app/api/auth/connect-evm/route.ts` (NEW)

**Purpose**: Verify ECDSA signature and issue JWT for EVM wallets

**Implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateEvmWallet } from '@/lib/server/services/auth';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature } = await req.json();

    if (!walletAddress || !signature) {
      return NextResponse.json(
        { message: 'Missing walletAddress or signature' },
        { status: 400 }
      );
    }

    const result = await authenticateEvmWallet(walletAddress, signature);

    return NextResponse.json({
      token: result.token,
      user: result.user,
      hyperliquidConnected: result.hyperliquidConnected,
      agentApproved: result.agentApproved,
    });
  } catch (error: any) {
    console.error('EVM auth error:', error);
    return NextResponse.json(
      { message: error.message || 'Authentication failed' },
      { status: 401 }
    );
  }
}
```

**File**: `apps/web/src/lib/server/services/auth.ts` (MODIFY)

**Action**: Add `authenticateEvmWallet` function

**Implementation**:

```typescript
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { prisma } from '@tfc/db';

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';
const JWT_SECRET = process.env.JWT_SECRET!;

// Existing function for Solana wallets
export async function authenticateWallet(walletAddress: string, signature: string) {
  // ... existing Ed25519 verification ...
}

// NEW function for EVM wallets
export async function authenticateEvmWallet(walletAddress: string, signature: string) {
  // Verify ECDSA signature using ethers
  const recoveredAddress = ethers.verifyMessage(AUTH_MESSAGE, signature);

  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error('Invalid signature');
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: {
      exchangeConnections: {
        where: { exchangeType: 'hyperliquid' }
      }
    }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: walletAddress.toLowerCase(),
        handle: `hl-${walletAddress.slice(0, 6)}`,
      },
      include: {
        exchangeConnections: {
          where: { exchangeType: 'hyperliquid' }
        }
      }
    });
  }

  // Check Hyperliquid connection status
  const hlConnection = user.exchangeConnections.find(c => c.exchangeType === 'hyperliquid');
  const hyperliquidConnected = !!hlConnection;
  const agentApproved = hlConnection?.agentApproved || false;

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, walletAddress: user.walletAddress },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user,
    hyperliquidConnected,
    agentApproved,
  };
}
```

**Key Differences from Solana Auth**:
- Uses `ethers.verifyMessage()` instead of `nacl.sign.detached.verify()`
- Checks for `exchangeType: 'hyperliquid'` connection
- Returns `agentApproved` status (needed for agent wallet setup)

**Verification**:
- API route returns 200 with valid signature
- API route returns 401 with invalid signature
- User is created in DB on first login

---

### Step 6: Wire evmAddress into useSigner

**File**: `apps/web/src/hooks/useSigner.ts` (MODIFY - line 30)

**Current State**:
```typescript
const evmAddress = undefined; // Placeholder
```

**Action**: Get real EVM address from wagmi

**Implementation**:

```typescript
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount } from 'wagmi'; // NEW IMPORT
import { useMemo } from 'react';
import { createSigner } from '@/lib/signing/signer-factory';
import { useExchangeContext } from '@/contexts/ExchangeContext';

export function useSigner() {
  const { publicKey, signMessage: signSolanaMessage } = useWallet();
  const { address: evmAddress } = useAccount(); // CHANGED FROM undefined
  const { exchangeType } = useExchangeContext();

  const signer = useMemo(() => {
    return createSigner({
      exchangeType,
      solanaPublicKey: publicKey,
      signSolanaMessage,
      evmAddress,
    });
  }, [exchangeType, publicKey, signSolanaMessage, evmAddress]);

  return signer;
}
```

**Impact**: Now `HyperliquidSigner` gets the real EVM address and can package orders correctly

**Verification**:
- `useSigner()` returns HyperliquidSigner when `exchangeType === 'hyperliquid'` and EVM wallet is connected
- No TypeScript errors

---

### Step 7: Update Store & Exchange Context

**File**: `apps/web/src/lib/store.ts` (MODIFY)

**Action**: Add Hyperliquid-specific state fields

**Implementation**:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExchangeType } from '@tfc/shared';

interface AuthState {
  // Existing Solana auth
  token: string | null;
  walletAddress: string | null;
  pacificaConnected: boolean;

  // NEW: EVM auth for Hyperliquid
  evmWalletAddress: string | null;
  hyperliquidConnected: boolean;
  agentApproved: boolean;

  // NEW: Exchange selection
  exchangeType: ExchangeType | null;

  // Actions
  setToken: (token: string) => void;
  setWalletAddress: (address: string, connected: boolean) => void;
  setPacificaConnected: (connected: boolean) => void;

  // NEW: EVM actions
  setEvmAuth: (address: string, connected: boolean, approved: boolean) => void;
  setHyperliquidConnected: (connected: boolean) => void;
  setAgentApproved: (approved: boolean) => void;
  setExchangeType: (exchange: ExchangeType) => void;

  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Existing state
      token: null,
      walletAddress: null,
      pacificaConnected: false,

      // NEW state
      evmWalletAddress: null,
      hyperliquidConnected: false,
      agentApproved: false,
      exchangeType: null,

      // Existing actions
      setToken: (token) => set({ token }),
      setWalletAddress: (address, connected) =>
        set({ walletAddress: address, pacificaConnected: connected }),
      setPacificaConnected: (connected) => set({ pacificaConnected: connected }),

      // NEW actions
      setEvmAuth: (address, connected, approved) =>
        set({
          evmWalletAddress: address,
          hyperliquidConnected: connected,
          agentApproved: approved
        }),
      setHyperliquidConnected: (connected) => set({ hyperliquidConnected: connected }),
      setAgentApproved: (approved) => set({ agentApproved: approved }),
      setExchangeType: (exchange) => set({ exchangeType: exchange }),

      logout: () => set({
        token: null,
        walletAddress: null,
        pacificaConnected: false,
        evmWalletAddress: null,
        hyperliquidConnected: false,
        agentApproved: false,
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        walletAddress: state.walletAddress,
        pacificaConnected: state.pacificaConnected,
        evmWalletAddress: state.evmWalletAddress, // NEW
        hyperliquidConnected: state.hyperliquidConnected, // NEW
        agentApproved: state.agentApproved, // NEW
        exchangeType: state.exchangeType, // NEW
      }),
    }
  )
);
```

**File**: `apps/web/src/contexts/ExchangeContext.tsx` (MODIFY - lines 53-56)

**Current State**: Always returns `false` for Hyperliquid connection

**Action**: Read from store

**Implementation**:

```typescript
'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { ExchangeType, getExchangeConfig } from '@tfc/shared';
import { useAuthStore } from '@/lib/store';

// ... existing code ...

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const {
    exchangeType,
    setExchangeType,
    pacificaConnected,
    hyperliquidConnected // NEW
  } = useAuthStore();

  const currentExchangeType = exchangeType || 'pacifica';
  const exchangeConfig = getExchangeConfig(currentExchangeType);

  const isExchangeConnected = useCallback(() => {
    if (currentExchangeType === 'pacifica') {
      return pacificaConnected;
    }
    if (currentExchangeType === 'hyperliquid') {
      return hyperliquidConnected; // CHANGED from false
    }
    return false; // lighter
  }, [currentExchangeType, pacificaConnected, hyperliquidConnected]);

  const switchExchange = useCallback((exchange: ExchangeType) => {
    setExchangeType(exchange);
  }, [setExchangeType]);

  return (
    <ExchangeContext.Provider
      value={{
        exchangeType: currentExchangeType,
        exchangeConfig,
        isExchangeConnected: isExchangeConnected(),
        switchExchange,
      }}
    >
      {children}
    </ExchangeContext.Provider>
  );
}
```

**Verification**:
- Store persists EVM auth across page refreshes
- ExchangeContext correctly returns `hyperliquidConnected` status

---

### Step 8: Create Hyperliquid Connection Sync

**File**: `apps/web/src/components/HyperliquidConnectionSync.tsx` (NEW)

**Purpose**: Poll backend for Hyperliquid connection status (similar to `PacificaConnectionSync`)

**Implementation**:

```typescript
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { useEvmAuth } from '@/hooks/useEvmAuth';

export function HyperliquidConnectionSync() {
  const { token, setHyperliquidConnected, setAgentApproved } = useAuthStore();
  const { address } = useEvmAuth();

  useEffect(() => {
    if (!token || !address) return;

    // Poll every 3 seconds
    const poll = async () => {
      try {
        const res = await fetch('/api/auth/hyperliquid/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setHyperliquidConnected(data.connected);
          setAgentApproved(data.agentApproved);
        }
      } catch (error) {
        console.error('Failed to sync Hyperliquid connection:', error);
      }
    };

    poll(); // Initial poll
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [token, address, setHyperliquidConnected, setAgentApproved]);

  return null; // No UI
}
```

**File**: `apps/web/src/app/api/auth/hyperliquid/me/route.ts` (NEW)

**Purpose**: Return Hyperliquid connection status for authenticated user

**Implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@tfc/db';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        exchangeConnections: {
          where: { exchangeType: 'hyperliquid' }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const hlConnection = user.exchangeConnections[0];

    return NextResponse.json({
      connected: !!hlConnection,
      agentApproved: hlConnection?.agentApproved || false,
      accountAddress: hlConnection?.accountAddress || null,
    });
  } catch (error) {
    console.error('Hyperliquid /me error:', error);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
```

**Where to Mount**: Add `<HyperliquidConnectionSync />` to `apps/web/src/app/providers.tsx` alongside `<PacificaConnectionSync />`

**Verification**:
- Connection status updates in store when agent wallet is set up
- Polling stops when user logs out

---

### Step 9: Exchange Switcher UI

**File**: `apps/web/src/components/ExchangeSwitcher.tsx` (NEW)

**Purpose**: Dropdown/tabs to switch between Pacifica and Hyperliquid

**Implementation**:

```typescript
'use client';

import { useExchangeContext } from '@/contexts/ExchangeContext';
import { ExchangeType } from '@tfc/shared';
import { useState } from 'react';

export function ExchangeSwitcher() {
  const { exchangeType, switchExchange } = useExchangeContext();
  const [isOpen, setIsOpen] = useState(false);

  const exchanges: { type: ExchangeType; label: string; logo: string }[] = [
    { type: 'pacifica', label: 'Pacifica', logo: '/images/exchanges/pacifica.png' },
    { type: 'hyperliquid', label: 'Hyperliquid', logo: '/images/exchanges/hyperliquid.png' },
  ];

  const currentExchange = exchanges.find(e => e.type === exchangeType);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
      >
        {currentExchange && (
          <>
            <img src={currentExchange.logo} alt={currentExchange.label} className="w-5 h-5" />
            <span className="text-sm font-medium">{currentExchange.label}</span>
          </>
        )}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50">
          {exchanges.map((exchange) => (
            <button
              key={exchange.type}
              onClick={() => {
                switchExchange(exchange.type);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                exchange.type === exchangeType ? 'bg-surface-700' : ''
              }`}
            >
              <img src={exchange.logo} alt={exchange.label} className="w-6 h-6" />
              <span className="text-sm">{exchange.label}</span>
              {exchange.type === exchangeType && (
                <svg className="w-4 h-4 ml-auto text-win-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Where to Place**: Add to `Header` or `Navbar` component (next to WalletButton)

**Design Notes**:
- Shows current exchange logo + name
- Dropdown with all available exchanges
- Checkmark on active exchange
- Closes on selection

**Verification**:
- Clicking switches `exchangeType` in store
- UI updates immediately
- Persists across page refresh

---

### Step 10: Update Wallet Button

**File**: `apps/web/src/components/WalletButton.tsx` (MODIFY)

**Current State**: Only shows Solana `WalletMultiButton`

**Action**: Show different wallet button based on `exchangeType`

**Implementation**:

```typescript
'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { useEvmAuth } from '@/hooks/useEvmAuth';
import { useAccount } from 'wagmi';
import { useState } from 'react';

export function WalletButton() {
  const { exchangeType } = useExchangeContext();
  const { connect, connectors, disconnect, address } = useEvmAuth();
  const { isConnected } = useAccount();
  const [showConnectors, setShowConnectors] = useState(false);

  // Pacifica → Solana wallet
  if (exchangeType === 'pacifica') {
    return <WalletMultiButton />;
  }

  // Hyperliquid → EVM wallet
  if (exchangeType === 'hyperliquid') {
    if (isConnected && address) {
      return (
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm font-medium transition-colors"
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      );
    }

    return (
      <div className="relative">
        <button
          onClick={() => setShowConnectors(!showConnectors)}
          className="px-4 py-2 bg-win-500 hover:bg-win-400 rounded-lg text-sm font-medium transition-colors"
        >
          Connect Wallet
        </button>

        {showConnectors && (
          <div className="absolute top-full mt-2 right-0 w-48 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  connect({ connector });
                  setShowConnectors(false);
                }}
                className="w-full px-4 py-3 hover:bg-surface-700 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null; // Lighter or unknown exchange
}
```

**Behavior**:
- **Pacifica**: Shows familiar Solana wallet button
- **Hyperliquid**: Shows EVM connect button with connector dropdown (MetaMask, etc.)
- Connected state: Shows truncated address with disconnect on click

**Verification**:
- Button changes when switching exchanges
- MetaMask prompts on connect
- Address displays correctly

---

### Step 11: Hyperliquid Agent Setup Flow

**File**: `apps/web/src/components/HyperliquidSetup.tsx` (NEW)

**Purpose**: One-time modal for approving agent wallet on Hyperliquid

**Implementation**:

```typescript
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useSignTypedData, useAccount } from 'wagmi';
import { toast } from 'sonner';

export function HyperliquidSetup() {
  const { token, agentApproved, setAgentApproved } = useAuthStore();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'init' | 'signing' | 'submitting' | 'complete'>('init');

  const handleSetup = async () => {
    if (!token || !address) return;

    setIsLoading(true);
    setStep('init');

    try {
      // Step 1: Request EIP-712 typed data from backend
      const initRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!initRes.ok) {
        throw new Error('Failed to initialize setup');
      }

      const { typedData } = await initRes.json();

      // Step 2: Sign EIP-712 approveAgent message
      setStep('signing');
      const signature = await signTypedDataAsync(typedData);

      // Step 3: Submit signature to backend
      setStep('submitting');
      const submitRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature }),
      });

      if (!submitRes.ok) {
        throw new Error('Failed to complete setup');
      }

      // Step 4: Done
      setStep('complete');
      setAgentApproved(true);
      toast.success('Hyperliquid agent wallet approved!');
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Setup failed');
      setStep('init');
    } finally {
      setIsLoading(false);
    }
  };

  if (agentApproved) return null; // Don't show if already approved

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Setup Hyperliquid Trading</h2>

        {step === 'init' && (
          <>
            <p className="text-surface-300 mb-6">
              To trade on Hyperliquid, you need to approve a delegated agent wallet.
              This allows the backend to sign orders on your behalf without exposing your main wallet's private key.
            </p>
            <button
              onClick={handleSetup}
              disabled={isLoading}
              className="w-full py-3 bg-win-500 hover:bg-win-400 rounded-lg font-medium disabled:opacity-50"
            >
              {isLoading ? 'Setting up...' : 'Approve Agent Wallet'}
            </button>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-win-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-surface-300">Check your wallet to sign the message...</p>
          </div>
        )}

        {step === 'submitting' && (
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-win-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-surface-300">Submitting to Hyperliquid...</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-win-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-bold mb-2">Setup Complete!</h3>
            <p className="text-surface-300">You can now trade on Hyperliquid</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**File**: `apps/web/src/app/api/auth/hyperliquid/setup/route.ts` (NEW)

**Purpose**: Handle agent wallet generation and approval

**Implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { Wallet } from 'ethers';
import { prisma } from '@tfc/db';
import { encryptKey } from '@/lib/server/key-vault';

const JWT_SECRET = process.env.JWT_SECRET!;
const HL_API_URL = process.env.NEXT_PUBLIC_HL_API_URL || 'https://api.hyperliquid-testnet.xyz';

// POST: Generate agent wallet and return EIP-712 typed data
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { walletAddress } = await req.json();

    // Generate new agent wallet
    const agentWallet = Wallet.createRandom();
    const agentAddress = agentWallet.address;

    // Build EIP-712 typed data for approveAgent
    // (Copy from apps/web/src/scripts/setup-hyperliquid-testnet.ts lines 48-70)
    const typedData = {
      domain: {
        name: 'Exchange',
        version: '1',
        chainId: 421614, // Arbitrum Sepolia testnet
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      types: {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' },
        ],
      },
      primaryType: 'Agent',
      message: {
        source: 'a',
        connectionId: agentAddress,
      },
    };

    // Store agent private key temporarily (will encrypt after approval)
    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        // Store in a temp field or session - we'll move to ExchangeConnection after approval
        // For now, use a JSON field or create a pending connection
      }
    });

    return NextResponse.json({
      typedData,
      agentAddress,
    });
  } catch (error) {
    console.error('Setup POST error:', error);
    return NextResponse.json({ message: 'Failed to generate agent wallet' }, { status: 500 });
  }
}

// PUT: Submit signed approveAgent to Hyperliquid API
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { signature } = await req.json();

    // Retrieve agent wallet from temp storage
    // const agentPrivateKey = ...

    // Submit to Hyperliquid API
    const hlRes = await fetch(`${HL_API_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: {
          type: 'approveAgent',
          hyperliquidChain: 'Testnet',
          signatureChainId: '0x66eee',
          agentAddress,
          agentName: 'TFC Agent',
          nonce: Date.now(),
        },
        signature,
        vaultAddress: null,
      }),
    });

    if (!hlRes.ok) {
      throw new Error('Hyperliquid rejected agent approval');
    }

    // Encrypt and store agent key
    const encryptedKey = encryptKey(agentPrivateKey);

    await prisma.exchangeConnection.upsert({
      where: {
        userId_exchangeType: {
          userId: decoded.userId,
          exchangeType: 'hyperliquid',
        }
      },
      update: {
        agentApproved: true,
        agentWalletAddress: agentAddress,
        encryptedAgentKey: encryptedKey,
      },
      create: {
        userId: decoded.userId,
        exchangeType: 'hyperliquid',
        accountAddress: walletAddress,
        agentApproved: true,
        agentWalletAddress: agentAddress,
        encryptedAgentKey: encryptedKey,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup PUT error:', error);
    return NextResponse.json({ message: 'Failed to approve agent' }, { status: 500 });
  }
}
```

**Where to Mount**: Add `<HyperliquidSetup />` to trade page when `exchangeType === 'hyperliquid' && !agentApproved`

**Reused Code**:
- EIP-712 types from `apps/web/src/scripts/setup-hyperliquid-testnet.ts` (lines 48-70)
- Key encryption from `apps/web/src/lib/server/key-vault.ts`

**Verification**:
- Modal appears when switching to Hyperliquid without agent
- Wallet prompts for EIP-712 signature
- Backend submits to Hyperliquid API
- `agentApproved` updates in store
- Modal dismisses

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| **Install** | `apps/web/package.json` | Add wagmi, viem, @wagmi/connectors |
| **New** | `apps/web/src/components/EvmWalletProvider.tsx` | Wagmi config + provider |
| **New** | `apps/web/src/hooks/useEvmAuth.ts` | EVM wallet authentication hook |
| **New** | `apps/web/src/app/api/auth/connect-evm/route.ts` | EVM auth endpoint |
| **New** | `apps/web/src/app/api/auth/hyperliquid/me/route.ts` | Connection status endpoint |
| **New** | `apps/web/src/app/api/auth/hyperliquid/setup/route.ts` | Agent wallet setup endpoint |
| **New** | `apps/web/src/components/HyperliquidConnectionSync.tsx` | Connection polling component |
| **New** | `apps/web/src/components/HyperliquidSetup.tsx` | Agent approval modal |
| **New** | `apps/web/src/components/ExchangeSwitcher.tsx` | Exchange selector UI |
| **Modify** | `apps/web/src/components/WalletProvider.tsx` | Add EVM provider wrapper |
| **Modify** | `apps/web/src/components/WalletButton.tsx` | Show correct wallet for exchange |
| **Modify** | `apps/web/src/hooks/useSigner.ts` | Wire wagmi useAccount for evmAddress |
| **Modify** | `apps/web/src/contexts/ExchangeContext.tsx` | Read hyperliquidConnected from store |
| **Modify** | `apps/web/src/lib/store.ts` | Add HL state fields + actions |
| **Modify** | `apps/web/src/lib/server/services/auth.ts` | Add authenticateEvmWallet function |

**Total**: 8 new files, 6 modified files

---

## Existing Code to Reuse

| File | What to Reuse | Location |
|------|---------------|----------|
| `apps/web/src/scripts/setup-hyperliquid-testnet.ts` | EIP-712 types for `approveAgent` | Lines 48-70 |
| `apps/web/src/lib/server/key-vault.ts` | `encryptKey()` / `decryptKey()` | Entire file |
| `apps/web/src/lib/signing/signer-factory.ts` | `createSigner()` — already handles EVM | Entire file |
| `apps/web/src/hooks/usePacificaConnection.ts` | Pattern for connection polling | Entire file |
| `apps/web/src/components/PacificaConnectionSync.tsx` | Pattern for sync component | Entire file |

---

## Verification Checklist

After implementation, verify each step:

### Auth Flow
- [ ] Switch to Hyperliquid → MetaMask connect button appears
- [ ] Connect MetaMask → wallet prompts for signature
- [ ] Signature accepted → JWT issued, logged in
- [ ] Refresh page → auth state persists

### Agent Setup
- [ ] No agent → modal appears automatically
- [ ] Click "Approve Agent Wallet" → MetaMask prompts EIP-712 signature
- [ ] Sign → backend submits to Hyperliquid API
- [ ] Success → `agentApproved = true`, modal dismisses
- [ ] Refresh → modal doesn't reappear

### Trading
- [ ] After setup → `isExchangeConnected` returns `true`
- [ ] Trade panel enabled
- [ ] Place market order → backend signs with agent wallet → order appears on HL
- [ ] Open orders fetch correctly
- [ ] Positions display with correct PnL

### Exchange Switching
- [ ] Switch to Pacifica → Solana wallet button appears
- [ ] Existing Pacifica flows work (no regression)
- [ ] Switch back to Hyperliquid → EVM wallet button returns
- [ ] All state persists across switches

### WebSocket
- [ ] Prices update in real-time when on Hyperliquid exchange
- [ ] No errors in console from WS adapter

### Edge Cases
- [ ] Disconnect wallet → logout works
- [ ] Invalid signature → error message shown
- [ ] Network error during setup → graceful error handling
- [ ] Multiple tabs → state syncs correctly

---

## Environment Variables

Add to `.env.local`:

```bash
# Existing
JWT_SECRET=your-secret-key
DATABASE_URL=your-db-url

# New for Hyperliquid
NEXT_PUBLIC_HL_API_URL=https://api.hyperliquid-testnet.xyz  # or mainnet
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

---

## Database Schema Changes

**No schema changes needed!**

Existing `ExchangeConnection` model already supports Hyperliquid:

```prisma
model ExchangeConnection {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  exchangeType         String   // 'pacifica' | 'hyperliquid' | 'lighter'
  accountAddress       String   // EVM address for HL

  agentApproved        Boolean  @default(false)  // Already exists
  agentWalletAddress   String?                   // Already exists
  encryptedAgentKey    String?                   // Already exists

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([userId, exchangeType])
}
```

Just set `exchangeType: 'hyperliquid'` when creating HL connections.

---

## Testing Strategy

### Unit Tests
- `authenticateEvmWallet()` — signature verification
- `encryptKey()` / `decryptKey()` — agent key security
- `createSigner()` — returns HyperliquidSigner for EVM wallets

### Integration Tests
- Full auth flow (connect → sign → JWT)
- Agent setup flow (generate → sign → submit)
- Order placement (market, limit, stop)

### Manual Testing
1. Fresh user flow (no existing account)
2. Existing Pacifica user switching to HL
3. Multiple devices (state sync)
4. Network failures (offline → online)

---

## Rollout Plan

### Phase 1: Backend Only (Current State ✅)
- Hyperliquid order router tested
- WS adapter working
- Signing layer complete

### Phase 2: Auth + Setup (Steps 1-8)
- EVM wallet support
- Agent wallet approval
- Connection sync
- **Goal**: Users can connect + approve agent

### Phase 3: UI + Trading (Steps 9-11)
- Exchange switcher
- Wallet button updates
- Full trading flow
- **Goal**: Users can switch + trade

### Phase 4: Polish
- Error handling refinement
- Loading states
- Toast notifications
- Analytics

---

## Security Considerations

### Agent Wallet Security
- **Private keys encrypted at rest** using AES-256-GCM (key-vault.ts)
- **Keys never sent to frontend** — only used server-side for signing
- **One agent per user** — enforced by DB unique constraint
- **User approval required** — explicit EIP-712 signature on Hyperliquid blockchain

### Auth Security
- **JWT expiry**: 7 days
- **Signature verification**: Both ECDSA (EVM) and Ed25519 (Solana) verified on backend
- **HTTPS only**: All API calls over TLS
- **No private keys in browser**: Only wallet addresses + signatures

### Database Security
- **Encrypted agent keys**: Using key-vault with strong encryption
- **User isolation**: Connection belongs to userId (Cascade delete)
- **No sensitive data in logs**: Private keys never logged

---

## Troubleshooting

### Common Issues

**Issue**: "Module not found: @wagmi/core"
- **Fix**: `npm install @wagmi/core`

**Issue**: "Invalid signature" on auth
- **Fix**: Ensure message is exactly `"Sign this message to authenticate with Trading Fight Club"` (no extra spaces/newlines)

**Issue**: EIP-712 signature fails
- **Fix**: Check `chainId` matches Arbitrum Sepolia (421614) or Arbitrum One (42161)

**Issue**: Agent approval rejected by Hyperliquid
- **Fix**: Verify testnet vs mainnet URL, check `hyperliquidChain` field

**Issue**: Store not persisting
- **Fix**: Check `partialize` includes all new fields in `persist()` config

---

## Next Steps After Implementation

1. **Testing**: Run full test suite on testnet
2. **Monitoring**: Add analytics for exchange usage
3. **Optimization**: Consider adding WalletConnect for mobile support
4. **Documentation**: Update user-facing docs with Hyperliquid guide
5. **Mainnet**: Switch API URLs to mainnet once tested

---

## Support & References

- [Wagmi Docs](https://wagmi.sh)
- [Viem Docs](https://viem.sh)
- [Hyperliquid API Docs](https://hyperliquid.gitbook.io)
- [EIP-712 Spec](https://eips.ethereum.org/EIPS/eip-712)
- [Arbitrum Docs](https://docs.arbitrum.io)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-20
**Author**: TradeFightClub Team
