/**
 * Mobile detection utilities for Phantom dApp browser integration
 */

/**
 * Check if the current device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

/**
 * Check if the current device is iOS (iPhone/iPad/iPod)
 * SolanaMobileWalletAdapter does NOT work on iOS - only Android.
 * On iOS, PhantomWalletAdapter handles the redirect to Phantom's in-app browser.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Check if we're running inside Phantom's dApp browser
 * Phantom injects window.phantom.solana when running inside their browser
 */
export function isPhantomBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Phantom's injected provider (cast to any to avoid type conflicts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantom = (window as any).phantom;
  const hasPhantomProvider = !!phantom?.solana?.isPhantom;

  // Also check user agent (Phantom app includes "Phantom" in UA)
  const hasPhantomUA = /Phantom/i.test(navigator.userAgent);

  return hasPhantomProvider || hasPhantomUA;
}

/**
 * Get the device context for wallet configuration
 * - desktop: browser extensions (Phantom, Solflare)
 * - phantom-browser: inside Phantom's dApp browser (provider injected)
 * - ios-mobile-browser: iOS Safari/Chrome - needs PhantomWalletAdapter (redirects to Phantom app)
 * - android-mobile-browser: Android browser - can use SolanaMobileWalletAdapter
 */
export type DeviceContext = 'desktop' | 'ios-mobile-browser' | 'android-mobile-browser' | 'phantom-browser';

export function getDeviceContext(): DeviceContext {
  if (typeof window === 'undefined') return 'desktop';

  if (!isMobileDevice()) {
    return 'desktop';
  }

  if (isPhantomBrowser()) {
    return 'phantom-browser';
  }

  if (isIOSDevice()) {
    return 'ios-mobile-browser';
  }

  return 'android-mobile-browser';
}

/**
 * Generate a Phantom universal link to open a URL in Phantom's dApp browser
 * @param appUrl The URL to open inside Phantom
 * @returns The Phantom universal link
 */
export function getPhantomDeepLink(appUrl: string): string {
  const encodedUrl = encodeURIComponent(appUrl);
  // Use phantom:// scheme to directly open the app (not the website)
  // The universal link (https://phantom.app/ul/browse/) often redirects to
  // the download page even when Phantom is installed
  return `phantom://browse/${encodedUrl}`;
}

/**
 * Check if Phantom wallet app is likely installed (heuristic)
 * Note: This is not 100% reliable, but provides a reasonable guess
 */
export function isPhantomLikelyInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // On mobile, we can't reliably detect if app is installed
  // But if phantom provider exists, the extension/app is present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).phantom?.solana;
}
