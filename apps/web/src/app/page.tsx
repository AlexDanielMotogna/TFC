'use client';

import {
  LandingNavbar,
  HeroSection,
  FeaturesGrid,
  PrizePoolSection,
  MobileAppSection,
  Web3Experience,
  ReferralSection,
  FAQSection,
  LandingFooter,
} from '@/components/landing';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <LandingNavbar />
      <HeroSection />
      <MobileAppSection />
      <FeaturesGrid />
      <PrizePoolSection />
      <Web3Experience />
      <ReferralSection />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
