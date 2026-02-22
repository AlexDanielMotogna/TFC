'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useAccount, useSwitchChain, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { toast } from 'sonner';

type SetupStep = 'idle' | 'generating' | 'signing' | 'submitting' | 'complete';

/**
 * Inline setup card for Hyperliquid agent wallet + builder fee approval.
 * Two-step flow:
 *   Step 1: Approve agent wallet (approveAgent EIP-712)
 *   Step 2: Approve builder fee (approveBuilderFee EIP-712)
 * Rendered inside the Place Order panel when setup is incomplete.
 */
export function HyperliquidSetupInline() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();

  const token = useAuthStore((s) => s.token);
  const agentApproved = useAuthStore((s) => s.agentApproved);
  const builderFeeApproved = useAuthStore((s) => s.builderFeeApproved);
  const setHyperliquidStatus = useAuthStore((s) => s.setHyperliquidStatus);

  const [agentStep, setAgentStep] = useState<SetupStep>('idle');
  const [builderStep, setBuilderStep] = useState<SetupStep>('idle');

  /** Ensure wallet is on the correct chain, return a fresh walletClient */
  const ensureChainAndGetClient = async (requiredChainId: number) => {
    if (chainId !== requiredChainId) {
      await switchChainAsync({ chainId: requiredChainId });
    }
    return getWalletClient(config, { chainId: requiredChainId });
  };

  // ─── Step 1: Approve Agent Wallet ──────────────────────────────
  const handleAgentSetup = async () => {
    if (!token || !address) return;

    try {
      setAgentStep('generating');
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

      setAgentStep('signing');
      const client = await ensureChainAndGetClient(typedData.domain.chainId as number);
      const message = { ...typedData.message, nonce: BigInt(typedData.message.nonce) };

      const signature = await client.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message,
        account: address,
      });

      setAgentStep('submitting');
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

      setAgentStep('complete');
      setHyperliquidStatus(true, true);
      toast.success('Agent wallet approved!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Setup failed';
      console.error('Agent setup error:', error);
      if (msg.includes('rejected')) {
        toast.error('Signature rejected by wallet');
      } else {
        toast.error(msg);
      }
      setAgentStep('idle');
    }
  };

  // ─── Step 2: Approve Builder Fee ──────────────────────────────
  const handleBuilderFeeSetup = async () => {
    if (!token || !address) return;

    try {
      setBuilderStep('generating');
      const initRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'init' }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'Failed to initialize builder fee approval');
      }

      const { typedData, nonce } = await initRes.json();

      setBuilderStep('signing');
      const client = await ensureChainAndGetClient(typedData.domain.chainId as number);
      const message = { ...typedData.message, nonce: BigInt(typedData.message.nonce) };

      const signature = await client.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message,
        account: address,
      });

      setBuilderStep('submitting');
      const submitRes = await fetch('/api/auth/hyperliquid/setup', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'submit', signature, nonce }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        throw new Error(err.error || 'Failed to complete builder fee approval');
      }

      setBuilderStep('complete');
      setHyperliquidStatus(true, true, true);
      toast.success('Builder fee approved!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Setup failed';
      console.error('Builder fee setup error:', error);
      if (msg.includes('rejected')) {
        toast.error('Signature rejected by wallet');
      } else {
        toast.error(msg);
      }
      setBuilderStep('idle');
    }
  };

  // Determine which step to show
  const showAgentStep = !agentApproved;
  const showBuilderStep = agentApproved && !builderFeeApproved;

  return (
    <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded-xl">
      <div className="text-[10px] xl:text-xs text-surface-300 font-semibold mb-1.5 xl:mb-2 uppercase">
        {showAgentStep ? 'Step 1 of 2: Agent Wallet' : 'Step 2 of 2: Builder Fee'}
      </div>

      {/* ─── Agent Wallet Step ─── */}
      {showAgentStep && (
        <>
          <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
            Approve a delegated agent wallet so TFC can sign orders on your behalf.
          </p>
          <StepUI step={agentStep} idleLabel="Approve Agent Wallet" onClick={handleAgentSetup} />
        </>
      )}

      {/* ─── Builder Fee Step ─── */}
      {showBuilderStep && (
        <>
          <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
            Approve TFC builder fee (0.05%) to enable order placement.
          </p>
          <StepUI step={builderStep} idleLabel="Approve Builder Fee" onClick={handleBuilderFeeSetup} />
        </>
      )}
    </div>
  );
}

/** Shared step UI: button / spinner / checkmark */
function StepUI({ step, idleLabel, onClick }: { step: SetupStep; idleLabel: string; onClick: () => void }) {
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
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-[10px] xl:text-xs font-medium">Done!</span>
      </div>
    );
  }

  const labels: Record<string, string> = {
    generating: 'Preparing...',
    signing: 'Check your wallet to sign...',
    submitting: 'Submitting to Hyperliquid...',
  };

  return (
    <div className="flex items-center gap-2 py-1.5 text-surface-300">
      <div className="animate-spin w-3.5 h-3.5 border-2 border-[#26a69a] border-t-transparent rounded-full" />
      <span className="text-[10px] xl:text-xs">{labels[step]}</span>
    </div>
  );
}
