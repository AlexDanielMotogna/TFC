'use client';

import { useState } from 'react';
import { BetaApplyModal } from './BetaApplyModal';

export function BetaBannerSection() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <section className="py-8 bg-gradient-to-r from-orange-500/10 via-surface-900 to-primary-500/10 border-y border-surface-700">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full mb-3">
            Limited Access
          </span>
          <h3 className="text-xl lg:text-2xl font-bold text-white">
            Join the Closed Beta
          </h3>
          <p className="text-surface-400 text-sm mt-2 mb-4 max-w-md mx-auto">
            Connect your wallet to apply for early access to Trade Fight Club
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-glow-orange px-6 py-2.5"
          >
            Apply Now
          </button>
        </div>
      </section>

      <BetaApplyModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
