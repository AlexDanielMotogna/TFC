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
              This privacy policy (this "Privacy Policy") applies to your use of any websites, applications, or services
              provided, owned, or operated by TFC Technologies Ltd. or any of its affiliates (collectively, "TFC"). TFC
              values your privacy and the privacy of its other users (collectively, the "Users") and wants you to be familiar
              with how TFC collects, uses, stores, and protects personal information from and about you. By accessing or using
              TFC's websites, applications, or services and disclosing personal information, you are accepting the practices
              described in this Privacy Policy, to the extent permitted by law.
            </p>
            <p className="text-surface-300 mb-6">
              The data controller for the purposes of this Privacy Policy is TFC Technologies Ltd. You may contact us at{' '}
              <a href="mailto:office@tfc.gg" className="text-primary hover:underline">office@tfc.gg</a> for any data
              protection inquiries.
            </p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6 mb-6">
              <p className="font-semibold text-primary mb-3">Important Notice:</p>
              <p className="text-surface-300">
                TFC is a non-custodial technology interface that provides software tools for interacting with third-party
                blockchain protocols. TFC does not operate an exchange, broker, intermediary, or trading venue and does not
                custody user funds. When you use TFC's websites, applications, or services, TFC may collect certain information,
                such as your IP address, browser type, device information, and usage data. This information is used to maintain
                the security and performance of our websites, applications, and services, to detect unauthorized access, and
                to determine your eligibility to use TFC's offerings in compliance with applicable law.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. INFORMATION ABOUT YOU</h2>
            <p className="mb-4">
              TFC obtains information about you through the means discussed below. TFC requires certain information to provide
              its services and fulfill contractual or legal obligations. If you choose not to provide TFC with such information,
              or request the deletion of such information, you may no longer be able to access or use some or all of TFC's
              websites, applications, or services.
            </p>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">User-Provided Information</h3>
              <p className="text-surface-300 mb-3">
                You may provide TFC with certain personal information when using our websites, applications, or services.
                This may include your digital asset wallet address, or any other information that you choose to provide us.
              </p>
              <p className="text-surface-300 mb-3">
                To exercise your rights to access, review, update, delete, or otherwise limit TFC's use of the personal
                information you have provided, you may contact TFC at{' '}
                <a href="mailto:office@tfc.gg" className="text-primary hover:underline">office@tfc.gg</a>. Please include
                the details of your request.
              </p>
              <p className="text-surface-300">
                To protect your privacy and security, TFC may take steps to verify your identity before processing your request.
                TFC may also use trusted third-party verification providers to assist in this process and will ensure that any
                such provider handles personal information solely for the purpose of identity verification.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">Automatically Collected Information</h3>
              <p className="text-surface-300">
                When you access or use TFC's websites, applications, or services, TFC may automatically collect information
                about your system and activity using cookies or other types of data collection technologies. This information
                may include your IP address, device and browser type and identifiers, referring and exit page addresses,
                software and system type, and information about your access and use of TFC's websites, applications, and services.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. USE OF PERSONAL INFORMATION</h2>
            <p className="mb-4">TFC uses the personal information it collects to:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>Operate, maintain, enhance, provide, create, and develop TFC's websites, applications, and services;</li>
              <li>Provide security for TFC's websites, applications, and services;</li>
              <li>Manage relationships and communications with Users;</li>
              <li>Improve Users' experience when they access or use TFC's websites, applications, and services;</li>
              <li>Prevent, detect, and address fraud, abuse, or other harmful activity;</li>
              <li>Analyze and understand the usage trends of its Users.</li>
            </ul>
            <p className="mb-4">
              TFC processes personal information only when it has a lawful basis to do so under applicable data protection laws.
              These bases include: (a) when you have given TFC consent; (b) to perform TFC's contractual obligations or to take
              steps prior to entering into a contract; (c) to comply with applicable laws or lawful requests from public or law
              enforcement authorities; and (d) to pursue TFC's reasonable business interests, provided that such processing does
              not override your fundamental rights and freedoms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. SHARING OF PERSONAL INFORMATION</h2>
            <p className="mb-4">
              TFC may share certain personal information with third-party service providers acting on TFC's behalf. Such
              disclosures may occur for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>To provide website hosting, maintenance, and security services;</li>
              <li>To conduct data analysis and create reports;</li>
              <li>To offer certain functionality;</li>
              <li>To assist TFC in improving TFC's websites, applications, and services.</li>
            </ul>
            <p className="mb-4">
              TFC ensures that such service providers process personal information in accordance with TFC's instruction and this
              Privacy Policy. Such service providers are not permitted to use personal information for any other purpose and are
              required to implement reasonable confidentiality measures to protect personal information.
            </p>
            <p className="mb-4">
              In certain cases, TFC may be required by law to collect, use, or disclose personal information, such as to comply
              with lawful requests from public or law enforcement authorities. TFC may also disclose personal information if TFC
              believes, in good faith, that such disclosure is necessary to comply with applicable laws or regulations, or to
              respond to a court order, subpoena, warrant, or other lawful request from a competent authority, and only to the
              extent required by such obligation.
            </p>
            <p className="mb-4">
              TFC may disclose personal information that TFC believes, in good faith, is appropriate or necessary to: (a) protect
              TFC from potential liability or prevent fraudulent, abusive, or unlawful uses; (b) investigate and defend TFC against
              third-party claims or allegations; (c) protect the security and integrity of TFC and its websites, applications, and
              services; or (d) protect the rights, property, or safety of TFC, its Users, or others, in each case only as permitted
              by applicable law.
            </p>
            <p className="mb-4">
              Other than as set out in this Privacy Policy, TFC will provide notice when personal information about you may be
              shared with third parties and, where reasonably possible, offer you an opportunity to choose not to share such
              personal information.
            </p>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-4">
              <h3 className="font-semibold text-blue-400 mb-3">Non-Personal Information</h3>
              <p className="text-surface-300 text-sm">
                TFC may share or disclose non-personal data, such as aggregated or anonymized information. This information does
                not identify any individual User.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. GLOBAL OPERATIONS AND PRIVACY</h2>
            <p className="mb-4">
              As TFC operates globally, personal information may be transferred, stored, used, and processed in countries other
              than your own. Where required by applicable law, you consent to the transfer of your personal information to
              jurisdictions in which TFC conducts business or provides services. TFC takes appropriate measures, consistent with
              applicable law, to ensure that any international transfers of personal information are subject to suitable safeguards
              designed to protect your privacy and the security of your data.
            </p>
            <p className="mb-4">
              Some of these countries may have privacy and data protection laws that differ from those of your jurisdiction,
              including with respect to when government authorities may access personal information.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. RETENTION OF YOUR INFORMATION</h2>
            <p className="mb-4">
              TFC retains personal information related to your access and use of TFC's websites, applications, and services:
              (a) for as long as necessary to fulfill the purposes described in this Privacy Policy; (b) for the period required
              or permitted by applicable law, such as for tax, accounting, or compliance purposes; or (c) as otherwise communicated
              to you.
            </p>
            <p className="mb-4">
              When you request that TFC delete your personal information, all data that is not required or permitted to be retained
              by law will be deleted or anonymized in accordance with applicable data-protection requirements.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-yellow-400 mb-2">Blockchain Data Notice:</p>
              <p className="text-surface-300 text-sm">
                Please note that information recorded on public blockchains (such as wallet addresses and transaction data) is
                permanent, publicly accessible, and cannot be deleted or modified. TFC has no control over blockchain data.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. THIRD-PARTY SERVICES AND WEBSITES</h2>
            <p className="mb-4">
              TFC's websites, applications, and services may link to third-party websites, applications, or services. The privacy
              practices of those third parties are not governed by this Privacy Policy. TFC is not responsible for the content,
              security, or privacy practices of those third parties. TFC encourages you to review the privacy policies of any
              third-party websites, applications, and services to understand their privacy practices.
            </p>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-primary mb-3">Analytics Providers</h3>
              <p className="text-surface-300 mb-3">
                TFC may use third-party analytics services in connection with TFC's websites, applications, and services. These
                providers may use cookies or other data collection technologies to analyze and evaluate your access and use of
                TFC's websites, applications, and services.
              </p>
              <p className="text-surface-300">
                This Privacy Policy does not govern the use of data by such third parties. TFC encourages you to review the
                privacy policies of any third parties to understand their privacy practices.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. DATA SECURITY</h2>
            <p className="mb-4">
              TFC uses various measures to protect the integrity, confidentiality, and security of personal information. These
              measures may vary based on the sensitivity of your information and the risks involved in processing it.
            </p>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-4">
              <p className="font-semibold text-red-400 mb-2">Important Security Notice:</p>
              <p className="text-surface-300 mb-3">
                While TFC continually works to safeguard your information, no security precautions or systems are completely
                secure. <strong>TFC therefore cannot guarantee the absolute security of any information transmitted to it or
                stored by it.</strong>
              </p>
              <p className="text-surface-300">
                <strong>You are solely responsible for securing your wallet and private keys.</strong> TFC does not have access
                to your private keys, seed phrases, passwords, or other credentials associated with your blockchain wallets.
                Losing control of your private key(s) will permanently and irreversibly deny you access to your digital assets.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. YOUR RIGHTS AND CHOICES</h2>
            <p className="mb-4">
              You have certain rights regarding your personal information that TFC collects and processes. You may exercise
              these rights using the contact information provided in this Policy.
            </p>
            <p className="mb-4">Your rights include:</p>
            <ul className="list-disc pl-6 space-y-2 text-surface-300 mb-4">
              <li>The right to access your personal information and request details about how TFC processes it;</li>
              <li>The right to request the correction of inaccurate personal information;</li>
              <li>The right to request the deletion of your personal information, subject to TFC's legal obligations and legitimate business interests;</li>
              <li>The right to object to or restrict certain processing activities;</li>
              <li>The right to data portability.</li>
            </ul>
            <p className="mb-4">
              You may opt-out of receiving marketing communications that TFC may send to you at any time. Please note that even
              if you opt-out of marketing communications, TFC may still send you important notifications and updates with respect
              to TFC's websites, applications, and services.
            </p>
            <p className="mb-4">
              If you wish to delete your account, you may do so by contacting us. Please note that some information may be retained
              in our records to comply with legal obligations, resolve disputes, enforce our agreements, or protect our legitimate
              business interests.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. CHILDREN'S PRIVACY</h2>
            <p className="mb-4">
              TFC's websites, applications, and services are intended for individuals who have reached the legal age of majority
              in the jurisdiction in which they reside. By accessing or using TFC's websites, applications, or services, you
              represent that you meet this age requirement.
            </p>
            <p className="mb-4">
              TFC does not knowingly collect personal information from individuals who do not meet this age requirement or from
              children under the age of 13. If TFC learns that personal information of such persons has inadvertently been collected,
              TFC will take appropriate steps to delete this information in accordance with applicable law.
            </p>
            <p className="mb-4">
              If you believe personal information has been collected from an individual who does not meet the age requirement or
              from a child under the age of 13, please contact TFC at{' '}
              <a href="mailto:office@tfc.gg" className="text-primary hover:underline">office@tfc.gg</a> to have such personal
              information deleted and any associated account(s) closed.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. MERGER OR SALE</h2>
            <p className="mb-4">
              In the event that TFC, or substantially all of its assets, is acquired by, merged with, or transferred to a
              third-party, or in connection with a contemplated investment or change of ownership transaction, TFC may transfer
              or assign the personal information collected from Users as part of that transaction, including in the course of
              any related diligence process.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. CHANGES AND UPDATES TO THIS PRIVACY POLICY</h2>
            <p className="mb-4">
              TFC reserves the right, in its sole discretion, to modify this Privacy Policy from time to time. If TFC makes any
              changes to this Privacy Policy, TFC will provide you with notice of such changes, which notice may be provided by
              updating the "Last Updated" date at the top of this Privacy Policy.
            </p>
            <p className="mb-4">
              Unless TFC states otherwise in any such notice, any changes made to this Privacy Policy shall be effective immediately,
              and your continued use of TFC's website, applications, or services after TFC provides such notice will confirm your
              acceptance of the changes. If you do not agree to the revised Privacy Policy, then you must stop using TFC's website,
              applications, and services immediately upon receipt of such notice.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
            <p className="mb-4">
              This Privacy Policy shall be governed by and construed in accordance with the laws of the jurisdiction where TFC
              Technologies Ltd. is incorporated, without regard to conflict of law provisions.
            </p>
            <p className="mb-4">
              To the extent permitted by applicable law, any dispute, controversy, or claim arising out of or relating to this
              Privacy Policy, or the breach, termination, or invalidity thereof, shall be resolved through binding arbitration
              in accordance with internationally recognized arbitration rules.
            </p>
            <p className="mb-4">
              The arbitration shall be conducted in the English language. The award rendered by the arbitrators shall be final
              and binding on the parties, and judgment upon the award may be entered in any court having jurisdiction thereof.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">13. CONTACT INFORMATION</h2>
            <p className="mb-4">
              Please contact TFC with any questions or comments about this Privacy Policy:
            </p>
            <div className="bg-surface-800/50 border border-surface-800 rounded-lg p-6">
              <p className="mb-2"><strong>Entity:</strong> TFC Technologies Ltd.</p>
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a href="mailto:office@tfc.gg" className="text-primary hover:underline">
                  office@tfc.gg
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
              TFC is a non-custodial technology platform that provides software tools for interacting with third-party blockchain
              protocols. TFC does not operate an exchange, broker, intermediary, or trading venue and does not custody user funds.
              All blockchain transactions are permanent and publicly recorded. You are solely responsible for the security of your
              wallet and private keys. The Services are provided for use only in jurisdictions where such use is legally permitted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
