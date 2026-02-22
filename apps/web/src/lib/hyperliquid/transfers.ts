/**
 * Hyperliquid Transfer Utilities
 *
 * Withdraw: EIP-712 signed `withdraw3` action → POST to HL exchange endpoint
 * Deposit: On-chain Arbitrum USDC approve + bridge contract deposit
 *
 * IMPORTANT: Agent wallets CANNOT sign withdrawals. Only the user's main EVM wallet can.
 *
 * Network detection: uses NEXT_PUBLIC_HYPERLIQUID_API_URL env var,
 * same as the rest of the HL client code (ws adapter, datafeed, etc.).
 */

import type { Address, Hex } from 'viem';

// ─────────────────────────────────────────────────────────────
// Network Detection — from env var (same as rest of HL client code)
// ─────────────────────────────────────────────────────────────

const HL_API_URL = process.env.NEXT_PUBLIC_HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
export const IS_HL_TESTNET = HL_API_URL.includes('testnet');

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const ARBITRUM_ONE_CHAIN_ID = 42161;

// ─────────────────────────────────────────────────────────────
// Contract Addresses
// ─────────────────────────────────────────────────────────────

export const HL_CONTRACTS = {
  mainnet: {
    bridge: '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7' as Address,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    chainId: ARBITRUM_ONE_CHAIN_ID,
  },
  testnet: {
    bridge: '0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89' as Address,
    usdc: '0x1baAbB04529D43a73232B713C0FE471f7c7334d5' as Address,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
  },
} as const;

export function getHlContracts() {
  return IS_HL_TESTNET ? HL_CONTRACTS.testnet : HL_CONTRACTS.mainnet;
}

/** The Arbitrum chain ID for signing (Sepolia for testnet, One for mainnet) */
export function getHlChainId(): number {
  return IS_HL_TESTNET ? ARBITRUM_SEPOLIA_CHAIN_ID : ARBITRUM_ONE_CHAIN_ID;
}

// ─────────────────────────────────────────────────────────────
// EIP-712 Domain & Types for withdraw3
// ─────────────────────────────────────────────────────────────

function getWithdrawDomain() {
  return {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: getHlChainId(),
    verifyingContract: '0x0000000000000000000000000000000000000000' as Address,
  } as const;
}

const WITHDRAW_TYPES = {
  'HyperliquidTransaction:Withdraw': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'destination', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'time', type: 'uint64' },
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// Withdraw EIP-712 Typed Data Builder
// ─────────────────────────────────────────────────────────────

/**
 * Build EIP-712 typed data for the `withdraw3` action.
 * Amount is in USDC (e.g., "100" for $100).
 */
export function buildWithdraw3TypedData(amount: string, destination: string) {
  const nonce = Date.now();
  return {
    domain: getWithdrawDomain(),
    types: WITHDRAW_TYPES,
    primaryType: 'HyperliquidTransaction:Withdraw' as const,
    message: {
      hyperliquidChain: IS_HL_TESTNET ? 'Testnet' : 'Mainnet',
      destination,
      amount,
      time: BigInt(nonce),
    },
    nonce,
  };
}

// ─────────────────────────────────────────────────────────────
// Signature Splitting
// ─────────────────────────────────────────────────────────────

/**
 * Split a viem hex signature into { r, s, v } for the HL API.
 */
export function splitSignature(sig: Hex): { r: Hex; s: Hex; v: number } {
  const r = `0x${sig.slice(2, 66)}` as Hex;
  const s = `0x${sig.slice(66, 130)}` as Hex;
  const v = parseInt(sig.slice(130, 132), 16);
  return { r, s, v };
}

// ─────────────────────────────────────────────────────────────
// POST to Hyperliquid Exchange Endpoint
// ─────────────────────────────────────────────────────────────

/**
 * Post a signed action to the HL exchange endpoint.
 */
export async function postHyperliquidExchange(
  action: Record<string, unknown>,
  nonce: number,
  signature: { r: Hex; s: Hex; v: number },
  vaultAddress?: string,
): Promise<{ status: string; response?: unknown }> {
  const url = `${HL_API_URL}/exchange`;

  const body: Record<string, unknown> = {
    action,
    nonce,
    signature,
  };
  if (vaultAddress) {
    body.vaultAddress = vaultAddress;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HL API error: ${res.status}`);
  }

  // HL returns { status: "ok" } on success, or { status: "err", response: "..." }
  if (data.status === 'err') {
    throw new Error(data.response || 'Hyperliquid withdrawal failed');
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// Bridge Deposit ABIs (minimal)
// ─────────────────────────────────────────────────────────────

/** ERC-20 approve ABI */
export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Bridge2 deposit ABI — sendUsd(address destination, uint64 amount) */
export const BRIDGE_DEPOSIT_ABI = [
  {
    name: 'sendUsd',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'destination', type: 'address' },
      { name: 'amount', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

// USDC has 6 decimals on Arbitrum, but the bridge expects raw amounts in 6-decimal units
// HL then converts to 8-decimal internally.
export const USDC_DECIMALS = 6;

/**
 * Convert a human-readable USDC amount to raw units (6 decimals).
 * e.g., "100" → 100_000_000n
 */
export function parseUsdcAmount(amount: string): bigint {
  const [whole, frac = ''] = amount.split('.');
  const paddedFrac = frac.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS);
  return BigInt(whole + paddedFrac);
}
