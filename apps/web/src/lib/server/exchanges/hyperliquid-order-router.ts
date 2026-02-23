/**
 * Hyperliquid Order Router
 *
 * Server-side signing: backend signs with stored agent wallet private key (ECDSA / EIP-712).
 * Frontend sends order params only — no client signature needed after one-time agent approval.
 *
 * Signing scheme:
 * - L1 actions (orders, cancels, leverage): EIP-712 "phantom agent" construction
 *   1. Serialize action with msgpack
 *   2. Append nonce (8 bytes BE) + vault marker
 *   3. Hash with keccak256 → connectionId
 *   4. Sign EIP-712 { Agent: { source, connectionId } } with agent wallet
 *
 * - User-signed actions (withdraw, approveAgent): EIP-712 direct signing
 *   Signed client-side, not handled here
 */

import { ethers } from 'ethers';
import { encode as msgpackEncode } from '@msgpack/msgpack';
import { prisma } from '@tfc/db';
import { decryptKey } from '../key-vault';
import { getHlAssetIndex, getHlSzDecimals } from './hyperliquid-adapter';
import type {
  ExchangeOrderRouter,
  OrderResult,
  CreateOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  StopOrderParams,
  CancelStopOrderParams,
  EditOrderParams,
  BatchOrderParams,
  SetTpSlParams,
  SetLeverageParams,
  SetMarginParams,
  WithdrawParams,
} from './order-router';

const HL_API_URL = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
const HL_IS_MAINNET = !HL_API_URL.includes('testnet');
const HL_BUILDER_ADDRESS = process.env.HYPERLIQUID_BUILDER_ADDRESS || '';
const HL_BUILDER_FEE = parseInt(process.env.HYPERLIQUID_BUILDER_FEE || '50', 10); // tenths of bps (50 = 5 bps = 0.05%)

// ─────────────────────────────────────────────────────────────
// EIP-712 Constants
// ─────────────────────────────────────────────────────────────

const L1_ACTION_DOMAIN: ethers.TypedDataDomain = {
  name: 'Exchange',
  version: '1',
  chainId: 1337,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

const L1_TYPES = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
};

const USER_SIGNED_DOMAIN: ethers.TypedDataDomain = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 421614, // 0x66eee — Arbitrum Sepolia
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

// ─────────────────────────────────────────────────────────────
// Signing helpers
// ─────────────────────────────────────────────────────────────

/** Convert number to 8-byte big-endian Uint8Array */
function toUint64BE(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(n));
  return new Uint8Array(buf);
}

/**
 * Recursively strip undefined values from an object for clean msgpack encoding.
 * Numbers stay as JS numbers — @msgpack/msgpack encodes them correctly
 * (int32 for small, float64 for large or decimal).
 */
