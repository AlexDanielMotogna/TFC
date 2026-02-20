import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - Trade Fight Club',
  description: 'Privacy Policy for Trade Fight Club, explaining how we collect and use information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-8"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-surface-400">Last updated: January 29, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none">
          <p className="text-lg text-surface-300 mb-8">
            This Privacy Policy explains how Trade Fight Club ("TFC", "we", "our", or "us"), developed, maintained, and owned by{' '}
            <strong>Motogna Tech Studio</strong>, collects and uses information when you use our platform at{' '}
            <a href="https://www.tfc.gg" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              tfc.gg
            </a>.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. WHAT WE ARE</h2>
            <p className="mb-4">1.1 TFC is a competitive gaming platform that provides a user interface for 1v1 trading battles.</p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-2">1.2 Important: We do NOT handle, store, or control:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Your trading funds or positions</li>
                <li>Your trading account data or margin</li>
                <li>Trading order execution or liquidations</li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-2">1.3 What TFC DOES process:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Referral program payments (wallet-to-wallet transfers)</li>
                <li>Competition prize distributions (wallet-to-wallet transfers)</li>
                <li>Fight entry fees and payouts</li>
              </ul>
            </div>
            <p className="mb-4">
              1.4 All trading execution, fund custody, and margin management is handled by <strong>Pacifica</strong>. Please review{' '}
              <a href="https://app.pacifica.fi/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Pacifica's Privacy Policy
              </a>{' '}
              for information about how they handle your trading data.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. WHAT DATA WE COLLECT</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">2.1 Data You Provide:</h3>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li><strong>Wallet Address</strong> (public key) - when you connect your Solana wallet</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">2.2 Fight and Competition Data:</h3>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Fight participation records (wins, losses, PnL percentages)</li>
                <li>Leaderboard rankings</li>
                <li>Competition statistics</li>
                <li>Prize and referral payment history (amounts, wallet addresses, timestamps)</li>
                <li>Entry fee transactions</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">2.3 Automatically Collected Data:</h3>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li><strong>Technical Data:</strong> IP address, browser type, device information, operating system</li>
                <li><strong>Usage Data:</strong> Pages visited, features used, session duration</li>
                <li><strong>Analytics:</strong> Platform performance, error logs, feature usage patterns</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">2.4 Cookies and Local Storage:</h3>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Session management and wallet connection persistence</li>
                <li>User preferences and settings</li>
                <li>Analytics cookies (optional)</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. HOW WE USE YOUR DATA</h2>
            <p className="mb-4">3.1 We use your data to:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>Authenticate wallet connections</li>
              <li>Track Fight participation and calculate rankings</li>
              <li>Display leaderboards and competition statistics</li>
              <li>Process prize distributions and referral payments</li>
              <li>Calculate and execute entry fee collections and payouts</li>
              <li>Send notifications (if you opted in)</li>
              <li>Improve platform performance and user experience</li>
              <li>Detect and prevent cheating or abuse</li>
            </ul>
            <p className="mb-4">3.2 We do NOT:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300">
              <li>Sell or rent your personal data</li>
              <li>Use your data for advertising</li>
              <li>Share your data with third parties except as described below</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. THIRD-PARTY SERVICES</h2>
            <p className="mb-4">4.1 TFC integrates with third-party services that may collect data:</p>

            <div className="space-y-4 mb-4">
              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Pacifica (Trading Infrastructure):</h3>
                <ul className="list-disc pl-6 space-y-1 text-surface-300 text-sm">
                  <li>Handles all trading, fund custody, and payment processing</li>
                  <li>Collects wallet addresses, trading data, and transaction history</li>
                  <li>
                    Privacy policy:{' '}
                    <a href="https://app.pacifica.fi/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      app.pacifica.fi/privacy
                    </a>
                  </li>
                </ul>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">TradingView (Charts and Market Data):</h3>
                <ul className="list-disc pl-6 space-y-1 text-surface-300 text-sm">
                  <li>Provides charting widgets and market data visualization</li>
                  <li>May collect anonymized technical data (browser type, screen resolution)</li>
                  <li>May collect usage data (chart interactions, indicators applied)</li>
                  <li>
                    Privacy policy:{' '}
                    <a href="https://www.tradingview.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      tradingview.com/privacy-policy
                    </a>
                  </li>
                </ul>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Solana Network:</h3>
                <p className="text-surface-300 text-sm">
                  All wallet connections and transactions are recorded on the public Solana blockchain. This data is permanent
                  and publicly accessible.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Analytics Providers:</h3>
                <p className="text-surface-300 text-sm">
                  We may use analytics services to understand user behavior and improve the platform. These services collect
                  anonymized usage patterns and technical data.
                </p>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-blue-400 mb-2">4.2 GDPR and CCPA Compliance:</p>
              <p className="text-surface-300 text-sm">
                We comply with applicable data protection laws including GDPR (EU) and CCPA (California). We apply appropriate
                technical and organizational measures to protect user data.
              </p>
            </div>

            <p className="mb-4 text-sm text-surface-400">
              4.3 Third-Party Data Collection: Third-party services such as charting and analytics providers may collect
              anonymized technical or usage data in accordance with their own privacy policies.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. DATA SHARING</h2>
            <p className="mb-4">5.1 We may share your data with:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li><strong>Pacifica</strong> - for trading functionality</li>
              <li><strong>Analytics providers</strong> - for platform improvement (anonymized data only)</li>
              <li><strong>Service providers</strong> - for hosting, email delivery, and technical infrastructure</li>
              <li><strong>Legal authorities</strong> - if required by law or to protect our rights</li>
            </ul>
            <p className="mb-4">5.2 We do NOT sell your personal data to third parties.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. DATA RETENTION</h2>
            <p className="mb-4">6.1 We retain data for as long as necessary to provide our services:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li><strong>Active Accounts:</strong> Retained while you use the platform</li>
              <li><strong>Fight History:</strong> May be retained indefinitely for leaderboard integrity</li>
              <li><strong>Analytics Logs:</strong> Typically retained for 90 days</li>
              <li><strong>Legal Compliance:</strong> Some data may be retained for 5-7 years as required by law</li>
            </ul>
            <p className="mb-4 text-sm text-surface-400">
              6.2 Blockchain data (wallet addresses, transactions) is permanent and cannot be deleted.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. YOUR RIGHTS (GDPR/CCPA)</h2>
            <p className="mb-4">7.1 Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li><strong>Access</strong> your personal data</li>
              <li><strong>Correct</strong> inaccurate data</li>
              <li><strong>Delete</strong> your data (subject to legal requirements)</li>
              <li><strong>Export</strong> your data in a machine-readable format</li>
              <li><strong>Opt-out</strong> of marketing communications</li>
              <li><strong>Object</strong> to certain data processing</li>
            </ul>
            <p className="mb-4">
              7.2 To exercise these rights, contact us at{' '}
              <a href="mailto:alex@motogna.tech" className="text-primary hover:underline">
                alex@motogna.tech
              </a>
            </p>
            <p className="mb-4">7.3 We will respond within 30 days as required by applicable law.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. DATA SECURITY</h2>
            <p className="mb-4">8.1 We implement reasonable security measures including:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>Encryption of data in transit (TLS/SSL)</li>
              <li>Secure cloud infrastructure</li>
              <li>Access controls and monitoring</li>
            </ul>
            <p className="mb-4">8.2 However, no system is completely secure. We cannot guarantee absolute security.</p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
              <p className="font-semibold text-yellow-400 mb-2">8.3 Wallet Security:</p>
              <p className="text-surface-300 text-sm">
                You are responsible for securing your wallet and private keys. Any transactions signed with your wallet are
                considered authorized.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. CHILDREN'S PRIVACY</h2>
            <p className="mb-4">9.1 TFC is not intended for users under 18 years old.</p>
            <p className="mb-4">
              9.2 We do not knowingly collect data from children. If we discover we have collected data from a child, we will
              delete it promptly.
            </p>
            <p className="mb-4">
              9.3 If you believe a child has provided data to us, contact{' '}
              <a href="mailto:alex@motogna.tech" className="text-primary hover:underline">
                alex@motogna.tech
              </a>
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. INTERNATIONAL DATA TRANSFERS</h2>
            <p className="mb-4">10.1 Your data may be transferred to and processed in countries outside your country of residence.</p>
            <p className="mb-4">
              10.2 We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses
              approved by data protection authorities.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. COOKIES</h2>
            <p className="mb-4">11.1 We use cookies for:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li><strong>Strictly Necessary:</strong> Session management, wallet connection, security</li>
              <li><strong>Functional:</strong> User preferences and settings</li>
              <li><strong>Analytics:</strong> Usage statistics and platform improvement (optional)</li>
            </ul>
            <p className="mb-4">
              11.2 You can manage cookies through your browser settings, but disabling certain cookies may limit platform functionality.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. UPDATES TO THIS POLICY</h2>
            <p className="mb-4">12.1 We may update this Privacy Policy from time to time.</p>
            <p className="mb-4">12.2 The "Last updated" date at the top indicates when it was last revised.</p>
            <p className="mb-4">12.3 Continued use after changes constitutes acceptance of the updated policy.</p>
            <p className="mb-4">12.4 Material changes will be communicated via platform notifications.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">13. CONTACT</h2>
            <p className="mb-4">For questions about this Privacy Policy or your data, contact:</p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6">
              <p className="mb-2"><strong>Company:</strong> Motogna Tech Studio</p>
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a href="mailto:alex@motogna.tech" className="text-primary hover:underline">
                  alex@motogna.tech
                </a>
              </p>
              <p>
                <strong>Website:</strong>{' '}
                <a href="https://www.tfc.gg" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  www.tfc.gg
                </a>
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">14. ACKNOWLEDGMENT</h2>
            <p>
              By using Trade Fight Club, you acknowledge that you have read and understood this Privacy Policy. You also
              acknowledge that Pacifica (not TFC) is responsible for the privacy and security of all trading-related data, as
              described in{' '}
              <a href="https://app.pacifica.fi/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Pacifica's Privacy Policy
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
