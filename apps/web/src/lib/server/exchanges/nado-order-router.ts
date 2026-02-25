/**
 * Nado Order Router
 *
 * Server-side signing: backend signs with stored linked signer private key (ECDSA / EIP-712).
 * Frontend sends order params only — no client signature needed after one-time linked signer approval.
 *
 * Signing scheme:
 * - EIP-712 domain: { name: 'Nado', version: '0.0.1', chainId, verifyingContract }
 * - verifyingContract for orders = address(productId) (padded to 20 bytes)
 * - verifyingContract for other ops = endpoint contract (from `contracts` query)
 * - Nonce: upper 44 bits = discard time ms, lower 20 bits = random
 * - Amount sign = direction: positive = BUY, negative = SELL
 */

import { ethers } from 'ethers';
import { prisma } from '@tfc/db';
import { decryptKey } from '../key-vault';
import {
  getNadoProductId,
  getNadoProducts,
  getNadoProductMeta,
  getNadoEndpointAddr,
  addressToSubaccount,
  toX18,
  fromX18,
  genOrderVerifyingContract,
  generateNonce,
  encodeAppendix,
  nadoQuery,
  roundToNadoTick,
  roundToNadoLot,
  NADO_CONFIG,
} from './nado-adapter';
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

// ─────────────────────────────────────────────────────────────
// Debug logging — disabled in production, redacts sensitive fields
// ─────────────────────────────────────────────────────────────

const DEBUG = process.env.NODE_ENV !== 'production';