function prepareForMsgpack(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(prepareForMsgpack);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = prepareForMsgpack(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Create the action hash (connectionId) for phantom agent signing.
 *
 * hash = keccak256(msgpack(action) + uint64BE(nonce) + vaultMarker)
 */
function createActionHash(
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): string {
  const actionBytes = msgpackEncode(prepareForMsgpack(action));
  const nonceBytes = toUint64BE(nonce);

  // Build parts: action + nonce + vault marker
  const parts: Uint8Array[] = [new Uint8Array(actionBytes), nonceBytes];

  if (vaultAddress) {
    const addrBytes = ethers.getBytes(vaultAddress);
    const marker = new Uint8Array(1 + 20);
    marker[0] = 0x01;
    marker.set(addrBytes, 1);
    parts.push(marker);
  } else {
    parts.push(new Uint8Array([0x00]));
  }

  const combined = ethers.concat(parts);
  return ethers.keccak256(combined);
}

/** Split a 65-byte signature into { r, s, v } */
function splitSignature(sig: string): { r: string; s: string; v: number } {
  const raw = sig.startsWith('0x') ? sig.slice(2) : sig;
  return {
    r: '0x' + raw.slice(0, 64),
    s: '0x' + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

/**
 * Sign an L1 action using the phantom agent construction.
 * Returns { r, s, v } signature object.
 */
async function signL1Action(
  wallet: ethers.Wallet,
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): Promise<{ r: string; s: string; v: number }> {
  const connectionId = createActionHash(action, nonce, vaultAddress);

  const sig = await wallet.signTypedData(L1_ACTION_DOMAIN, L1_TYPES, {
    source: HL_IS_MAINNET ? 'a' : 'b',
    connectionId,
  });

  return splitSignature(sig);
}

// ─────────────────────────────────────────────────────────────
// Wire format helpers
// ─────────────────────────────────────────────────────────────

/**
 * Matches Python SDK float_to_wire exactly:
 *   rounded = f"{x:.8f}"
 *   normalized = Decimal(rounded).normalize()
 *   return f"{normalized:f}"
 *
 * Round to 8 decimal places, strip trailing zeros.
 */
function floatToWire(x: number | string): string {
  const num = typeof x === 'string' ? parseFloat(x) : x;
  // Round to 8 decimal places (matches Python's f"{x:.8f}")
  const rounded = parseFloat(num.toFixed(8));
  if (rounded === 0 || Object.is(rounded, -0)) return '0';
  // Normalize: strip trailing zeros after decimal point
  let result = rounded.toFixed(8);
  if (result.includes('.')) {
    result = result.replace(/0+$/, '').replace(/\.$/, '');
  }
  return result;
}

/**
 * Calculate the slippage-adjusted price for market orders.
 * Matches Python SDK _slippage_price exactly:
 *   px *= (1 + slippage) if is_buy else (1 - slippage)
 *   return round(float(f"{px:.5g}"), 6 - szDecimals)
 */
function slippagePrice(px: number, isBuy: boolean, slippage: number, szDecimals: number): number {
  const adjusted = isBuy ? px * (1 + slippage) : px * (1 - slippage);
  // Round to 5 significant figures (matches Python's f"{px:.5g}")
  const sigFig = parseFloat(adjusted.toPrecision(5));
  // Round to (6 - szDecimals) decimal places for perps
  const maxDecimals = Math.max(0, 6 - szDecimals);
  return parseFloat(sigFig.toFixed(maxDecimals));
}

/** Denormalize symbol: "BTC-USD" → "BTC" */
function denormalizeSymbol(symbol: string): string {
  return symbol.replace(/-USD$/, '');
}

interface OrderWire {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: string } } | { trigger: { isMarket: boolean; triggerPx: string; tpsl: string } };
  c?: string;
}

/** Build the builder code object if configured */
function getBuilderCode(): { b: string; f: number } | undefined {
  if (!HL_BUILDER_ADDRESS) return undefined;
  return { b: HL_BUILDER_ADDRESS.toLowerCase(), f: HL_BUILDER_FEE };
}

// ─────────────────────────────────────────────────────────────
// Price helper
// ─────────────────────────────────────────────────────────────

/** Fetch the current mid price for a coin from HL */
async function getMidPrice(coin: string): Promise<number> {
  const response = await fetch(`${HL_API_URL}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
    signal: AbortSignal.timeout(5000),
  });
  const mids = await response.json() as Record<string, string>;
  const mid = mids[coin];
  if (!mid) throw new Error(`No mid price found for ${coin}`);
  return parseFloat(mid);
}

// ─────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────

/** JSON replacer that converts BigInt to Number for serialization */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function hlExchange(body: Record<string, unknown>): Promise<OrderResult> {
  const bodyJson = JSON.stringify(body, bigintReplacer);
  console.log('[HLRouter] POST /exchange', bodyJson.slice(0, 500));

  const response = await fetch(`${HL_API_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyJson,
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();
  console.log('[HLRouter] Response:', { status: response.status, body: responseText.slice(0, 500) });

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    return { success: false, error: `Failed to parse Hyperliquid response: ${responseText}` };
  }

  // Hyperliquid returns { status: "ok", response: { type: "order", data: { statuses: [...] } } }
  // or { status: "err", response: "error message" }
  if (result.status === 'err') {
    return { success: false, error: typeof result.response === 'string' ? result.response : JSON.stringify(result.response) };
  }

  // For order responses, check individual order statuses
  const resp = result.response;
  if (resp?.type === 'order' && resp?.data?.statuses) {
    const statuses = resp.data.statuses as Array<Record<string, unknown>>;
    const firstStatus = statuses[0];

    if (firstStatus?.error) {
      return { success: false, error: firstStatus.error as string };
    }

    // Extract fill info for the frontend toast
    if (firstStatus?.filled) {
      const filled = firstStatus.filled as { totalSz: string; avgPx: string; oid: number };
      return {
        success: true,
        data: {
          ...resp,
          order_id: filled.oid,
          avg_price: filled.avgPx,
          filled_size: filled.totalSz,
          status: 'filled',
        },
      };
    }

    if (firstStatus?.resting) {
      const resting = firstStatus.resting as { oid: number };
      return {
        success: true,
        data: {
          ...resp,
          order_id: resting.oid,
          status: 'resting',
        },
      };
    }
  }

  return { success: true, data: resp || result };
}

// ─────────────────────────────────────────────────────────────
// Agent wallet management
// ─────────────────────────────────────────────────────────────

/**
 * Load the agent wallet for a given user account address.
 * Decrypts the stored private key and returns an ethers.Wallet.
 */
async function getAgentWallet(accountAddress: string): Promise<ethers.Wallet> {
  const connection = await prisma.exchangeConnection.findFirst({
    where: {
      accountAddress: accountAddress.toLowerCase(),
      exchangeType: 'hyperliquid',
      isActive: true,
    },
    select: {
      encryptedKeyData: true,
      agentApproved: true,
      builderApproved: true,
    },
  });

  if (!connection) {
    throw new Error('No Hyperliquid connection found for this account');
  }

  if (!connection.agentApproved) {
    throw new Error('Agent wallet not yet approved. Complete the one-time setup first.');
  }

  if (!connection.encryptedKeyData) {
    throw new Error('No agent wallet key stored. Complete the one-time setup first.');
  }

  const privateKey = decryptKey(connection.encryptedKeyData);
  return new ethers.Wallet(privateKey);
}

// ─────────────────────────────────────────────────────────────
// Account state helpers (fetch current leverage/margin mode)
// ─────────────────────────────────────────────────────────────

interface HlLeverageInfo {
  type: string; // 'cross' or 'isolated'
  value: number;
}

/** Fetch current margin mode for a specific asset. Returns true if cross, false if isolated. */
async function getAssetMarginMode(account: string, symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`${HL_API_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: account }),
      signal: AbortSignal.timeout(10000),
    });
    const state = await response.json() as {
      assetPositions: Array<{ position: { coin: string; leverage: HlLeverageInfo } }>;
    };

    const coin = symbol.replace('-USD', '').replace('-PERP', '');
    const pos = state.assetPositions.find(ap => ap.position.coin === coin);
    if (pos) {
      return pos.position.leverage.type === 'cross';
    }
    return true; // Default to cross if no position/setting found
  } catch {
    return true; // Default to cross on error
  }
}

/** Fetch current leverage for a specific asset. */
async function getAssetLeverage(account: string, symbol: string): Promise<number> {
  try {
    const response = await fetch(`${HL_API_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: account }),
      signal: AbortSignal.timeout(10000),
    });
    const state = await response.json() as {
      assetPositions: Array<{ position: { coin: string; leverage: HlLeverageInfo } }>;
    };

    const coin = symbol.replace('-USD', '').replace('-PERP', '');
    const pos = state.assetPositions.find(ap => ap.position.coin === coin);
    if (pos) {
      return pos.position.leverage.value;
    }
    return 5; // Default leverage if no position/setting found
  } catch {
    return 5; // Default on error
  }
}

