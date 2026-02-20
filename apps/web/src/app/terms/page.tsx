import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use - Trade Fight Club',
  description: 'Terms of Use for Trade Fight Club, a non-custodial technology platform for competitive trading.',
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
          <p className="text-surface-400">Last updated: February 20, 2026</p>
        </div>

        {/* Restricted Persons Warning */}
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
          <p className="font-bold text-red-400 mb-4 text-lg">IMPORTANT NOTICE - ACCESS RESTRICTIONS</p>
          <p className="text-surface-200 mb-4">
            ACCESS TO THIS WEBSITE, ANY SITE (AS DEFINED BELOW), AND THE SERVICES (AS DEFINED BELOW) ARE NOT OFFERED
            TO PERSONS OR ENTITIES WHO RESIDE IN, ARE CITIZENS OF, ARE LOCATED IN, ARE INCORPORATED IN, OR HAVE A
            REGISTERED OFFICE IN A RESTRICTED TERRITORY (AS DEFINED BELOW, AND ANY SUCH PERSON OR ENTITY FROM A
            RESTRICTED TERRITORY, A "RESTRICTED PERSON").
          </p>
          <p className="text-surface-200 mb-4">
            <strong className="text-red-400">IF YOU ARE A RESTRICTED PERSON, DO NOT ATTEMPT TO USE THIS WEBSITE, ANY SITE, OR THE SERVICES.</strong>
          </p>
          <p className="text-surface-200">
            THE USE OF A VIRTUAL PRIVATE NETWORK ("VPN") OR ANY OTHER PRIVACY OR ANONYMIZATION TOOLS TO CIRCUMVENT THE
            RESTRICTIONS SET FORTH HEREIN IS STRICTLY PROHIBITED.
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none">
          <section className="mb-12">
            <p className="text-lg text-surface-300 mb-6">
              These terms of use, together with any documents and additional terms they expressly incorporate by reference
              (collectively, these "Terms"), are entered into between TFC Technologies Ltd. or any of its affiliates
              (collectively, "TFC", "we", "us", or "our") and you or a company or other legal entity that you represent
              ("you" or "your") concerning your access to, and use of, TFC's websites (and their respective subdomains),
              web applications, mobile applications, and all associated sites linked thereto by TFC (collectively with any
              materials and services available therein, and successor website(s) or application(s) thereto, the "Site").
            </p>
            <p className="text-lg text-surface-300 mb-6">
              Please read these Terms carefully, as these Terms govern your access to and use of the Site and the Services.
              For the purposes of these Terms, the term "Services" means access to the gamified user interface, competitive
              trading analytics, matchmaking system, leaderboards, software tools, application programming interfaces ("APIs"),
              and any other software or technology developed by TFC for facilitating peer-to-peer competitive trading activities
              via third-party blockchain protocols and trading infrastructure.
            </p>
            <p className="text-lg text-surface-300 mb-6">
              <strong className="text-primary">
                By clicking "I agree" to these Terms, acknowledging these Terms by other means, or otherwise accessing or
                using the Site or the Services, you accept and agree to be bound by and to comply with these Terms,
                including the mandatory arbitration provision in Section 15.
              </strong> If you do not agree to these Terms, then you must not access or use the Site or the Services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. NATURE OF SERVICES</h2>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-3">1.1 TFC is a non-custodial technology interface that provides:</p>
              <ul className="list-disc pl-6 space-y-2 text-surface-300">
                <li>Gamified analytics and interface layer for blockchain-based trading</li>
                <li>Competitive matchmaking and tournament systems</li>
                <li>Real-time performance tracking and leaderboards</li>
                <li>Software tools for interacting with third-party blockchain protocols</li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-3">1.2 TFC DOES NOT:</p>
              <ul className="list-disc pl-6 space-y-2 text-surface-300">
                <li>Operate an exchange, broker, intermediary, or trading venue</li>
                <li>Custody user funds or control user assets</li>
                <li>Execute trades or provide order routing services</li>
                <li>Manage margin, liquidations, or settlement processes</li>
                <li>Provide internal matching or price discovery</li>
              </ul>
            </div>
            <p className="mb-4">
              1.3 All trading execution, order processing, margin management, and fund custody is provided by
              third-party blockchain protocols and decentralized infrastructure. TFC provides only the user interface
              and gamification layer.
            </p>
            <p className="mb-4">
              1.4 By accessing or using the Site or Services, you agree that your use of the Site or Services is on a
              peer-to-peer basis and that TFC does not provide execution, settlement, or clearing services of any kind
              and is not responsible for the execution, settlement, or clearing of transactions through the Services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. ELIGIBILITY AND RESTRICTED TERRITORIES</h2>
            <p className="mb-4">2.1 As a condition to you accessing and using the Site or the Services, you represent and warrant to TFC as follows:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>If you are an individual, you are of the legal age of majority in the jurisdiction in which you reside and you have the legal capacity to enter into these Terms and be bound by them;</li>
              <li>If you are an entity or an organization, you have the full legal authority to enter into these Terms on behalf of such entity or organization;</li>
              <li className="font-semibold text-red-400">
                You do not reside in or are not located or incorporated in and do not have a registered office in Belarus, Cuba, Iran,
                North Korea, Russia, Ukraine, the United Kingdom, the United States of America, Canada, the European Union, or Australia,
                or any country or region that is the subject of comprehensive country-wide or region-wide economic sanctions by the
                United States or the United Kingdom (collectively, the "Restricted Territories");
              </li>
              <li>
                (i) You are not the subject of any sanctions administered or enforced by U.S. Department of the Treasury's Office of
                Foreign Assets Control ("OFAC"), the United Nations Security Council, the European Union, His Majesty's Treasury, or any
                other legal, governmental, or regulatory authority in any applicable jurisdiction and (ii) neither you nor your wallet
                address is listed on the Specially Designated Nationals and Blocked Persons List, the Consolidated Sanctions List, or
                any other sanctions lists administered by OFAC (any such person, a "Sanctioned Person");
              </li>
              <li>You do not intend to transact with or on behalf of any Restricted Person or Sanctioned Person;</li>
              <li>You do not, and will not, use a VPN or any other privacy or anonymization tools or techniques to circumvent, or attempt to circumvent, any restrictions that apply to the Site or the Services;</li>
              <li>
                Your access to or use of the Site or the Services does not (i) violate, and is not prohibited by, any applicable law,
                regulation, order, or other legal requirement in any jurisdiction applicable to you, TFC, the Site, or the Services
                ("Applicable Laws"); and (ii) contribute to or facilitate any unlawful activity.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. USER RESPONSIBILITIES</h2>
            <p className="mb-4">3.1 You are solely responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>The security and confidentiality of your private keys, seed phrases, passwords, or other credentials associated with your blockchain wallets;</li>
              <li>All activity conducted under your account, including all transfers, transactions, or other activities involving digital assets;</li>
              <li>Determining, reporting, and paying any taxes applicable to your use of the Site or the Services;</li>
              <li>Verifying all transaction details before signing (including prize payouts and referral rewards);</li>
              <li>Ensuring your wallet address is correct for receiving payments;</li>
              <li>Compliance with all Applicable Laws in your jurisdiction.</li>
            </ul>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-yellow-400 mb-2">3.2 Critical Security Notice:</p>
              <p className="text-surface-300">
                TFC does not have access to your private keys, seed phrases, passwords, or other credentials associated with
                your blockchain wallets. Losing control of your private key(s) will permanently and irreversibly deny you
                access to your digital assets. Neither TFC nor any other person or entity will be able to retrieve or protect
                your digital assets. <strong>You acknowledge that TFC cannot reverse transactions, recover lost funds, or remedy trading losses.</strong>
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. THIRD-PARTY SERVICES</h2>
            <p className="mb-4">4.1 TFC integrates with third-party blockchain protocols, data providers, and infrastructure services, including:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Blockchain networks (Solana, etc.) for wallet connections and transactions</li>
              <li>Third-party trading protocols for order execution and settlement</li>
              <li>Market data providers (TradingView, etc.) for charting and analytics</li>
              <li>Wallet providers (Phantom, Solflare, etc.)</li>
            </ul>
            <p className="mb-4">
              4.2 TFC has no control over and assumes no responsibility or liability for the delivery, quality, safety,
              legality, or any other aspect of any digital assets that you may transfer to or from a third party.
            </p>
            <p className="mb-4">
              4.3 These third-party services have their own terms and privacy policies. TFC is not responsible for their
              operation, data collection, security practices, or service interruptions.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. PROHIBITED ACTIVITIES</h2>
            <p className="mb-4">5.1 You shall not use the Site or the Services to engage in any Prohibited Uses (as defined below). You agree and confirm that you will not:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300">
              <li>Violate any Applicable Laws, including anti-money laundering, counter-terrorist financing, or economic sanctions laws or regulations;</li>
              <li>Access or use the Site or Services from any Restricted Territory (including through the use of an IP address in such jurisdiction or via VPN);</li>
              <li>Engage in any fraudulent act, scheme to defraud, manipulation, spoofing, wash trading, or other market manipulation;</li>
              <li>Create multiple accounts to manipulate rankings, airdrops, or reward programs;</li>
              <li>Use bots, automated scripts, or tools that interfere with the proper operation of the Services;</li>
              <li>Circumvent any content-filtering techniques, security measures, or access controls that TFC employs;</li>
              <li>Access or use the Site or Services to transmit or exchange digital assets that are the proceeds of any criminal or fraudulent activity;</li>
              <li>Provide false, inaccurate, or misleading information;</li>
              <li>Impersonate any person or entity;</li>
              <li>Remove, obscure, or alter any copyright, trademark, or other legal notices (including third-party branding like TradingView).</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. NO PROFESSIONAL ADVICE OR FIDUCIARY DUTIES</h2>
            <p className="mb-4">
              6.1 All information provided in connection with your access and use of the Site and the Services is provided for
              informational purposes only and should not be construed as professional, financial, legal, or other advice.
            </p>
            <p className="mb-4">
              6.2 Before you make any financial, legal, or other decisions involving the Services, you should seek independent
              professional advice from an individual who is licensed and qualified to provide such advice.
            </p>
            <p className="mb-4">
              6.3 <strong>These Terms are not intended to, and do not, create or impose any fiduciary duties on TFC.</strong> To
              the fullest extent permitted by Applicable Law, TFC owes no fiduciary duties or liabilities to you or any other
              party, and to the extent that any such duties or liabilities may exist at law or in equity, you hereby irrevocably
              disclaim, waive, and eliminate those duties and liabilities.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. NON-CUSTODIAL SERVICES</h2>
            <p className="mb-4">
              7.1 The Services are non-custodial. When you interact with blockchain-based smart contracts via the Site, you
              retain full control and ownership of your digital assets at all times.
            </p>
            <p className="mb-4">
              7.2 The private key associated with your blockchain address is the only credential that can control your digital
              assets. <strong>TFC does not have access to, and cannot access, your private keys, seed phrases, passwords, or
              other credentials.</strong>
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. INTELLECTUAL PROPERTY</h2>
            <p className="mb-4">
              8.1 Excluding third-party software incorporated into the Site or the Services, and subject to any applicable
              open-source licenses, as between you and TFC, TFC owns and retains all rights, title, and interest in and to
              the Site and the Services, including all technology, content, and other materials used, displayed, or provided
              on the Site or in connection with the Services (including all intellectual property rights subsisting therein).
            </p>
            <p className="mb-4">
              8.2 All of TFC's product and service names, logos, designs, and other marks used on the Site or in connection
              with the Services are trademarks or service marks owned by TFC or its licensors. You may not copy, imitate, or
              use such marks without TFC's prior written consent.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. RISKS</h2>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-red-400 mb-3">9.1 Trading Risks:</p>
              <p className="text-surface-300 mb-3">
                Access or use of the Site and the Services, in particular for activities involving the trading of digital assets
                and leveraged positions, may carry significant financial risk. Digital assets are, by their nature, highly
                experimental, risky, and volatile. <strong>The risk of loss in trading digital assets can be substantial.</strong>
              </p>
              <p className="text-surface-300">
                You should carefully consider whether such trading is suitable for you in light of your circumstances and financial
                resources. All transaction decisions are made solely by you. <strong>You accept all consequences of accessing and
                using the Site and Services, including the risk that you may lose your entire investment or more.</strong>
              </p>
            </div>
            <p className="mb-4">9.2 Blockchain and Cryptographic Risks:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Blockchain networks remain under development and may have bugs, security vulnerabilities, or technical risks;</li>
              <li>Advances in cryptography or quantum computing may present risks to digital assets;</li>
              <li>Transaction costs on blockchain networks are variable and may fluctuate;</li>
              <li>Smart contracts may contain code errors, bugs, or vulnerabilities;</li>
              <li>Blockchain networks may fork, undergo protocol changes, or experience service interruptions.</li>
            </ul>
            <p className="mb-4">
              9.3 <strong>You acknowledge that you are solely responsible for evaluating, verifying, and testing any code or
              smart contract provided by or accessible via the Site or the Services.</strong> TFC does not have any obligation
              to monitor, identify, or alert you to potential flaws, vulnerabilities, or risks.
            </p>
            <p className="mb-4">
              9.4 You represent and warrant that you possess the necessary knowledge, experience, and skills to understand
              cryptography, blockchain-based systems, and computer technology associated with the Site and the Services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. DISCLAIMERS</h2>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6 mb-4">
              <p className="font-semibold text-primary mb-3">IMPORTANT LEGAL DISCLOSURES:</p>
              <p className="text-surface-200 mb-3">
                TFC is a software developer and does not operate a digital asset or derivatives exchange, trading platform,
                broker, intermediary, or clearing house, nor does TFC provide trade execution, settlement, or clearing services.
              </p>
              <p className="text-surface-200 mb-3">
                All transactions between users are executed on a peer-to-peer basis directly between users' blockchain addresses
                through third-party smart contracts deployed on blockchain networks.
              </p>
              <p className="text-surface-200">
                You understand that TFC is not registered or licensed by any regulatory agency or authority. No such agency or
                authority has reviewed or approved the use of TFC-developed software.
              </p>
            </div>
            <p className="mb-4 text-lg font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, THE SITE AND THE SERVICES (INCLUDING ANY OF THEIR CONTENT,
              DATA, OR FUNCTIONALITY) ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS.
            </p>
            <p className="mb-4">
              TFC EXPRESSLY DISCLAIMS, AND YOU HEREBY WAIVE, ANY REPRESENTATIONS, CONDITIONS, OR WARRANTIES OF ANY KIND, WHETHER
              EXPRESS OR IMPLIED, LEGAL, STATUTORY, OR ARISING FROM STATUTE, OTHERWISE IN LAW, COURSE OF DEALING, USAGE OF TRADE,
              OR OTHERWISE, INCLUDING ANY IMPLIED OR LEGAL WARRANTIES AND CONDITIONS OF MERCHANTABILITY, MERCHANTABLE QUALITY,
              OR FITNESS FOR A PARTICULAR PURPOSE, TITLE, COMPLETENESS, SECURITY, AVAILABILITY, RELIABILITY, ACCURACY, QUIET
              ENJOYMENT, OR NON-INFRINGEMENT OF THIRD PARTY RIGHTS.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. LIMITATION OF LIABILITY</h2>
            <p className="mb-4 text-lg font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, IN NO EVENT WILL TFC, ITS SUPPLIERS AND CONTRACTORS, OR
              ANY OF THEIR RESPECTIVE SHAREHOLDERS, MEMBERS, DIRECTORS, OFFICERS, MANAGERS, EMPLOYEES, ATTORNEYS, AGENTS,
              REPRESENTATIVES, SUPPLIERS, AND CONTRACTORS BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>
                ANY INCIDENTAL, INDIRECT, SPECIAL, PUNITIVE, CONSEQUENTIAL, OR SIMILAR DAMAGES OR LIABILITIES OF ANY KIND
                (INCLUDING DAMAGES FOR LOSS OF FIAT CURRENCY, DIGITAL ASSETS, DATA, INFORMATION, REVENUE, OPPORTUNITIES,
                USE, GOODWILL, PROFITS, OR OTHER BUSINESS OR FINANCIAL BENEFIT);
              </li>
              <li>TRADING LOSSES OR MISSED PROFITS;</li>
              <li>LOST FUNDS DUE TO WALLET COMPROMISE OR USER ERROR;</li>
              <li>SERVICE INTERRUPTIONS OR DATA LOSS;</li>
              <li>THIRD-PARTY SERVICE FAILURES;</li>
              <li>INACCURATE INFORMATION DISPLAYED ON THE PLATFORM.</li>
            </ul>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, TFC'S TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING
              OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE SITE OR SERVICES SHALL NOT EXCEED <strong>$100 USD</strong>.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. INDEMNIFICATION</h2>
            <p className="mb-4">
              You agree to defend, indemnify, and hold harmless TFC and its affiliates, stockholders, members, directors,
              officers, managers, employees, attorneys, agents, representatives, suppliers, and contractors from and against
              any and all claims, demands, lawsuits, actions, proceedings, investigations, liabilities, damages, losses,
              costs, or expenses, including reasonable attorneys' fees, arising out of or relating to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300">
              <li>Your access to and use of, or conduct in connection with, the Site or the Services;</li>
              <li>Any digital assets associated with your wallet address;</li>
              <li>Your breach or alleged breach of these Terms;</li>
              <li>Your violation of any Applicable Law;</li>
              <li>Your violation, infringement, or misappropriation of the rights of any other person or entity.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">13. MODIFICATIONS TO THESE TERMS</h2>
            <p className="mb-4">
              TFC reserves the right, in its sole discretion, to modify these Terms from time to time. If TFC makes any
              changes to these Terms, TFC will provide you with notice of such changes, which notice may be provided
              through the Services or by updating the "Last Updated" date at the top of these Terms.
            </p>
            <p className="mb-4">
              Unless TFC states otherwise in any such notice, any changes made to the Terms shall be effective immediately,
              and your continued use of the Site or the Services after TFC provides such notice will confirm your acceptance
              of the changes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">14. MODIFICATION, SUSPENSION, AND TERMINATION</h2>
            <p className="mb-4">
              TFC may, in its sole discretion, from time to time and with or without prior notice to you, modify, suspend,
              or terminate, in whole or in part (whether temporarily or permanently), the Site or the Services for any reason,
              including to comply with Applicable Law.
            </p>
            <p className="mb-4">
              TFC will not be liable for any losses suffered by you resulting from any modification, suspension, or termination
              of the Site or the Services, or any portion thereof.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">15. DISPUTE RESOLUTION & ARBITRATION</h2>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-yellow-400 mb-3">MANDATORY ARBITRATION AND CLASS ACTION WAIVER:</p>
              <p className="text-surface-200">
                PLEASE READ THIS SECTION CAREFULLY AS IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT
                IN COURT OR TO HAVE A JURY HEAR YOUR CLAIMS. THIS SECTION CONTAINS PROCEDURES FOR MANDATORY BINDING ARBITRATION
                AND A CLASS ACTION WAIVER.
              </p>
            </div>
            <p className="mb-4">
              15.1 YOU ACKNOWLEDGE AND AGREE THAT ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS,
              THE SITE, OR THE SERVICES (EACH, A "DISPUTE") SHALL BE RESOLVED SOLELY THROUGH INDIVIDUAL BINDING ARBITRATION
              BETWEEN YOU AND TFC, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
            </p>
            <p className="mb-4">
              15.2 Prior to commencing any legal proceeding, you and TFC shall first attempt to resolve any Dispute by engaging
              in good faith negotiations for a period of ninety (90) days.
            </p>
            <p className="mb-4">
              15.3 Any Dispute that cannot be resolved through good faith negotiations will be resolved through binding arbitration
              administered by an internationally recognized arbitration body selected by TFC, in accordance with its commercial
              arbitration rules.
            </p>
            <p className="mb-4">15.4 The arbitration shall be conducted in English.</p>
            <p className="mb-4">
              15.5 Any claim arising out of or related to these Terms, the Site, or the Services must be filed within one (1) year
              after such claim arose; otherwise, the claim is permanently barred.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">16. GOVERNING LAW</h2>
            <p className="mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction where TFC
              Technologies Ltd. is incorporated, without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">17. CONTACT</h2>
            <p className="mb-4">For questions about these Terms, contact:</p>
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

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">18. ACKNOWLEDGMENT</h2>
            <p className="mb-4">
              By using Trade Fight Club, you acknowledge that you have read, understood, and agree to these Terms. You further
              acknowledge and understand that:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300">
              <li>TFC is a non-custodial technology platform that provides software tools for interacting with third-party blockchain protocols;</li>
              <li>TFC does not operate an exchange, broker, or trading venue and does not custody user funds;</li>
              <li>All trading activities are peer-to-peer and executed via third-party smart contracts on blockchain networks;</li>
              <li>You are solely responsible for your trading decisions and bear all risks associated with your use of the Services;</li>
              <li>Digital asset trading involves substantial risk and you may lose your entire investment or more;</li>
              <li>The Services are provided "as is" without warranties of any kind.</li>
            </ul>
          </section>

          <div className="bg-surface-900 border border-surface-700 rounded-lg p-6 mt-12">
            <p className="text-sm text-surface-400 mb-4">
              <strong className="text-white">Legal Disclaimer:</strong>
            </p>
            <p className="text-sm text-surface-400">
              TFC is a non-custodial technology interface that provides software tools for interacting with third-party
              blockchain protocols. TFC does not operate an exchange, broker, intermediary, or trading venue and does not
              custody user funds. The Services are not directed to persons located in jurisdictions where the use of digital
              asset derivatives is restricted or prohibited. Users are responsible for ensuring compliance with their local laws.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
