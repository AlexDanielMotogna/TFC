'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useAccount, useSwitchChain, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { toast } from 'sonner';

type SetupStep = 'idle' | 'generating' | 'signing' | 'submitting' | 'complete';

/**
 * Inline setup card for Hyperliquid agent wallet.
 * Rendered inside the Place Order panel when the user needs to approve an agent.
 * NOT a modal — just an inline card that fits within the order form area.
 */
export function HyperliquidSetupInline() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();

  const token = useAuthStore((s) => s.token);
  const setHyperliquidStatus = useAuthStore((s) => s.setHyperliquidStatus);

  const [step, setStep] = useState<SetupStep>('idle');

  const handleSetup = async () => {
    if (!token || !address) return;

    try {
      // Step 1: Generate agent wallet on backend
      setStep('generating');
      const initRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'Failed to initialize setup');
      }

      const { typedData, agentAddress, nonce } = await initRes.json();

      // Step 2: Ensure wallet is on the correct chain before signing
      setStep('signing');
      const requiredChainId = typedData.domain.chainId as number;
      if (chainId !== requiredChainId) {
        await switchChainAsync({ chainId: requiredChainId });
      }

      // Get a fresh walletClient on the correct chain (after switch)
      const client = await getWalletClient(config, { chainId: requiredChainId });

      // Convert nonce back to bigint for wagmi (JSON serialized it as number)
      const message = { ...typedData.message, nonce: BigInt(typedData.message.nonce) };

      // Sign directly via viem walletClient to avoid wagmi connector chain mismatch
      const signature = await client.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message,
        account: address,
      });

      // Step 3: Submit signature to backend -> backend submits to HL
      setStep('submitting');
      const submitRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature, agentAddress, nonce }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        throw new Error(err.error || 'Failed to complete setup');
      }

      // Step 4: Done
      setStep('complete');
      setHyperliquidStatus(true, true);
      toast.success('Hyperliquid agent wallet approved!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Setup failed';
      console.error('Hyperliquid setup error:', error);

      if (message.includes('User rejected') || message.includes('rejected')) {
        toast.error('Signature rejected by wallet');
      } else {
        toast.error(message);
      }
      setStep('idle');
    }
  };

  return (
    <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded-xl">
      <div className="text-[10px] xl:text-xs text-surface-300 font-semibold mb-1.5 xl:mb-2 uppercase">
        Agent Wallet Setup
      </div>
      <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
        Approve a delegated agent wallet so TFC can sign orders on your behalf.
      </p>

      {step === 'idle' && (
        <button
          onClick={handleSetup}
          className="w-full py-1.5 bg-[#26a69a] hover:bg-[#2bbbad] text-white text-[10px] xl:text-xs font-semibold rounded-lg transition-colors"
        >
          Approve Agent Wallet
        </button>
      )}

      {step === 'generating' && (
        <div className="flex items-center gap-2 py-1.5 text-surface-300">
          <div className="animate-spin w-3.5 h-3.5 border-2 border-[#26a69a] border-t-transparent rounded-full" />
          <span className="text-[10px] xl:text-xs">Generating agent wallet...</span>
        </div>
      )}

      {step === 'signing' && (
        <div className="flex items-center gap-2 py-1.5 text-surface-300">
          <div className="animate-spin w-3.5 h-3.5 border-2 border-[#26a69a] border-t-transparent rounded-full" />
          <span className="text-[10px] xl:text-xs">Check your wallet to sign...</span>
        </div>
      )}

      {step === 'submitting' && (
        <div className="flex items-center gap-2 py-1.5 text-surface-300">
          <div className="animate-spin w-3.5 h-3.5 border-2 border-[#26a69a] border-t-transparent rounded-full" />
          <span className="text-[10px] xl:text-xs">Submitting to Hyperliquid...</span>
        </div>
      )}

      {step === 'complete' && (
        <div className="flex items-center gap-2 py-1.5 text-[#26a69a]">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] xl:text-xs font-medium">Setup complete!</span>
        </div>
      )}
    </div>
  );
}
