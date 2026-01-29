import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use - Trade Fight Club',
  description: 'Terms of Use for Trade Fight Club, a competitive 1v1 trading arena platform.',
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-4">Terms of Use</h1>
          <p className="text-surface-400">Last updated: January 29, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none">
          <p className="text-lg text-surface-300 mb-8">
            These Terms of Use ("Terms") govern your access to and use of Trade Fight Club ("TFC", "we", "our", or "us"),
            a competitive 1v1 trading arena platform developed, maintained, and owned by <strong>Motogna Tech Studio</strong>.
            By accessing or using TFC, you agree to these Terms.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. WHAT IS TFC?</h2>
            <p className="mb-4">
              1.1 Trade Fight Club is a <strong>competitive gaming platform</strong> that allows users to compete in 1v1
              trading battles ("Fights") with real-time leaderboards and prizes.
            </p>
            <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-2">1.2 Important: TFC is a user interface layer. We do NOT:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Hold, custody, or control your trading funds</li>
                <li>Process trading orders or manage margin</li>
                <li>Execute trades or manage liquidations</li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-2">1.3 What TFC DOES handle:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Referral program payments</li>
                <li>Competition prize distributions</li>
                <li>Fight entry fee collection and payouts</li>
              </ul>
            </div>
            <p className="mb-4">
              1.4 All trading execution, order processing, margin management, and trading fund custody is provided by{' '}
              <a href="https://app.pacifica.fi" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Pacifica
              </a>, a third-party derivatives trading protocol.
            </p>
            <p className="mb-4">1.5 By using TFC, you acknowledge that:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>You must accept Pacifica's <a href="https://app.pacifica.fi/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Use</a> and <a href="https://app.pacifica.fi/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a></li>
              <li>All trading execution, risks, and fund security are governed by Pacifica</li>
              <li>Prize and referral payments are processed by TFC on the Solana blockchain</li>
              <li>TFC has no control over or responsibility for Pacifica's trading services</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. ELIGIBILITY AND RESTRICTIONS</h2>
            <p className="mb-4">2.1 You must be at least 18 years old to use TFC.</p>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-red-400 mb-2">
                2.2 Geographic Restrictions: Because TFC uses Pacifica for all trading functionality, we inherit Pacifica's
                geographic restrictions. The platform is NOT available to users in:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>United States of America</li>
                <li>Cuba</li>
                <li>Crimean Peninsula (including Sevastopol)</li>
                <li>Iran</li>
                <li>Afghanistan</li>
                <li>Syria</li>
                <li>North Korea</li>
              </ul>
            </div>
            <p className="mb-4">2.3 These restrictions are enforced by Pacifica through IP-based blocking and other technical measures.</p>
            <p className="mb-4">2.4 You are responsible for ensuring your use complies with all applicable laws in your jurisdiction.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. WHAT TFC PROVIDES</h2>
            <p className="mb-4">3.1 TFC provides:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>Fight matchmaking and lobbies</li>
              <li>Real-time PnL tracking and leaderboards</li>
              <li>Competition management and prize distribution</li>
              <li>User interface for competitive trading</li>
              <li>Referral program and reward payments</li>
              <li>On-chain prize payouts via Solana</li>
            </ul>
            <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-6 mb-4">
              <p className="font-semibold mb-2">3.2 Payment Processing:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Entry fees, prizes, and referral rewards are automated wallet-to-wallet transfers on Solana</li>
                <li>Payments are made in USDC or other supported tokens</li>
                <li>TFC does not custody these funds; they are transferred directly between wallets</li>
              </ul>
            </div>
            <p className="mb-4">3.3 TFC does NOT provide financial advice, trading recommendations, or investment guidance.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. THIRD-PARTY SERVICES</h2>
            <p className="mb-4">4.1 TFC integrates with the following third-party services:</p>
            <div className="space-y-4 mb-4">
              <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-4">
                <p className="font-semibold text-primary mb-2">Pacifica - All trading execution, margin, liquidation, and fund custody</p>
                <ul className="list-disc pl-6 space-y-1 text-surface-300 text-sm">
                  <li>You must comply with <a href="https://app.pacifica.fi/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Pacifica's Terms</a></li>
                  <li>Pacifica is solely responsible for all trading operations</li>
                </ul>
              </div>
              <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-4">
                <p className="font-semibold text-primary mb-2">TradingView - Charting tools and market data widgets</p>
                <ul className="list-disc pl-6 space-y-1 text-surface-300 text-sm">
                  <li>TradingView branding and links must not be removed</li>
                  <li>Commercial use requires separate licensing from TradingView</li>
                </ul>
              </div>
              <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-4">
                <p className="font-semibold text-primary mb-2">Solana Network - Blockchain infrastructure for wallet connections</p>
              </div>
              <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-4">
                <p className="font-semibold text-primary mb-2">Wallet Providers - Phantom, Solflare, and other Solana wallets</p>
              </div>
            </div>
            <p className="mb-4">
              4.2 These third-party services have their own terms and privacy policies. TFC is not responsible for their operation,
              data collection, or service interruptions.
            </p>
            <p className="mb-4">
              4.3 Third-party services may collect anonymized technical or usage data in accordance with their own privacy policies.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. USER RESPONSIBILITIES</h2>
            <p className="mb-4">5.1 You are solely responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>The security of your wallet and private keys</li>
              <li>All trading decisions and their consequences</li>
              <li>Verifying all transaction details before signing (including prize payouts and referral rewards)</li>
              <li>Compliance with tax obligations and reporting of all income (prizes, referrals, trading gains)</li>
              <li>Ensuring your wallet address is correct for receiving payments</li>
            </ul>
            <p className="mb-4">
              5.2 TFC cannot reverse transactions, recover lost funds sent to incorrect addresses, or remedy trading losses.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-yellow-400 mb-2">5.3 Payment Responsibility:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>All prize and referral payments are final once confirmed on the Solana blockchain</li>
                <li>TFC is not responsible for funds sent to incorrect wallet addresses</li>
                <li>You must ensure you can access the wallet used to receive payments</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. PROHIBITED ACTIVITIES</h2>
            <p className="mb-4">6.1 You may not:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300">
              <li>Use TFC from restricted jurisdictions (via VPN or otherwise)</li>
              <li>Create multiple accounts to manipulate rankings</li>
              <li>Collude with other users to fix Fight outcomes</li>
              <li>Use bots or automated scripts without authorization</li>
              <li>Remove or alter third-party branding (TradingView, etc.)</li>
              <li>Use any content for commercial purposes without proper licenses</li>
              <li>Violate applicable laws or regulations</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. INTELLECTUAL PROPERTY</h2>
            <p className="mb-4">
              7.1 All TFC content, including but not limited to logos, branding, interface design, code, and platform features,
              is the exclusive property of <strong>Motogna Tech Studio</strong>.
            </p>
            <p className="mb-4">7.2 You may use TFC for personal, non-commercial purposes only.</p>
            <p className="mb-4">7.3 Third-Party Content:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300">
              <li>Charts, price data, and analytics may not be used commercially without licenses</li>
              <li>TradingView and other third-party branding must remain visible and unaltered</li>
              <li>Commercial use of third-party content requires separate agreements with those providers</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. DISCLAIMERS AND RISKS</h2>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-red-400 mb-2">8.1 Trading Risks:</p>
              <p className="text-surface-300">
                Derivatives trading involves substantial risk. You may lose more than your initial investment.
                Leverage amplifies both gains and losses.
              </p>
            </div>
            <p className="mb-4">8.2 No Guarantees: TFC provides the platform "as is" without warranties. We do not guarantee:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300 mb-4">
              <li>Uninterrupted service or uptime</li>
              <li>Accuracy of displayed information (prices, PnL, rankings)</li>
              <li>Compatibility with all wallets or devices</li>
              <li>Protection from trading losses</li>
            </ul>
            <p className="mb-4">
              8.3 Third-Party Failures: We are not responsible for failures, bugs, or issues with Pacifica, Solana,
              wallet providers, or other third-party services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. LIMITATION OF LIABILITY</h2>
            <p className="mb-4">
              9.1 To the fullest extent permitted by law, TFC's total liability for any claim shall not exceed <strong>$200 USD</strong>.
            </p>
            <p className="mb-4">9.2 We are not liable for:</p>
            <ul className="list-disc pl-6 space-y-1 text-surface-300">
              <li>Trading losses or missed profits</li>
              <li>Lost funds due to wallet compromise or user error</li>
              <li>Service interruptions or data loss</li>
              <li>Third-party service failures</li>
              <li>Inaccurate information displayed on the platform</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. ANTI-CHEAT AND ENFORCEMENT</h2>
            <p className="mb-4">10.1 TFC uses automated anti-cheat systems to detect unfair practices.</p>
            <p className="mb-4">10.2 Fights may be flagged as "NO_CONTEST" and excluded from rankings if violations are detected.</p>
            <p className="mb-4">10.3 We may suspend or terminate accounts that violate these Terms without prior notice.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. MODIFICATIONS</h2>
            <p className="mb-4">11.1 We may modify these Terms at any time. Continued use of TFC after changes constitutes acceptance.</p>
            <p className="mb-4">11.2 Material changes will be communicated via platform notifications.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. GOVERNING LAW</h2>
            <p className="mb-4">12.1 These Terms are governed by the laws of Austria.</p>
            <p className="mb-4">
              12.2 Disputes shall be resolved through binding arbitration under the Vienna International Arbitral Centre (VIAC)
              rules in Vienna, Austria.
            </p>
            <p className="mb-4">12.3 The arbitration language shall be English.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">13. CONTACT</h2>
            <p className="mb-4">For questions about these Terms, contact:</p>
            <div className="bg-surface-800/50 border border-surface-700 rounded-lg p-6">
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
              By using Trade Fight Club, you acknowledge that you have read, understood, and agree to these Terms.
              You also acknowledge that you have read and agreed to Pacifica's Terms of Use, as all trading services
              are provided by Pacifica.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
