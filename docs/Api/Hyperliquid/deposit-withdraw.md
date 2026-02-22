# Hyperliquid — Deposit & Withdraw Reference

> **Source**: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
> **Last updated**: 2026-02-22

---

## Table of Contents

1. [Overview](#overview)
2. [Deposit (Bridge2)](#deposit-bridge2)
3. [Withdraw (withdraw3)](#withdraw-withdraw3)
4. [Internal USDC Transfer (usdSend)](#internal-usdc-transfer-usdsend)
5. [Spot ↔ Perp Transfer (usdClassTransfer)](#spot--perp-transfer-usdclasstransfer)
6. [Generalized Asset Transfer (sendAsset)](#generalized-asset-transfer-sendasset)
7. [Vault Deposit/Withdraw (vaultTransfer)](#vault-depositwithdraw-vaulttransfer)
8. [Spot Token Transfer (spotSend)](#spot-token-transfer-spotsend)
9. [Staking Deposit/Withdraw](#staking-depositwithdraw)
10. [Query Account Balance](#query-account-balance)
11. [Query Ledger History](#query-ledger-history)
12. [Signing Methods](#signing-methods)
13. [Contract Addresses](#contract-addresses)
14. [Rate Limits](#rate-limits)
15. [TFC Integration Notes](#tfc-integration-notes)

---

## Overview

Hyperliquid has multiple fund movement methods:

| Method | Type | Use Case | Signing |
|--------|------|----------|---------|
| **Bridge2 deposit** | On-chain (Arbitrum) | Deposit USDC from Arbitrum to HL | Arbitrum TX |
| **withdraw3** | Exchange action | Withdraw USDC from HL to Arbitrum | `sign_user_signed_action` |
| **usdSend** | Exchange action | Transfer USDC to another HL address | `sign_user_signed_action` |
| **usdClassTransfer** | Exchange action | Move USDC between spot ↔ perp wallet | `sign_user_signed_action` |
| **sendAsset** | Exchange action | Generalized transfer (DEX, spot, users, subaccounts) | `sign_user_signed_action` |
| **spotSend** | Exchange action | Transfer spot tokens to another HL address | `sign_user_signed_action` |
| **vaultTransfer** | Exchange action | Deposit/withdraw from vaults | `sign_l1_action` |
| **cDeposit** | Exchange action | Deposit native token to staking | `sign_user_signed_action` |
| **cWithdraw** | Exchange action | Withdraw native token from staking | `sign_user_signed_action` |

**Key distinction**: `sign_user_signed_action` uses human-readable EIP-712 format (wallet-friendly). `sign_l1_action` uses L1 action hashing. User-signed actions do NOT support `expiresAfter`.

**IMPORTANT**: Agent wallets (API wallets) can only use `sign_l1_action` actions (trading, leverage, vaultTransfer). They CANNOT sign `withdraw3`, `usdSend`, `usdClassTransfer`, `sendAsset`, or `spotSend` — only the main wallet can.

---

## Deposit (Bridge2)

Deposits happen on-chain on Arbitrum — the user sends USDC to the bridge contract.

### Bridge Contract Addresses

| Environment | Bridge | USDC Token |
|-------------|--------|------------|
| **Mainnet** | `0x2df1c51e09aecf9cacb7bc98cb1742757f163df7` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| **Testnet** | `0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89` | `0x1baAbB04529D43a73232B713C0FE471f7c7334d5` |

### How It Works

1. User approves USDC spending to bridge contract (one-time, on Arbitrum)
2. User sends USDC to bridge contract (Arbitrum transaction)
3. Bridge credits the sender's HL account within ~1 minute
4. Funds appear in **perp wallet** by default

### Constraints

- **Minimum deposit: 5 USDC** — amounts below this are permanently lost
- Chain: Arbitrum (chain ID 42161 mainnet, 421614 testnet)
- No HL API call needed — it's a direct smart contract interaction

### Deposit with Permit (EIP-2612)

For depositing on behalf of another user via `batchedDepositWithPermit`:

```typescript
const domain = {
  name: isMainnet ? "USD Coin" : "USDC2",
  version: isMainnet ? "2" : "1",
  chainId: isMainnet ? 42161 : 421614,
  verifyingContract: isMainnet
    ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"  // Arbitrum USDC
    : "0x1baAbB04529D43a73232B713C0FE471f7c7334d5", // Testnet USDC
};

const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },     // bridge address
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
```

### Programmatic Deposit (TypeScript)

```typescript
import { createWalletClient, http, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';

const BRIDGE_ADDRESS = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// Step 1: Approve USDC spending (if not already approved)
const approveTx = await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: ['function approve(address spender, uint256 amount) returns (bool)'],
  functionName: 'approve',
  args: [BRIDGE_ADDRESS, parseUnits(amount, 6)],  // USDC = 6 decimals
});

// Step 2: Send USDC to bridge
const depositTx = await walletClient.writeContract({
  address: BRIDGE_ADDRESS,
  abi: ['function deposit(uint256 amount) external'],
  functionName: 'deposit',
  args: [parseUnits(amount, 6)],
});

// Step 3: Wait ~1 minute for credit on HL
```

---

## Withdraw (withdraw3)

Initiates withdrawal from HL to Arbitrum via the bridge.

### Endpoint

`POST https://api.hyperliquid.xyz/exchange`

### Request

```json
{
  "action": {
    "type": "withdraw3",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "amount": "100",
    "time": 1716531066415,
    "destination": "0x835192aeC06e536CC641fb34123801EAECf4d067"
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... }
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"withdraw3"` |
| `hyperliquidChain` | string | `"Mainnet"` or `"Testnet"` |
| `signatureChainId` | string | `"0xa4b1"` (Arbitrum mainnet) or `"0x66eee"` (Arbitrum Sepolia) |
| `amount` | string | USD amount as string (e.g., `"100"` for $100) |
| `time` | number | Current timestamp in milliseconds. **Must match `nonce`** |
| `destination` | string | 42-character hex recipient address |

### Signing (EIP-712)

```typescript
const typedData = {
  types: {
    "HyperliquidTransaction:Withdraw": [
      { name: "hyperliquidChain", type: "string" },
      { name: "destination", type: "string" },
      { name: "amount", type: "string" },
      { name: "time", type: "uint64" },
    ]
  },
  primaryType: "HyperliquidTransaction:Withdraw",
  domain: {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 42161,  // Arbitrum
    verifyingContract: "0x0000000000000000000000000000000000000000",
  },
  message: {
    hyperliquidChain: "Mainnet",
    destination: "0x835192aeC06e536CC641fb34123801EAECf4d067",
    amount: "100",
    time: 1716531066415,
  }
};
```

### Response

```json
{ "status": "ok", "response": { "type": "default" } }
```

### Constraints

- **$1 withdrawal fee**
- **~5 minutes** for finalization (validators sign and send to Arbitrum bridge)
- Amount must be <= `withdrawable` from `clearinghouseState` query
- **Agent wallets CANNOT withdraw** — only the main wallet can sign this

---

## Internal USDC Transfer (usdSend)

Transfer USDC to another HL address without touching the Arbitrum bridge. Instant and free.

### Request

```json
{
  "action": {
    "type": "usdSend",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "destination": "0x0000000000000000000000000000000000000000",
    "amount": "50",
    "time": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... }
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"usdSend"` |
| `hyperliquidChain` | string | `"Mainnet"` or `"Testnet"` |
| `signatureChainId` | string | `"0xa4b1"` for Arbitrum |
| `destination` | string | Recipient HL address (42-char hex) |
| `amount` | string | USD amount (e.g., `"50"`) |
| `time` | number | Timestamp in ms, must match nonce |

### Signing (EIP-712)

```typescript
const typedData = {
  types: {
    "HyperliquidTransaction:UsdSend": [
      { name: "hyperliquidChain", type: "string" },
      { name: "destination", type: "string" },
      { name: "amount", type: "string" },
      { name: "time", type: "uint64" },
    ]
  },
  primaryType: "HyperliquidTransaction:UsdSend",
  domain: {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 42161,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  },
  message: { hyperliquidChain: "Mainnet", destination: "0x...", amount: "50", time: 1716531066415 }
};
```

### Constraints

- **No `expiresAfter` support**
- **Agent wallets CANNOT call this** — main wallet only
- Instant, no fee
- Transfers from perp balance

---

## Spot ↔ Perp Transfer (usdClassTransfer)

Move USDC between the user's spot wallet and perp wallet.

### Request

```json
{
  "action": {
    "type": "usdClassTransfer",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "amount": "100",
    "toPerp": true,
    "nonce": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... }
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"usdClassTransfer"` |
| `amount` | string | USD amount. For subaccount: `"100" subaccount:0x...` |
| `toPerp` | boolean | `true` = spot → perp, `false` = perp → spot |
| `nonce` | number | Must match outer nonce |

### Constraints

- **Agent wallets CANNOT call this** — main wallet only
- Instant, no fee

---

## Generalized Asset Transfer (sendAsset)

Transfer tokens between perp DEXs, spot, users, and subaccounts.

### Request

```json
{
  "action": {
    "type": "sendAsset",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "destination": "0x0000000000000000000000000000000000000000",
    "sourceDex": "",
    "destinationDex": "spot",
    "token": "PURR:0xc4bf3f870c0e9465323c0b6ed28096c2",
    "amount": "10",
    "fromSubAccount": "",
    "nonce": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... }
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `sourceDex` | string | `""` = default USDC perp DEX, `"spot"` = spot wallet, or DEX name |
| `destinationDex` | string | Same options as sourceDex |
| `token` | string | `"tokenName:tokenId"` format |
| `fromSubAccount` | string | 42-char hex address of subaccount, or `""` |

### Constraints

- Only collateral tokens can transfer to/from perp DEXs
- **Agent wallets CANNOT call this** — main wallet only

---

## Vault Deposit/Withdraw (vaultTransfer)

Add or remove funds from a vault.

### Request

```json
{
  "action": {
    "type": "vaultTransfer",
    "vaultAddress": "0x0000000000000000000000000000000000000000",
    "isDeposit": true,
    "usd": 100
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... },
  "expiresAfter": 1716531076415
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `vaultAddress` | string | 42-char hex vault address |
| `isDeposit` | boolean | `true` = deposit, `false` = withdraw |
| `usd` | number | USD amount (NOT string, unlike other actions) |

### Constraints

- Uses `sign_l1_action` (NOT user-signed — different signing!)
- Supports `expiresAfter`
- Master account signs on behalf of subaccounts/vaults

---

## Spot Token Transfer (spotSend)

Transfer spot assets to another address (no bridge involvement).

### Request

```json
{
  "action": {
    "type": "spotSend",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "destination": "0x0000000000000000000000000000000000000000",
    "token": "PURR:0xc1fb593aeffbeb02f85e0308e9956a90",
    "amount": "0.1",
    "time": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": { "r": "...", "s": "...", "v": ... }
}
```

### Signing (EIP-712)

```typescript
const typedData = {
  types: {
    "HyperliquidTransaction:SpotSend": [
      { name: "hyperliquidChain", type: "string" },
      { name: "destination", type: "string" },
      { name: "token", type: "string" },
      { name: "amount", type: "string" },
      { name: "time", type: "uint64" },
    ]
  },
  primaryType: "HyperliquidTransaction:SpotSend",
  domain: {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 42161,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  },
  message: {
    hyperliquidChain: "Mainnet",
    destination: "0x...",
    token: "PURR:0xc1fb593aeffbeb02f85e0308e9956a90",
    amount: "0.1",
    time: 1716531066415,
  }
};
```

---

## Staking Deposit/Withdraw

### Deposit to Staking (cDeposit)

```json
{
  "action": {
    "type": "cDeposit",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "wei": 1000000000000000000,
    "nonce": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": {}
}
```

### Withdraw from Staking (cWithdraw)

```json
{
  "action": {
    "type": "cWithdraw",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "wei": 1000000000000000000,
    "nonce": 1716531066415
  },
  "nonce": 1716531066415,
  "signature": {}
}
```

- `wei`: amount in wei (18 decimals) as a **number** (not string)
- **Unstaking queue: 7 days**
- Delegation lockup: 1 day per validator

---

## Query Account Balance

### Perp Account State (clearinghouseState)

```json
POST https://api.hyperliquid.xyz/info
{
  "type": "clearinghouseState",
  "user": "0x835192aeC06e536CC641fb34123801EAECf4d067"
}
```

**Response:**

```json
{
  "marginSummary": {
    "accountValue": "13109.482328",     // Total equity
    "totalMarginUsed": "4.967826",      // Margin in use
    "totalNtlPos": "100.02765",         // Total notional position
    "totalRawUsd": "13009.454678"       // Available USD balance
  },
  "crossMarginSummary": {
    "accountValue": "13104.514502",
    "totalMarginUsed": "0.0",
    "totalNtlPos": "0.0",
    "totalRawUsd": "13104.514502"
  },
  "withdrawable": "13104.514502",       // Max withdrawable amount
  "crossMaintenanceMarginUsed": "0.0",
  "assetPositions": [ ... ],
  "time": 1708622398623
}
```

**Key fields for deposit/withdraw:**
- `withdrawable` — maximum amount user can withdraw RIGHT NOW
- `marginSummary.totalRawUsd` — liquid USD available
- `marginSummary.accountValue` — total equity including unrealized PnL

### Spot Account State (spotClearinghouseState)

```json
POST https://api.hyperliquid.xyz/info
{
  "type": "spotClearinghouseState",
  "user": "0x835192aeC06e536CC641fb34123801EAECf4d067"
}
```

**Response:**

```json
{
  "balances": [
    {
      "coin": "USDC",
      "token": 0,
      "hold": "0.0",
      "total": "14.625485",
      "entryNtl": "0.0"
    },
    {
      "coin": "PURR",
      "token": 1,
      "hold": "0",
      "total": "2000",
      "entryNtl": "1234.56"
    }
  ]
}
```

---

## Query Ledger History

### Non-Funding Ledger Updates (deposits, transfers, withdrawals)

```json
POST https://api.hyperliquid.xyz/info
{
  "type": "userNonFundingLedgerUpdates",
  "user": "0x835192aeC06e536CC641fb34123801EAECf4d067",
  "startTime": 1700000000000
}
```

Returns deposit, transfer, and withdrawal events.

### Funding History

```json
POST https://api.hyperliquid.xyz/info
{
  "type": "userFunding",
  "user": "0x835192aeC06e536CC641fb34123801EAECf4d067",
  "startTime": 1700000000000
}
```

---

## Signing Methods

Hyperliquid has TWO signing schemes:

### 1. `sign_l1_action` (L1 Actions)

Used for: **order, cancel, cancelByCloid, modify, batchModify, updateLeverage, updateIsolatedMargin, vaultTransfer, scheduleCancel, twapOrder, twapCancel, reserveRequestWeight, noop**

- Hashes action fields with msgpack, then signs with EIP-712
- Supports `expiresAfter`
- **Agent wallets CAN sign these**

### 2. `sign_user_signed_action` (User-Signed Actions)

Used for: **withdraw3, usdSend, spotSend, usdClassTransfer, sendAsset, cDeposit, cWithdraw, tokenDelegate, approveAgent, approveBuilderFee, userDexAbstraction, userSetAbstraction**

- Human-readable EIP-712 typed data (wallet-friendly)
- Does NOT support `expiresAfter`
- **Agent wallets CANNOT sign these — main wallet ONLY**

### EIP-712 Domain (User-Signed Actions)

```typescript
const domain = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: 42161,  // Arbitrum mainnet (421614 for testnet)
  verifyingContract: "0x0000000000000000000000000000000000000000",
};
```

### Signature Format

All signatures use EIP-712 `signTypedData` and return `{ r, s, v }`:

```typescript
const signature = await wallet.signTypedData(typedData);
// Split into { r: "0x...", s: "0x...", v: 27 | 28 }
```

### Common Signing Errors

1. Wrong private key (not main wallet or agent)
2. Field order matters for msgpack (L1 actions)
3. Trailing zeroes on numbers
4. Uppercase in address fields — **always lowercase before signing**
5. Different signing scheme used (L1 vs user-signed)

---

## Contract Addresses

| What | Mainnet | Testnet |
|------|---------|---------|
| Bridge | `0x2df1c51e09aecf9cacb7bc98cb1742757f163df7` | `0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89` |
| USDC (Arbitrum) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x1baAbB04529D43a73232B713C0FE471f7c7334d5` |
| Arbitrum Chain ID | 42161 | 421614 |
| HL Signature Chain ID | `0xa4b1` | `0x66eee` |

---

## Rate Limits

| Action Type | Weight | Limit |
|-------------|--------|-------|
| All exchange actions (unbatched) | 1 | 1200/min per IP |
| Batched (n items) | `1 + floor(n/40)` | 1200/min per IP |
| `clearinghouseState` query | 2 | 600/min per IP |
| `spotClearinghouseState` query | 2 | 600/min per IP |
| WebSocket connections | — | Max 10 per IP |
| WebSocket new connections | — | Max 30/min |
| WebSocket subscriptions | — | Max 1000 |

### Address-Based Rate Limits

- 1 request per 1 USDC traded cumulatively
- Initial buffer: 10,000 requests
- When rate limited: 1 request per 10 seconds
- Cancels get `min(limit + 100000, limit * 2)`
- Can buy extra requests via `reserveRequestWeight` at 0.0005 USDC/request

---

## TFC Integration Notes

### What TFC Needs for Deposit/Withdraw

1. **Deposit**: User does this in the HL UI or via Arbitrum TX — TFC doesn't need to handle it programmatically (the user deposits before connecting to TFC)

2. **Withdraw**: Requires main wallet signature (`sign_user_signed_action`). **The TFC agent wallet CANNOT withdraw** — this is by design for security. If TFC needs to support withdrawals, it must be done client-side with the user's wallet.

3. **Internal transfer (usdSend)**: Could be used for prize pool distribution, but requires main wallet. Agent wallet cannot do it.

4. **Check balance**: Use `clearinghouseState` to check `withdrawable` amount before attempting withdrawal.

### Agent Wallet Limitations

The agent wallet (approved via `approveAgent`) can ONLY:
- Place/cancel/modify orders
- Update leverage
- Update isolated margin
- Vault transfers
- Schedule cancels
- TWAP orders
- Reserve request weight

It CANNOT:
- Withdraw (`withdraw3`)
- Transfer USDC (`usdSend`)
- Transfer between spot/perp (`usdClassTransfer`)
- Send assets (`sendAsset`)
- Send spot tokens (`spotSend`)
- Approve new agents (`approveAgent`)

### Pre-Withdrawal Check

```typescript
// Before withdrawing, check available amount
const state = await fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'clearinghouseState',
    user: address,
  }),
}).then(r => r.json());

const maxWithdrawable = parseFloat(state.withdrawable);
// Subtract $1 fee
const effectiveMax = maxWithdrawable - 1;
```

### Flow for TFC User

```
1. User deposits USDC on Arbitrum → Bridge → HL perp wallet
   (user does this manually or in HL UI)

2. User connects to TFC → approveAgent (main wallet signs)
   (TFC stores agent wallet key encrypted)

3. TFC trades via agent wallet (sign_l1_action)

4. User withdraws from HL → Arbitrum
   (user does this in HL UI — TFC cannot trigger this)
```
