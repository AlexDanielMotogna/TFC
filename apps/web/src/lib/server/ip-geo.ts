/**
 * IP Geolocation helper
 * Uses ip-api.com (free, no API key) to resolve country and ISP from IP address.
 * Called server-side only. Non-blocking: failures return nulls.
 */

interface GeoInfo {
  country: string | null;
  isp: string | null;
}

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

export async function getIpGeoInfo(ip: string): Promise<GeoInfo> {
  const empty: GeoInfo = { country: null, isp: null };

  if (!ip || ip === 'unknown' || isPrivateIp(ip)) {
    return empty;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,isp`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return empty;

    const data = await res.json();

    if (data.status !== 'success') return empty;

    return {
      country: data.country || null,
      isp: data.isp || null,
    };
  } catch {
    return empty;
  }
}
