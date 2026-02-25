import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';

const NADO_ARCHIVE_URL = process.env.NADO_ARCHIVE_URL || 'https://archive.test.nado.xyz/v1';

/**
 * Proxy for Nado Archive queries.
 * The Nado API doesn't support CORS, so browser-side code
 * must go through this server-side proxy for REST calls.
 *
 * Authentication: Requires a valid JWT Bearer token.
 * Rate limiting: 60 requests per minute per IP.
 */
export async function POST(req: NextRequest) {
  try {
    // --- Authentication ---
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { status: 'failure', error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    try {
      verifyToken(token);
    } catch {
      return NextResponse.json(
        { status: 'failure', error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // --- Rate limiting ---
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { status: 'failure', error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    // --- Proxy to Nado Archive ---
    const body = await req.json();

    const response = await fetch(NADO_ARCHIVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[NadoProxy] Archive query error:', error);
    return NextResponse.json({ status: 'failure', error: 'Proxy request failed' }, { status: 502 });
  }
}
