/**
 * useSigner — Hook that returns the correct ExchangeSigner
 *
 * Reads the active exchange from ExchangeContext and creates
 * the appropriate signer:
 *
 * - Pacifica → PacificaSigner (needs Solana wallet)
 * - Hyperliquid → HyperliquidSigner (needs EVM address)
 * - Lighter → LighterSigner (needs EVM address)
 *
 * Usage in hooks:
 *   const signer = useSigner();
 *   const operation = await signer.signMarketOrder({ symbol: 'BTC-USD', side: 'BUY', ... });
 */

'use client';

import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createSigner } from '@/lib/signing/signer-factory';
import type { ExchangeSigner } from '@/lib/signing/types';

export function useSigner(): ExchangeSigner | null {
  const { exchangeType } = useExchangeContext();
  const solanaWallet = useWallet();

  // TODO: When wagmi is integrated, get EVM address here:
  // const { address: evmAddress } = useAccount(); // wagmi
  const evmAddress: string | undefined = undefined;

  return useMemo(() => {
    try {
      return createSigner({
        exchangeType,
        solanaWallet,
        evmAddress,
      });
    } catch {
      // Wallet not connected yet — return null
      return null;
    }
  }, [exchangeType, solanaWallet, evmAddress]);
}
