import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - Trade Fight Club',
  description: 'Privacy Policy for Trade Fight Club, a non-custodial technology platform.',
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
          <p className="text-surface-400">Last updated: February 20, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none">
          <section className="mb-12">
            <p className="text-lg text-surface-300 mb-6">
              This Privacy Policy explains how TFC Technologies Ltd. and its affiliates (collectively, "TFC", "we", "our", or "us")
              collect, use, and disclose information when you access or use our websites, applications, and services (collectively,
              the "Services").
            </p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6 mb-6">
              <p className="font-semibold text-primary mb-3">Important Notice:</p>
              <p className="text-surface-300">
                TFC is a non-custodial technology interface. We do not custody user funds, operate a trading venue, or execute trades.
                All trading functionality is provided by third-party blockchain protocols. This Privacy Policy covers only data
                collected by TFC through the interface layer we provide.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. INFORMATION WE COLLECT</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">1.1 Information You Provide:</h3>
              <ul className="list-disc pl-6 space-y-2 text-surface-300">
                <li><strong>Wallet Address:</strong> Your public blockchain wallet address when you connect to the Services</li>
                <li><strong>Transaction Data:</strong> On-chain transaction data associated with your wallet address (publicly available on the blockchain)</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">1.2 Automatically Collected Information:</h3>
              <ul className="list-disc pl-6 space-y-2 text-surface-300">
                <li><strong>Usage Data:</strong> Information about your interactions with the Services, including pages visited, features used, and actions taken</li>
                <li><strong>Device Information:</strong> Browser type, operating system, device identifiers, and similar technical information</li>
                <li><strong>Log Data:</strong> IP address, access times, and error logs</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">1.3 Competition and Gaming Data:</h3>
              <ul className="list-disc pl-6 space-y-2 text-surface-300">
                <li>Competition participation records and results</li>
                <li>Leaderboard rankings and statistics</li>
                <li>Prize distribution records</li>
                <li>Referral program activity</li>
              </ul>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-blue-400 mb-2">What We Do NOT Collect:</p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300">
                <li>Private keys, seed phrases, or wallet passwords</li>
                <li>Trading fund balances or custody (handled by third-party protocols)</li>
                <li>Personal identity information (name, address, phone, email)</li>
                <li>Payment card or banking information</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. HOW WE USE YOUR INFORMATION</h2>
            <p className="mb-4">2.1 We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Provide and maintain the Services</li>
              <li>Process competition entries and distribute prizes</li>
              <li>Display leaderboards and user statistics</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Analyze usage patterns and improve the Services</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
            <p className="mb-4">2.2 We do NOT:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300">
              <li>Sell or rent your personal information to third parties</li>
              <li>Use your information for targeted advertising</li>
              <li>Access or control your private keys or wallet funds</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. INFORMATION SHARING AND DISCLOSURE</h2>
            <p className="mb-4">3.1 We may share your information in the following circumstances:</p>

            <div className="space-y-4 mb-4">
              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Service Providers:</h3>
                <p className="text-surface-300 text-sm">
                  We may share information with third-party service providers who perform services on our behalf, such as hosting,
                  analytics, and technical infrastructure. These providers are contractually obligated to use information only as
                  necessary to provide services to us.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Legal Requirements:</h3>
                <p className="text-surface-300 text-sm">
                  We may disclose information if required to do so by law or in response to valid requests by public authorities
                  (e.g., law enforcement, regulatory agencies, courts).
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Business Transfers:</h3>
                <p className="text-surface-300 text-sm">
                  In connection with any merger, sale of company assets, financing, or acquisition, your information may be
                  transferred to the acquiring entity.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Public Information:</h3>
                <p className="text-surface-300 text-sm">
                  Certain information is publicly displayed by design, including leaderboard rankings, competition results, and
                  on-chain transaction data (which is publicly available on the blockchain).
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. THIRD-PARTY SERVICES</h2>
            <p className="mb-4">
              4.1 The Services integrate with third-party blockchain protocols, infrastructure providers, and analytics tools.
              These third parties may collect information independently when you use their services:
            </p>

            <div className="space-y-4 mb-4">
              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Blockchain Networks:</h3>
                <p className="text-surface-300 text-sm">
                  When you interact with blockchain networks (e.g., Solana), your wallet address and transaction data are recorded
                  on the public blockchain. This information is permanent, publicly accessible, and cannot be deleted or modified.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Wallet Providers:</h3>
                <p className="text-surface-300 text-sm">
                  Third-party wallet providers (e.g., Phantom, Solflare) have their own privacy policies and data collection practices.
                  We do not control and are not responsible for their data handling.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Analytics and Data Providers:</h3>
                <p className="text-surface-300 text-sm">
                  We use third-party analytics services (e.g., TradingView for charting) that may collect anonymized usage data,
                  technical information, and interaction patterns. These providers operate under their own privacy policies.
                </p>
              </div>

              <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2">Third-Party Trading Protocols:</h3>
                <p className="text-surface-300 text-sm">
                  All trading execution, order routing, and fund custody is handled by third-party decentralized protocols.
                  These protocols collect and process data independently. You should review their privacy policies separately.
                </p>
              </div>
            </div>

            <p className="mb-4 text-sm text-surface-400">
              4.2 We are not responsible for the privacy practices of third-party services. We encourage you to review their
              privacy policies before using their services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. COOKIES AND TRACKING TECHNOLOGIES</h2>
            <p className="mb-4">5.1 We use cookies, local storage, and similar technologies to:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Maintain your session and remember your wallet connection</li>
              <li>Store user preferences and settings</li>
              <li>Analyze usage patterns and improve the Services</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
            <p className="mb-4">
              5.2 You can control cookies through your browser settings. However, disabling certain cookies may limit your ability
              to use some features of the Services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. DATA RETENTION</h2>
            <p className="mb-4">
              6.1 We retain information for as long as necessary to provide the Services, comply with legal obligations, resolve
              disputes, and enforce our agreements.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li><strong>Usage and Log Data:</strong> Typically retained for 90 days, unless required for longer periods for security or compliance purposes</li>
              <li><strong>Competition and Leaderboard Data:</strong> Retained indefinitely to maintain historical records and platform integrity</li>
              <li><strong>Blockchain Data:</strong> Permanently recorded on public blockchains and cannot be deleted</li>
            </ul>
            <p className="mb-4">
              6.2 Even if you stop using the Services, certain information may be retained as required by law or for legitimate
              business purposes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. DATA SECURITY</h2>
            <p className="mb-4">
              7.1 We implement reasonable administrative, technical, and physical security measures designed to protect the
              information we collect. These measures include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Encryption of data in transit using TLS/SSL protocols</li>
              <li>Secure cloud infrastructure and access controls</li>
              <li>Regular security assessments and monitoring</li>
            </ul>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-red-400 mb-2">7.2 Important Security Notice:</p>
              <p className="text-surface-300 mb-3">
                <strong>No system is completely secure.</strong> We cannot guarantee the absolute security of your information.
                You are solely responsible for securing your wallet, private keys, and seed phrases.
              </p>
              <p className="text-surface-300">
                <strong>TFC does not have access to your private keys.</strong> Any transaction signed with your wallet is
                considered authorized by you. Loss of your private keys will result in permanent loss of access to your digital assets.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. INTERNATIONAL DATA TRANSFERS</h2>
            <p className="mb-4">
              8.1 TFC operates globally, and information may be transferred to, stored in, and processed in countries other than
              your country of residence. These countries may have different data protection laws than your jurisdiction.
            </p>
            <p className="mb-4">
              8.2 By accessing or using the Services, you consent to the transfer of your information to countries outside your
              country of residence, including countries that may not provide the same level of data protection as your jurisdiction.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. CHILDREN'S PRIVACY</h2>
            <p className="mb-4">
              9.1 The Services are not intended for individuals under the age of 18. We do not knowingly collect information from
              children under 18.
            </p>
            <p className="mb-4">
              9.2 If we become aware that we have collected information from a child under 18, we will take steps to delete such
              information as soon as possible.
            </p>
            <p className="mb-4">
              9.3 If you believe a child has provided information to us, please contact us at{' '}
              <a href="mailto:legal@tfc.gg" className="text-primary hover:underline">
                legal@tfc.gg
              </a>
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. YOUR CHOICES AND RIGHTS</h2>
            <p className="mb-4">10.1 Depending on your jurisdiction, you may have certain rights regarding your information, including:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li><strong>Access:</strong> Request access to the information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your information, subject to legal retention requirements</li>
              <li><strong>Objection:</strong> Object to certain processing activities</li>
            </ul>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-yellow-400 mb-2">10.2 Limitations on Data Deletion:</p>
              <p className="text-surface-300 text-sm">
                Please note that we cannot delete information that is:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-surface-300 text-sm mt-2">
                <li>Recorded on public blockchains (this data is permanent and immutable)</li>
                <li>Required to be retained for legal, regulatory, or compliance purposes</li>
                <li>Necessary to maintain the integrity of leaderboards, competitions, or historical records</li>
              </ul>
            </div>
            <p className="mb-4">
              10.3 To exercise your rights or request information about our data practices, contact us at{' '}
              <a href="mailto:legal@tfc.gg" className="text-primary hover:underline">
                legal@tfc.gg
              </a>
            </p>
            <p className="mb-4">10.4 We will respond to your request within a reasonable timeframe as required by applicable law.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. CHANGES TO THIS PRIVACY POLICY</h2>
            <p className="mb-4">
              11.1 We may update this Privacy Policy from time to time. When we make changes, we will update the "Last Updated"
              date at the top of this page.
            </p>
            <p className="mb-4">
              11.2 If we make material changes, we may provide additional notice, such as through the Services or via email
              (if we have your email address).
            </p>
            <p className="mb-4">
              11.3 Your continued use of the Services after the effective date of any changes constitutes your acceptance of
              the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. CONTACT INFORMATION</h2>
            <p className="mb-4">
              If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6">
              <p className="mb-2"><strong>Entity:</strong> TFC Technologies Ltd.</p>
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a href="mailto:legal@tfc.gg" className="text-primary hover:underline">
                  legal@tfc.gg
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

          <div className="bg-surface-900 border border-surface-700 rounded-lg p-6 mt-12">
            <p className="text-sm text-surface-400 mb-4">
              <strong className="text-white">Privacy Notice:</strong>
            </p>
            <p className="text-sm text-surface-400">
              TFC is a non-custodial technology platform. We do not control, custody, or have access to your digital assets
              or private keys. All blockchain transactions are permanent and publicly recorded. You are solely responsible
              for the security of your wallet and private keys. The Services are provided for use only in jurisdictions
              where such use is legally permitted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
