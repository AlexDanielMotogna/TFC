'use client';

interface AiDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export function AiDisclaimerModal({ isOpen, onAccept }: AiDisclaimerModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — non-dismissable */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-surface-900 border border-surface-700/40 rounded-2xl max-w-md w-full">
          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="font-semibold text-sm text-white">AI Trading Signal Disclaimer</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            <p className="text-[13px] text-surface-400 leading-relaxed">
              By using the AI Trading Signal feature, you acknowledge and agree:
            </p>
            <ul className="space-y-2.5 text-[13px] text-surface-400 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-yellow-400 mt-0.5 flex-shrink-0">*</span>
                <span>You are <strong className="text-white">100% responsible</strong> for all trading decisions you make.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-yellow-400 mt-0.5 flex-shrink-0">*</span>
                <span>This AI tool only <strong className="text-white">analyzes publicly available market data</strong>. It does not guarantee any outcome.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-yellow-400 mt-0.5 flex-shrink-0">*</span>
                <span>AI signals are <strong className="text-white">not financial advice</strong>. Past patterns do not predict future results.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-yellow-400 mt-0.5 flex-shrink-0">*</span>
                <span>Trading with leverage carries <strong className="text-white">significant risk of loss</strong>, including loss of your entire position.</span>
              </li>
            </ul>
          </div>

          {/* Accept button */}
          <div className="px-6 pb-6">
            <button
              onClick={onAccept}
              className="w-full py-3 rounded-xl bg-surface-800 hover:bg-surface-750 border border-surface-700/50 hover:border-surface-600/50 text-[13px] font-mono text-surface-300 hover:text-white transition-all"
            >
              I Understand and Accept
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
