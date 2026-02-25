'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useAccount, useSwitchChain, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { toast } from 'sonner';

type SetupStep = 'idle' | 'generating' | 'signing' | 'submitting' | 'complete';

const NADO_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_NADO_CHAIN_ID || '763373', 10);

/**
 * Inline setup card for Nado linked signer approval.
 * Single-step flow: Approve linked signer (EIP-712 LinkSigner).
 * Rendered inside the Place Order panel when setup is incomplete.
 */
export function NadoSetupInline() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();

  const token = useAuthStore((s) => s.token);
  const nadoAgentApproved = useAuthStore((s) => s.nadoAgentApproved);
  const setNadoStatus = useAuthStore((s) => s.setNadoStatus);

  const [step, setStep] = useState<SetupStep>('idle');

  /** Ensure wallet is on Ink chain, return a fresh walletClient */
  const ensureChainAndGetClient = async (requiredChainId: number) => {
    if (chainId !== requiredChainId) {
      await switchChainAsync({ chainId: requiredChainId });
      // Allow connector state to sync after chain switch
      await new Promise((r) => setTimeout(r, 500));
    }
    // Don't pass chainId — avoids ConnectorChainMismatchError when
    // wagmi's React state hasn't re-rendered yet after switchChain.
    // The EIP-712 domain already contains the correct chainId for signing.
    return getWalletClient(config);
  };

  const handleSetup = async () => {
    if (!token || !address) return;

    try {
      setStep('generating');
      const initRes = await fetch('/api/auth/nado/setup', {
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

      const { typedData, signerAddress, subaccount, nonce } = await initRes.json();

      setStep('signing');
      const client = await ensureChainAndGetClient(typedData.domain.chainId as number);

      // Convert nonce to BigInt for EIP-712 signing
      const message = {
        ...typedData.message,
        nonce: BigInt(typedData.message.nonce),
      };

      const signature = await client.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message,
        account: address,
      });

      setStep('submitting');
      const submitRes = await fetch('/api/auth/nado/setup', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature, signerAddress, subaccount, nonce }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        throw new Error(err.error || 'Failed to complete setup');
      }

      setStep('complete');
      setNadoStatus(true, true);
      toast.success('Linked signer approved!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Setup failed';
      console.error('Nado setup error:', error);
      if (msg.includes('rejected')) {
        toast.error('Signature rejected by wallet');
      } else {
        toast.error(msg);
      }
      setStep('idle');
    }
  };

  if (nadoAgentApproved) return null;

  return (
    <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded-xl">
      <div className="text-[10px] xl:text-xs text-surface-300 font-semibold mb-1.5 xl:mb-2 uppercase">
        Nado Setup: Linked Signer
      </div>
      <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
        Approve a linked signer so TFC can sign orders on your behalf.
      </p>
      <StepUI step={step} idleLabel="Approve Linked Signer" onClick={handleSetup} />
    </div>
  );
}

/** Shared step UI: button / spinner / checkmark */
function StepUI({
  step,
  idleLabel,
  onClick,
}: {
  step: SetupStep;
  idleLabel: string;
  onClick: () => void;
}) {
  if (step === 'idle') {
    return (
      <button
        onClick={onClick}
        className="w-full py-1.5 bg-[#26a69a] hover:bg-[#2bbbad] text-white text-[10px] xl:text-xs font-semibold rounded-lg transition-colors"
      >
        {idleLabel}
      </button>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex items-center gap-2 py-1.5 text-[#26a69a]">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-[10px] xl:text-xs font-medium">Done!</span>
      </div>
    );
  }

  const labels: Record<string, string> = {
    generating: 'Preparing...',
    signing: 'Check your wallet to sign...',
    submitting: 'Submitting to Nado...',
  };

  return (
    <div className="flex items-center gap-2 py-1.5 text-surface-300">
      <div className="animate-spin w-3.5 h-3.5 border-2 border-[#26a69a] border-t-transparent rounded-full" />
      <span className="text-[10px] xl:text-xs">{labels[step]}</span>
    </div>
  );
}