// ─────────────────────────────────────────────────────────────
// Router implementation
// ─────────────────────────────────────────────────────────────

export class HyperliquidOrderRouter implements ExchangeOrderRouter {
  readonly exchangeType = 'hyperliquid' as const;
  readonly signsServerSide = true;

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const coin = denormalizeSymbol(params.symbol);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const szDecimals = getHlSzDecimals(coin);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';
      const nonce = Date.now();

      let orderWire: OrderWire;

      if (params.type === 'MARKET') {
        // Market orders: aggressive IOC limit at slippage price.
        // Matches Python SDK: market_open → _slippage_price → float_to_wire
        const px = params.price ? parseFloat(String(params.price)) : null;
        const midPrice = px || await getMidPrice(coin);
        const slippagePct = parseFloat(params.slippage_percent || '5') / 100; // Default 5% like Python SDK
        const limitPx = slippagePrice(midPrice, isBuy, slippagePct, szDecimals);

        console.log('[HLRouter] Market order:', { coin, midPrice, slippagePct, limitPx, wire: floatToWire(limitPx), szDecimals, isBuy, size: floatToWire(params.amount) });

        orderWire = {
          a: assetIndex,
          b: isBuy,
          p: floatToWire(limitPx),
          s: floatToWire(params.amount),
          r: params.reduce_only || false,
          t: { limit: { tif: 'Ioc' } },
        };
      } else {
        // Limit order: price goes through float_to_wire directly
        if (!params.price) {
          return { success: false, error: 'Price required for limit orders' };
        }
        const tif = params.tif || 'Gtc';
        const hlTif = tif.charAt(0).toUpperCase() + tif.slice(1).toLowerCase();

        orderWire = {
          a: assetIndex,
          b: isBuy,
          p: floatToWire(params.price),
          s: floatToWire(params.amount),
          r: params.reduce_only || false,
          t: { limit: { tif: hlTif } },
        };
      }

