import { Injectable } from '@nestjs/common';
import * as nacl from 'tweetnacl';
import { base58 } from '@scure/base';

/**
 * Pacifica signing service
 * @see Pacifica-API.md - Signing section
 *
 * Implements Ed25519 signature generation for Pacifica API authentication
 */
@Injectable()
export class PacificaSigningService {
  /**
   * Generate a keypair from a base58-encoded private key
   */
  keypairFromPrivateKey(privateKeyBase58: string): nacl.SignKeyPair {
    const privateKeyBytes = base58.decode(privateKeyBase58);
    return nacl.sign.keyPair.fromSecretKey(privateKeyBytes);
  }

  /**
   * Get the public address from a keypair
   */
  getPublicAddress(keypair: nacl.SignKeyPair): string {
    return base58.encode(keypair.publicKey);
  }

  /**
   * Recursively sort JSON keys alphabetically
   */
  private sortJsonKeys(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sortJsonKeys(item));
    }

    if (typeof value === 'object') {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(value as Record<string, unknown>).sort();

      for (const key of keys) {
        sorted[key] = this.sortJsonKeys((value as Record<string, unknown>)[key]);
      }

      return sorted;
    }

    return value;
  }

  /**
   * Sign a Pacifica API request
   *
   * @param keypair - The signing keypair
   * @param operationType - The operation type (e.g., 'create_market_order')
   * @param data - The operation data
   * @param expiryWindow - Signature expiry in milliseconds (default 30000)
   * @returns The complete signed request payload
   */
  signRequest(
    keypair: nacl.SignKeyPair,
    operationType: string,
    data: Record<string, unknown>,
    expiryWindow = 30000
  ): Record<string, unknown> {
    const timestamp = Date.now();

    // 1. Create signature header
    const signatureHeader = {
      timestamp,
      expiry_window: expiryWindow,
      type: operationType,
    };

    // 2. Combine header and data
    const dataToSign = {
      ...signatureHeader,
      data,
    };

    // 3. Recursively sort JSON keys
    const sortedMessage = this.sortJsonKeys(dataToSign);

    // 4. Create compact JSON
    const compactJson = JSON.stringify(sortedMessage);

    // 5. Convert to UTF-8 bytes
    const messageBytes = new TextEncoder().encode(compactJson);

    // 6. Sign with Ed25519
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);

    // 7. Convert signature to Base58
    const signatureBase58 = base58.encode(signatureBytes);

    // 8. Build final request
    return {
      account: this.getPublicAddress(keypair),
      agent_wallet: null,
      signature: signatureBase58,
      timestamp,
      expiry_window: expiryWindow,
      ...data, // Spread original data (not the wrapper)
    };
  }

  /**
   * Sign a builder code approval request
   */
  signBuilderCodeApproval(
    keypair: nacl.SignKeyPair,
    builderCode: string,
    maxFeeRate: string
  ): Record<string, unknown> {
    return this.signRequest(
      keypair,
      'approve_builder_code',
      {
        builder_code: builderCode,
        max_fee_rate: maxFeeRate,
      },
      5000
    );
  }

  /**
   * Sign a market order request
   */
  signMarketOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      amount: string;
      side: 'bid' | 'ask';
      slippagePercent: string;
      reduceOnly: boolean;
      clientOrderId?: string;
      builderCode?: string;
    }
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      slippage_percent: params.slippagePercent,
      reduce_only: params.reduceOnly,
    };

    if (params.clientOrderId) {
      data.client_order_id = params.clientOrderId;
    }

    if (params.builderCode) {
      data.builder_code = params.builderCode;
    }

    return this.signRequest(keypair, 'create_market_order', data);
  }

  /**
   * Sign a limit order request
   */
  signLimitOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      price: string;
      amount: string;
      side: 'bid' | 'ask';
      tif: 'GTC' | 'IOC' | 'ALO' | 'TOB';
      reduceOnly: boolean;
      clientOrderId?: string;
      builderCode?: string;
    }
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      symbol: params.symbol,
      price: params.price,
      amount: params.amount,
      side: params.side,
      tif: params.tif,
      reduce_only: params.reduceOnly,
    };

    if (params.clientOrderId) {
      data.client_order_id = params.clientOrderId;
    }

    if (params.builderCode) {
      data.builder_code = params.builderCode;
    }

    return this.signRequest(keypair, 'create_order', data);
  }

  /**
   * Sign a cancel order request
   */
  signCancelOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      orderId?: number;
      clientOrderId?: string;
    }
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      symbol: params.symbol,
    };

    if (params.orderId !== undefined) {
      data.order_id = params.orderId;
    }

    if (params.clientOrderId) {
      data.client_order_id = params.clientOrderId;
    }

    return this.signRequest(keypair, 'cancel_order', data);
  }

  /**
   * Sign a cancel all orders request
   */
  signCancelAllOrders(
    keypair: nacl.SignKeyPair,
    params: {
      allSymbols: boolean;
      excludeReduceOnly: boolean;
      symbol?: string;
    }
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      all_symbols: params.allSymbols,
      exclude_reduce_only: params.excludeReduceOnly,
    };

    if (params.symbol) {
      data.symbol = params.symbol;
    }

    return this.signRequest(keypair, 'cancel_all_orders', data);
  }

  /**
   * Sign an update leverage request
   */
  signUpdateLeverage(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      leverage: number;
    }
  ): Record<string, unknown> {
    return this.signRequest(keypair, 'update_leverage', {
      symbol: params.symbol,
      leverage: params.leverage,
    });
  }
}
