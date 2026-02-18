/**
 * Signer Factory
 *
 * Creates the correct ExchangeSigner based on the active exchange type.
 *
 * - Pacifica → PacificaSigner (client-side, Solana wallet)
 * - Hyperliquid → HyperliquidSigner (server-side, EVM wallet)
 * - Lighter → LighterSigner (server-side, EVM wallet)
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { ExchangeType } from '@tfc/shared';
import type { ExchangeSigner } from './types';
import { PacificaSigner } from './pacifica-signer';
import { HyperliquidSigner } from './hyperliquid-signer';
import { LighterSigner } from './lighter-signer';

interface SignerOptions {
  exchangeType: ExchangeType;
  /** Solana wallet — required for Pacifica */
  solanaWallet?: WalletContextState;
  /** EVM wallet address — required for Hyperliquid & Lighter */
  evmAddress?: string;
}

/**
 * Create the appropriate signer for the given exchange type.
 *
 * Throws if the required wallet/address is not provided.
 */
export function createSigner(options: SignerOptions): ExchangeSigner {
  switch (options.exchangeType) {
    case 'pacifica': {
      if (!options.solanaWallet) {
        throw new Error('Solana wallet required for Pacifica signer');
      }
      return new PacificaSigner(options.solanaWallet);
    }

    case 'hyperliquid': {
      if (!options.evmAddress) {
        throw new Error('EVM wallet address required for Hyperliquid signer');
      }
      return new HyperliquidSigner(options.evmAddress);
    }

    case 'lighter': {
      if (!options.evmAddress) {
        throw new Error('EVM wallet address required for Lighter signer');
      }
      return new LighterSigner(options.evmAddress);
    }

    default:
      throw new Error(`Unknown exchange type: ${options.exchangeType}`);
  }
}
