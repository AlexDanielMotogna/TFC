import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { useAuthStore } from '@/lib/store';
import { useBuilderCodeStatus } from './useBuilderCode';

/**
 * Determines whether the current user can trade on the active exchange.
 *
 * Each exchange has different prerequisites:
 *  - Pacifica: Solana wallet connected + authenticated + Pacifica account linked + builder code approved
 *  - Hyperliquid: authenticated + EVM wallet connected + agent approved + builder fee approved
 *  - Nado: authenticated + EVM wallet connected + nado agent approved
 *
 * Returns `true` only when ALL prerequisites for the active exchange are met.
 */
export function useCanTrade(): boolean {
  const { connected } = useWallet();
  const { exchangeType } = useExchangeContext();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pacificaConnected = useAuthStore((s) => s.pacificaConnected);
  const evmWalletAddress = useAuthStore((s) => s.evmWalletAddress);
  const agentApproved = useAuthStore((s) => s.agentApproved);
  const builderFeeApproved = useAuthStore((s) => s.builderFeeApproved);
  const nadoAgentApproved = useAuthStore((s) => s.nadoAgentApproved);
  const { data: builderCodeStatus } = useBuilderCodeStatus();

  return useMemo(() => {
    switch (exchangeType) {
      case 'hyperliquid':
        return isAuthenticated && !!evmWalletAddress && agentApproved && builderFeeApproved;
      case 'nado':
        return isAuthenticated && !!evmWalletAddress && nadoAgentApproved;
      case 'pacifica':
      default:
        return (
          connected &&
          isAuthenticated &&
          pacificaConnected &&
          (builderCodeStatus?.approved ?? false)
        );
    }
  }, [
    exchangeType,
    isAuthenticated,
    connected,
    pacificaConnected,
    evmWalletAddress,
    agentApproved,
    builderFeeApproved,
    nadoAgentApproved,
    builderCodeStatus,
  ]);
}