function redactSensitive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (typeof obj === 'string') return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === 'signature' || key === 'privateKey' || key === 'encryptedKeyData') {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function debugLog(...args: unknown[]) {
  if (DEBUG)
    console.log(
      '[NadoOrderRouter]',
      ...args.map((a) => (typeof a === 'object' ? redactSensitive(a) : a))
    );
}

// ─────────────────────────────────────────────────────────────
// EIP-712 Type Definitions
// ─────────────────────────────────────────────────────────────

const ORDER_TYPES = {
  Order: [
    { name: 'sender', type: 'bytes32' },
    { name: 'priceX18', type: 'int128' },
    { name: 'amount', type: 'int128' },
    { name: 'expiration', type: 'uint64' },
    { name: 'nonce', type: 'uint64' },
    { name: 'appendix', type: 'uint128' },
  ],
};

const CANCELLATION_TYPES = {
  Cancellation: [
    { name: 'sender', type: 'bytes32' },
    { name: 'productIds', type: 'uint32[]' },
    { name: 'digests', type: 'bytes32[]' },
    { name: 'nonce', type: 'uint64' },
  ],
};

const CANCELLATION_PRODUCTS_TYPES = {
  CancellationProducts: [
    { name: 'sender', type: 'bytes32' },
    { name: 'productIds', type: 'uint32[]' },
    { name: 'nonce', type: 'uint64' },
  ],
};

const WITHDRAW_COLLATERAL_TYPES = {
  WithdrawCollateral: [
    { name: 'sender', type: 'bytes32' },
    { name: 'productId', type: 'uint32' },
    { name: 'amount', type: 'uint128' },
    { name: 'nonce', type: 'uint64' },
  ],
};

// ─────────────────────────────────────────────────────────────
// Signing helpers
// ─────────────────────────────────────────────────────────────

function getNadoDomain(verifyingContract: string): ethers.TypedDataDomain {
  return {
    name: 'Nado',
    version: '0.0.1',
    chainId: NADO_CONFIG.chainId,
    verifyingContract,
  };
}

// ─────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────

async function nadoExecute(url: string, body: Record<string, unknown>): Promise<OrderResult> {
  const bodyJson = JSON.stringify(body);
  debugLog('POST', url, JSON.stringify(redactSensitive(body)).slice(0, 500));

  const response = await fetch(`${url}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    body: bodyJson,
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();
  debugLog('Response:', {
    status: response.status,
    body: responseText.slice(0, 500),
  });

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: `Failed to parse Nado response: ${responseText}`,
    };
  }

  if (result.status === 'failure') {
    return {
      success: false,
      error: result.error || `Nado error ${result.error_code}`,
    };
  }

  return {
    success: true,
    data: result.data || result,
  };
}

// ─────────────────────────────────────────────────────────────
// Linked signer wallet management
// ─────────────────────────────────────────────────────────────

async function getLinkedSignerWallet(accountAddress: string): Promise<ethers.Wallet> {
  const connection = await prisma.exchangeConnection.findFirst({
    where: {
      accountAddress: accountAddress.toLowerCase(),
      exchangeType: 'nado',
      isActive: true,
    },
    select: {
      encryptedKeyData: true,
      agentApproved: true,
    },
  });

  if (!connection) {
    throw new Error('No Nado connection found for this account');
  }

  if (!connection.agentApproved) {
    throw new Error('Linked signer not yet approved. Complete the one-time setup first.');
  }

  if (!connection.encryptedKeyData) {
    throw new Error('No linked signer key stored. Complete the one-time setup first.');
  }

  const privateKey = decryptKey(connection.encryptedKeyData);
  return new ethers.Wallet(privateKey);
}

/** Fetch mid price from Nado for market orders (routed through rate limiter) */
async function getNadoMidPrice(productId: number): Promise<number> {
  const result = await nadoQuery<{
    data: { bid_x18: string; ask_x18: string };
  }>({ type: 'market_price', product_id: productId });
  const bid = fromX18(result.data.bid_x18);
  const ask = fromX18(result.data.ask_x18);
  return (bid + ask) / 2;
}

// ─────────────────────────────────────────────────────────────
// Router implementation
// ─────────────────────────────────────────────────────────────

export class NadoOrderRouter implements ExchangeOrderRouter {
  readonly exchangeType = 'nado' as const;
  readonly signsServerSide = true;

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const productId = await getNadoProductId(params.symbol);
      const subaccount = addressToSubaccount(params.account);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';
      const nonce = generateNonce();

      let priceX18: string;
      let appendix: string;

      if (params.type === 'MARKET') {
        // Market orders: aggressive IOC at slippage price
        const midPrice = params.price
          ? parseFloat(String(params.price))
          : await getNadoMidPrice(productId);
        const slippagePct = parseFloat(params.slippage_percent || '5') / 100;
        const limitPx = isBuy ? midPrice * (1 + slippagePct) : midPrice * (1 - slippagePct);
        priceX18 = toX18(roundToNadoTick(limitPx, productId));

        appendix = encodeAppendix({
          orderType: 'IOC',
          reduceOnly: params.reduce_only || false,
        });
      } else {
        // Limit order
        if (!params.price) {
          return { success: false, error: 'Price required for limit orders' };
        }
        priceX18 = toX18(roundToNadoTick(parseFloat(String(params.price)), productId));

        const tifMap: Record<string, 'DEFAULT' | 'IOC' | 'FOK' | 'POST_ONLY'> = {
          GTC: 'DEFAULT',
          Gtc: 'DEFAULT',
          IOC: 'IOC',
          Ioc: 'IOC',
          FOK: 'FOK',
          Fok: 'FOK',
          POST_ONLY: 'POST_ONLY',
          Alo: 'POST_ONLY',
        };
        const orderType = tifMap[params.tif || 'GTC'] || 'DEFAULT';

        appendix = encodeAppendix({
          orderType,
          reduceOnly: params.reduce_only || false,
        });
      }

      // Amount: positive = BUY, negative = SELL (rounded to lot size)
      const rawAmount = roundToNadoLot(parseFloat(params.amount), productId);
      const signedAmount = isBuy ? rawAmount : -rawAmount;
      const amountX18 = toX18(signedAmount);

      // Expiration: far future for limit, short for IOC
      const expiration =
        params.type === 'MARKET'
          ? Math.floor(Date.now() / 1000) + 60 // 1 minute
          : Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

      const orderMessage = {
        sender: subaccount,
        priceX18,
        amount: amountX18,
        expiration: BigInt(expiration),
        nonce: BigInt(nonce),
        appendix: BigInt(appendix),
      };

      const domain = getNadoDomain(genOrderVerifyingContract(productId));
      const signature = await wallet.signTypedData(domain, ORDER_TYPES, orderMessage);

      const orderPayload = {
        place_order: {
          product_id: productId,
          order: {
            sender: subaccount,
            priceX18,
            amount: amountX18,
            expiration: String(expiration),
            nonce: String(nonce),
            appendix: String(appendix),
          },
          signature,
          spot_leverage: true,
        },
      };

      const result = await nadoExecute(NADO_CONFIG.gatewayUrl, orderPayload);

      // Extract digest as order ID
      if (result.success && result.data?.digest) {
        result.data.order_id = result.data.digest;
      }

      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelOrder(params: CancelOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const productId = await getNadoProductId(params.symbol);
      const subaccount = addressToSubaccount(params.account);
      const endpointAddress = getNadoEndpointAddr();
      const nonce = generateNonce();

      const cancelMessage = {
        sender: subaccount,
        productIds: [productId],
        digests: [params.order_id],
        nonce: BigInt(nonce),
      };

      const domain = getNadoDomain(endpointAddress);
      const signature = await wallet.signTypedData(domain, CANCELLATION_TYPES, cancelMessage);

      return nadoExecute(NADO_CONFIG.gatewayUrl, {
        cancel_orders: {
          tx: {
            sender: subaccount,
            productIds: [productId],
            digests: [params.order_id],
            nonce,
          },
          signature,
        },
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelAllOrders(params: CancelAllOrdersParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const subaccount = addressToSubaccount(params.account);
      const endpointAddress = getNadoEndpointAddr();
      const nonce = generateNonce();

      let productIds: number[];
      if (params.symbol) {
        const productId = await getNadoProductId(params.symbol);
        productIds = [productId];
      } else {
        // Cancel all products — use product cache for all perp product IDs
        const products = getNadoProducts();
        productIds = products.filter((p) => p.isPerp).map((p) => p.productId);
        if (productIds.length === 0) {
          // Ensure product cache is loaded
          await getNadoProductId('BTC-USD').catch(() => {});
          const refreshed = getNadoProducts();
          productIds = refreshed.filter((p) => p.isPerp).map((p) => p.productId);
        }
      }

      if (productIds.length === 0) {
        return { success: true, data: { cancelled_count: 0 } };
      }

      const cancelMessage = {
        sender: subaccount,
        productIds,
        nonce: BigInt(nonce),
      };

      const domain = getNadoDomain(endpointAddress);
      const signature = await wallet.signTypedData(
        domain,
        CANCELLATION_PRODUCTS_TYPES,
        cancelMessage
      );

      return nadoExecute(NADO_CONFIG.gatewayUrl, {
        cancel_product_orders: {
          tx: {
            sender: subaccount,
            productIds,
            nonce,
          },
          signature,
        },
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async createStopOrder(params: StopOrderParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const productId = await getNadoProductId(params.symbol);
      const subaccount = addressToSubaccount(params.account);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';
      const nonce = generateNonce();

      const isMarket = !params.stop_order.limit_price;

      // Price for the order (0 for stop-market to trigger at any price)
      const priceX18 = isMarket
        ? '0'
        : toX18(roundToNadoTick(parseFloat(params.stop_order.limit_price!), productId));

      // Amount: positive = BUY, negative = SELL (rounded to lot size)
      const rawAmount = roundToNadoLot(parseFloat(params.stop_order.amount), productId);
      const signedAmount = isBuy ? rawAmount : -rawAmount;
      const amountX18 = toX18(signedAmount);

      // Appendix: trigger type = PRICE, IOC for stop-market
      const appendix = encodeAppendix({
        orderType: isMarket ? 'IOC' : 'DEFAULT',
        reduceOnly: params.reduce_only,
        triggerType: 'PRICE',
      });

      const expiration = Math.floor(Date.now() / 1000) + 86400 * 90; // 90 days

      const orderMessage = {
        sender: subaccount,
        priceX18,
        amount: amountX18,
        expiration: BigInt(expiration),
        nonce: BigInt(nonce),
        appendix: BigInt(appendix),
      };

      const domain = getNadoDomain(genOrderVerifyingContract(productId));
      const signature = await wallet.signTypedData(domain, ORDER_TYPES, orderMessage);

      // Determine trigger type: oracle_price_above or oracle_price_below
      const stopPriceX18 = toX18(
        roundToNadoTick(parseFloat(params.stop_order.stop_price), productId)
      );
      const priceRequirement = isBuy
        ? { oracle_price_above: stopPriceX18 }
        : { oracle_price_below: stopPriceX18 };

      return nadoExecute(NADO_CONFIG.triggerUrl, {
        place_order: {
          product_id: productId,
          order: {
            sender: subaccount,
            priceX18,
            amount: amountX18,
            expiration: String(expiration),
            nonce: String(nonce),
            appendix: String(appendix),
          },
          trigger: {
            price_trigger: {
              price_requirement: priceRequirement,
            },
          },
          signature,
        },
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelStopOrder(params: CancelStopOrderParams): Promise<OrderResult> {
    // Trigger/stop orders live on the Trigger service, NOT the Gateway
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const productId = await getNadoProductId(params.symbol);
      const subaccount = addressToSubaccount(params.account);
      const endpointAddress = getNadoEndpointAddr();
      const nonce = generateNonce();

      const cancelMessage = {
        sender: subaccount,
        productIds: [productId],
        digests: [params.order_id],
        nonce: BigInt(nonce),
      };

      const domain = getNadoDomain(endpointAddress);
      const signature = await wallet.signTypedData(domain, CANCELLATION_TYPES, cancelMessage);

      return nadoExecute(NADO_CONFIG.triggerUrl, {
        cancel_orders: {
          tx: {
            sender: subaccount,
            productIds: [productId],
            digests: [params.order_id],
            nonce,
          },
          signature,
        },
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async editOrder(params: EditOrderParams): Promise<OrderResult> {
    // Nado has no native edit — cancel old + place new
    try {
      let side = params.side;

      // If side not provided, fetch the original order to determine its side
      if (!side && params.order_id) {
        try {
          const adapter = new (await import('./nado-adapter')).NadoAdapter();
          const openOrders = await adapter.getOpenOrders(params.account);
          const existingOrder = openOrders.find((o) => o.orderId === params.order_id);
          if (existingOrder) {
            side = existingOrder.side; // 'BUY' or 'SELL'
          }
        } catch (err) {
          console.error('[NadoOrderRouter] Failed to fetch order side:', err);
        }
      }

      if (!side) {
        return {
          success: false,
          error: `Cannot determine side for order ${params.order_id}. Pass 'side' explicitly or ensure the order exists.`,
        };
      }

      if (params.order_id) {
        await this.cancelOrder({
          account: params.account,
          order_id: params.order_id,
          symbol: params.symbol,
        });
      }

      return this.createOrder({
        account: params.account,
        symbol: params.symbol,
        side,
        type: 'LIMIT',
        amount: params.amount,
        price: params.price,
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async batchOrders(params: BatchOrderParams): Promise<OrderResult> {
    // Execute actions sequentially since Nado doesn't have a batch endpoint
    try {
      const results: OrderResult[] = [];
      for (const action of params.actions) {
        const data = action.data as {
          symbol: string;
          side: string;
          type: string;
          amount: string;
          price?: string;
          reduce_only?: boolean;
        };

        const result = await this.createOrder({
          account: params.account,
          symbol: data.symbol,
          side: data.side,
          type: data.type as 'MARKET' | 'LIMIT',
          amount: data.amount,
          price: data.price,
          reduce_only: data.reduce_only,
        });
        results.push(result);
      }

      const allSuccess = results.every((r) => r.success);
      return {
        success: allSuccess,
        data: { results },
        error: allSuccess
          ? undefined
          : results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join('; '),
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Shared helper for creating trigger (TP/SL/stop) orders on the Trigger service.
   * Signs the order with the linked signer wallet and sends to the trigger URL.
   */
  private async createTriggerOrder(opts: {
    wallet: ethers.Wallet;
    productId: number;
    subaccount: string;
    amountX18: string;
    triggerPriceX18: string;
    priceAbove: boolean;
    reduceOnly: boolean;
    orderType?: 'IOC' | 'DEFAULT';
    priceX18?: string;
  }): Promise<OrderResult> {
    const nonce = generateNonce();
    const appendix = encodeAppendix({
      orderType: opts.orderType || 'IOC',
      reduceOnly: opts.reduceOnly,
      triggerType: 'PRICE',
    });
    const expiration = Math.floor(Date.now() / 1000) + 86400 * 90; // 90 days
    const orderPriceX18 = opts.priceX18 || '0'; // 0 = market execution

    const orderMessage = {
      sender: opts.subaccount,
      priceX18: orderPriceX18,
      amount: opts.amountX18,
      expiration: BigInt(expiration),
      nonce: BigInt(nonce),
      appendix: BigInt(appendix),
    };

    const domain = getNadoDomain(genOrderVerifyingContract(opts.productId));
    const signature = await opts.wallet.signTypedData(domain, ORDER_TYPES, orderMessage);

    const priceRequirement = opts.priceAbove
      ? { oracle_price_above: opts.triggerPriceX18 }
      : { oracle_price_below: opts.triggerPriceX18 };

    return nadoExecute(NADO_CONFIG.triggerUrl, {
      place_order: {
        product_id: opts.productId,
        order: {
          sender: opts.subaccount,
          priceX18: orderPriceX18,
          amount: opts.amountX18,
          expiration: String(expiration),
          nonce: String(nonce),
          appendix: String(appendix),
        },
        trigger: {
          price_trigger: { price_requirement: priceRequirement },
        },
        signature,
      },
    });
  }

  async setTpSl(params: SetTpSlParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const productId = await getNadoProductId(params.symbol);
      const subaccount = addressToSubaccount(params.account);
      const isBuy = params.side === 'BUY' || params.side === 'bid' || params.side === 'LONG';

      const results: OrderResult[] = [];

      if (params.take_profit) {
        const rawAmount = params.size ? roundToNadoLot(parseFloat(params.size), productId) : 0;
        // TP closes the position: opposite side
        const signedAmount = isBuy ? -rawAmount : rawAmount;

        // TP: for long -> oracle_price_above, for short -> oracle_price_below
        const result = await this.createTriggerOrder({
          wallet,
          productId,
          subaccount,
          amountX18: toX18(signedAmount),
          triggerPriceX18: toX18(
            roundToNadoTick(parseFloat(params.take_profit.stop_price), productId)
          ),
          priceAbove: isBuy,
          reduceOnly: true,
        });
        results.push(result);
      }

      if (params.stop_loss) {
        const rawAmount = params.size ? roundToNadoLot(parseFloat(params.size), productId) : 0;
        const signedAmount = isBuy ? -rawAmount : rawAmount;

        // SL: for long -> oracle_price_below, for short -> oracle_price_above
        const result = await this.createTriggerOrder({
          wallet,
          productId,
          subaccount,
          amountX18: toX18(signedAmount),
          triggerPriceX18: toX18(
            roundToNadoTick(parseFloat(params.stop_loss.stop_price), productId)
          ),
          priceAbove: !isBuy,
          reduceOnly: true,
        });
        results.push(result);
      }

      if (results.length === 0) {
        return { success: true, data: { message: 'No TP/SL specified' } };
      }

      const allSuccess = results.every((r) => r.success);
      return {
        success: allSuccess,
        data: { results },
        error: allSuccess
          ? undefined
          : results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join('; '),
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async setLeverage(_params: SetLeverageParams): Promise<OrderResult> {
    // Nado doesn't have a separate leverage endpoint.
    // Leverage is controlled per-position via isolated margin flag in the appendix.
    return {
      success: true,
      data: {
        message: 'Nado uses per-position margin mode via order appendix. Leverage is implicit.',
      },
    };
  }

  async setMargin(_params: SetMarginParams): Promise<OrderResult> {
    // Similar to leverage — controlled via isolated bit in appendix
    return {
      success: true,
      data: {
        message: 'Nado margin mode is set per-order via the isolated flag in appendix.',
      },
    };
  }

  async withdraw(params: WithdrawParams): Promise<OrderResult> {
    try {
      const wallet = await getLinkedSignerWallet(params.account);
      const subaccount = addressToSubaccount(params.account);
      const endpointAddress = getNadoEndpointAddr();
      const nonce = generateNonce();

      // Pre-check: query max_withdrawable to validate amount
      const requestedAmount = parseFloat(params.amount);
      try {
        const maxResult = await nadoQuery<{
          data: { max_withdrawable: string };
        }>({ type: 'max_withdrawable', sender: subaccount });
        const maxWithdrawable = fromX18(maxResult.data.max_withdrawable);
        if (requestedAmount > maxWithdrawable) {
          return {
            success: false,
            error: `Insufficient withdrawable balance. Maximum: $${maxWithdrawable.toFixed(2)}`,
          };
        }
      } catch (err) {
        // Log but don't block — the withdrawal will fail server-side with its own error
        console.error('[NadoOrderRouter] Failed to check max_withdrawable:', err);
      }

      // Withdraw uses raw token decimals (6 for USDT0), NOT x18
      const amountRaw = Math.floor(requestedAmount * 1e6).toString();

      const withdrawMessage = {
        sender: subaccount,
        productId: 0, // USDT0
        amount: BigInt(amountRaw),
        nonce: BigInt(nonce),
      };

      const domain = getNadoDomain(endpointAddress);
      const signature = await wallet.signTypedData(
        domain,
        WITHDRAW_COLLATERAL_TYPES,
        withdrawMessage
      );

      return nadoExecute(NADO_CONFIG.gatewayUrl, {
        withdraw_collateral: {
          tx: {
            sender: subaccount,
            productId: 0,
            amount: amountRaw,
            nonce,
          },
          signature,
          spot_leverage: true,
        },
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