      // Build action
      const action: Record<string, unknown> = {
        type: 'order',
        orders: [orderWire],
        grouping: 'na',
      };

      // Attach builder code if configured
      const builder = getBuilderCode();
      if (builder) action.builder = builder;

      // If TP/SL attached to the order, use grouping
      if (params.take_profit || params.stop_loss) {
        const groupOrders: OrderWire[] = [orderWire];

        if (params.take_profit) {
          groupOrders.push({
            a: assetIndex,
            b: !isBuy,
            p: floatToWire(params.take_profit.stop_price),
            s: floatToWire(params.amount),
            r: true,
            t: { trigger: { isMarket: true, triggerPx: floatToWire(params.take_profit.stop_price), tpsl: 'tp' } },
          });
        }

        if (params.stop_loss) {
          groupOrders.push({
            a: assetIndex,
            b: !isBuy,
            p: floatToWire(params.stop_loss.stop_price),
            s: floatToWire(params.amount),
            r: true,
            t: { trigger: { isMarket: true, triggerPx: floatToWire(params.stop_loss.stop_price), tpsl: 'sl' } },
          });
        }

        action.orders = groupOrders;
        action.grouping = 'normalTpsl';
      }

      const signature = await signL1Action(wallet, action, nonce);

      const result = await hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });

      // Auto-reset builderApproved flag when HL tells us it's not approved
      if (!result.success && result.error?.includes('Builder fee has not been approved')) {
        console.warn('[HLRouter] Builder fee not approved — resetting flag for', params.account);
        await prisma.exchangeConnection.updateMany({
          where: { accountAddress: params.account.toLowerCase(), exchangeType: 'hyperliquid' },
          data: { builderApproved: false },
        });
      }

      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelOrder(params: CancelOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const nonce = Date.now();

      const action: Record<string, unknown> = {
        type: 'cancel',
        cancels: [{ a: assetIndex, o: parseInt(params.order_id, 10) }],
      };

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelAllOrders(params: CancelAllOrdersParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const nonce = Date.now();

      // Hyperliquid doesn't have a native "cancel all" — we need to fetch open orders
      // and cancel them individually. For a single symbol, cancel by asset index.
      if (params.symbol) {
        const assetIndex = await getHlAssetIndex(params.symbol);
        // Use scheduleCancel to cancel all orders for this asset
        const action: Record<string, unknown> = {
          type: 'scheduleCancel',
          time: null, // null = cancel immediately (dead man's switch: cancel all)
        };

        // Actually, scheduleCancel is for the dead man's switch.
        // For cancel all, we fetch open orders then batch cancel.
        const { default: fetch } = await import('node-fetch' as string).catch(() => ({ default: globalThis.fetch }));
        const ordersResp = await globalThis.fetch(`${HL_API_URL}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'openOrders', user: params.account }),
        });
        const orders = await ordersResp.json() as Array<{ coin: string; oid: number }>;

        const coin = params.symbol.replace(/-USD$/, '');
        const toCancel = orders.filter((o) => o.coin === coin);

        if (toCancel.length === 0) {
          return { success: true, data: { cancelled_count: 0 } };
        }

        const cancelAction: Record<string, unknown> = {
          type: 'cancel',
          cancels: toCancel.map((o) => ({ a: assetIndex, o: o.oid })),
        };

        const signature = await signL1Action(wallet, cancelAction, nonce);
        return hlExchange({ action: cancelAction, nonce, signature, vaultAddress: null });
      } else {
        // Cancel ALL orders across all symbols
        const ordersResp = await globalThis.fetch(`${HL_API_URL}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'openOrders', user: params.account }),
        });
        const orders = await ordersResp.json() as Array<{ coin: string; oid: number }>;

        if (orders.length === 0) {
          return { success: true, data: { cancelled_count: 0 } };
        }

        // Group cancels by asset index
        const cancels: Array<{ a: number; o: number }> = [];
        for (const o of orders) {
          const idx = await getHlAssetIndex(`${o.coin}-USD`);
          cancels.push({ a: idx, o: o.oid });
        }

        const cancelAction: Record<string, unknown> = {
          type: 'cancel',
          cancels,
        };

        const signature = await signL1Action(wallet, cancelAction, nonce);
        return hlExchange({ action: cancelAction, nonce, signature, vaultAddress: null });
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async createStopOrder(params: StopOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';
      const nonce = Date.now();

      const isMarket = !params.stop_order.limit_price;

      // Determine tpsl based on order direction:
      // Hyperliquid uses 'tp' when trigger fires on price moving UP, 'sl' when DOWN.
      // - Buy stop (isBuy=true): trigger is ABOVE current price → fires on price UP → 'tp'
      // - Sell stop (isBuy=false): trigger is BELOW current price → fires on price DOWN → 'sl'
      const tpsl = isBuy ? 'tp' : 'sl';

      const orderWire: OrderWire = {
        a: assetIndex,
        b: isBuy,
        p: isMarket
          ? floatToWire(params.stop_order.stop_price) // For market stops, trigger price doubles as price
          : floatToWire(params.stop_order.limit_price!),
        s: floatToWire(params.stop_order.amount),
        r: params.reduce_only,
        t: {
          trigger: {
            isMarket,
            triggerPx: floatToWire(params.stop_order.stop_price),
            tpsl,
          },
        },
      };

      const action: Record<string, unknown> = {
        type: 'order',
        orders: [orderWire],
        grouping: 'na',
      };

      const builder = getBuilderCode();
      if (builder) action.builder = builder;

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelStopOrder(params: CancelStopOrderParams): Promise<OrderResult> {
    // Stop orders on HL are just regular orders with trigger type — same cancel mechanism
    return this.cancelOrder({
      account: params.account,
      order_id: params.order_id,
      symbol: params.symbol,
      signature: params.signature,
      timestamp: params.timestamp,
    });
  }

  async editOrder(params: EditOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const nonce = Date.now();

      // Hyperliquid "modify" action
      // We need the original order's side — fetch it from open orders
      const ordersResp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'openOrders', user: params.account }),
      });
      const orders = await ordersResp.json() as Array<{ oid: number; side: 'A' | 'B'; coin: string }>;

      const orderId = params.order_id ? parseInt(params.order_id, 10) : undefined;
      const existingOrder = orders.find((o) =>
        orderId ? o.oid === orderId : false
      );

      if (!existingOrder) {
        return { success: false, error: `Order ${params.order_id} not found in open orders` };
      }

      const isBuy = existingOrder.side === 'B';

      const modifyWire = {
        oid: existingOrder.oid,
        order: {
          a: assetIndex,
          b: isBuy,
          p: floatToWire(params.price),
          s: floatToWire(params.amount),
          r: false,
          t: { limit: { tif: 'Gtc' } },
        },
      };

      const action: Record<string, unknown> = {
        type: 'batchModify',
        modifies: [modifyWire],
      };

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async batchOrders(params: BatchOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const nonce = Date.now();

      const orderWires: OrderWire[] = [];
      for (const action of params.actions) {
        const data = action.data as {
          symbol: string; side: string; type: string;
          amount: string; price?: string; reduce_only?: boolean;
          tif?: string;
        };
        const assetIndex = await getHlAssetIndex(data.symbol);
        const isBuy = data.side === 'BUY' || data.side === 'bid' || data.side === 'LONG';

        const tif = data.tif || 'Gtc';
        const hlTif = tif.charAt(0).toUpperCase() + tif.slice(1).toLowerCase();

        let price: string;
        if (data.price) {
          price = floatToWire(data.price);
        } else if (data.type === 'MARKET') {
          const coin = denormalizeSymbol(data.symbol);
          const midPx = await getMidPrice(coin);
          const szDec = getHlSzDecimals(coin);
          const limitPx = slippagePrice(midPx, isBuy, 0.05, szDec);
          price = floatToWire(limitPx);
        } else {
          price = isBuy ? '999999' : '0.01'; // Should not reach here — limit orders require price
        }

        orderWires.push({
          a: assetIndex,
          b: isBuy,
          p: price,
          s: floatToWire(data.amount),
          r: data.reduce_only || false,
          t: data.type === 'MARKET'
            ? { limit: { tif: 'Ioc' } }
            : { limit: { tif: hlTif } },
        });
      }

      const orderAction: Record<string, unknown> = {
        type: 'order',
        orders: orderWires,
        grouping: 'na',
      };

      const builder = getBuilderCode();
      if (builder) orderAction.builder = builder;

      const signature = await signL1Action(wallet, orderAction, nonce);

      return hlExchange({
        action: orderAction,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async setTpSl(params: SetTpSlParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';
      const nonce = Date.now();

      // For position TP/SL on Hyperliquid, we need to place trigger orders
      // grouped as 'positionTpsl'
      const orders: OrderWire[] = [];
      const size = params.size || '0'; // 0 = full position

      if (params.take_profit) {
        orders.push({
          a: assetIndex,
          b: isBuy, // isBuy is already the closing side (frontend sends ask/bid)
          p: floatToWire(params.take_profit.stop_price),
          s: floatToWire(size),
          r: true,
          t: {
            trigger: {
              isMarket: !params.take_profit.limit_price,
              triggerPx: floatToWire(params.take_profit.stop_price),
              tpsl: 'tp',
            },
          },
        });
      }

      if (params.stop_loss) {
        orders.push({
          a: assetIndex,
          b: isBuy, // isBuy is already the closing side (frontend sends ask/bid)
          p: floatToWire(params.stop_loss.stop_price),
          s: floatToWire(size),
          r: true,
          t: {
            trigger: {
              isMarket: !params.stop_loss.limit_price,
              triggerPx: floatToWire(params.stop_loss.stop_price),
              tpsl: 'sl',
            },
          },
        });
      }

      if (orders.length === 0) {
        return { success: true, data: { message: 'No TP/SL specified' } };
      }

      const action: Record<string, unknown> = {
        type: 'order',
        orders,
        grouping: 'positionTpsl',
      };

      const builder = getBuilderCode();
      if (builder) action.builder = builder;

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async setLeverage(params: SetLeverageParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const nonce = Date.now();

      // Fetch current margin mode for this asset to preserve it
      const isCross = await getAssetMarginMode(params.account, params.symbol);

      const action: Record<string, unknown> = {
        type: 'updateLeverage',
        asset: assetIndex,
        isCross,
        leverage: params.leverage,
      };

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async setMargin(params: SetMarginParams): Promise<OrderResult> {
    try {
      const wallet = await getAgentWallet(params.account);
      const assetIndex = await getHlAssetIndex(params.symbol);
      const nonce = Date.now();

      // On Hyperliquid, margin mode is set via updateLeverage with isCross flag.
      // We need the current leverage to preserve it when switching modes.
      const currentLeverage = await getAssetLeverage(params.account, params.symbol);

      const action: Record<string, unknown> = {
        type: 'updateLeverage',
        asset: assetIndex,
        isCross: !params.is_isolated,
        leverage: currentLeverage,
      };

      const signature = await signL1Action(wallet, action, nonce);

      return hlExchange({
        action,
        nonce,
        signature,
        vaultAddress: null,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async withdraw(params: WithdrawParams): Promise<OrderResult> {
    // Withdrawals on Hyperliquid require user-signed action (withdraw3),
    // which must be signed client-side with the user's actual wallet.
    // This cannot be done with the agent wallet.
    return {
      success: false,
      error: 'Withdrawals must be signed client-side. Use the Hyperliquid UI or sign a withdraw3 action with your wallet.',
    };
  }
}
