'use client';

import { useEffect } from 'react';
import { isMobileDevice, isPhantomBrowser, getPhantomDeepLink } from '@/lib/mobile';

/**
 * Auto-redirects mobile users to Phantom's dApp browser.
 * On mobile (outside Phantom), wallet connection doesn't work properly,
 * so we force-redirect to open TFC inside Phantom's in-app browser.
 */
export function MobilePhantomRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only redirect on mobile devices NOT already in Phantom's browser
    if (isMobileDevice() && !isPhantomBrowser()) {
      const currentUrl = window.location.href;
      window.location.href = getPhantomDeepLink(currentUrl);
    }
  }, []);

  return null;
}
