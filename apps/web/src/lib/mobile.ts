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
 */
export type DeviceContext = 'desktop' | 'mobile-browser' | 'phantom-browser';

export function getDeviceContext(): DeviceContext {
  if (typeof window === 'undefined') return 'desktop';

  if (!isMobileDevice()) {
    return 'desktop';
  }

  if (isPhantomBrowser()) {
    return 'phantom-browser';
  }

  return 'mobile-browser';
}

/**
 * Generate a Phantom universal link to open a URL in Phantom's dApp browser
 * @param appUrl The URL to open inside Phantom
 * @returns The Phantom universal link
 */
export function getPhantomDeepLink(appUrl: string): string {
  const encodedUrl = encodeURIComponent(appUrl);
  return `https://phantom.app/ul/browse/${encodedUrl}`;
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
