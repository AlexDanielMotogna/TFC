import { NextResponse } from 'next/server';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const PACIFICA_API_KEY = process.env.PACIFICA_API_KEY;

// Service account to fetch public fee info
const SERVICE_ACCOUNT = 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k';

// TradeFightClub platform fee (fixed)
const TFC_FEE = 0.0005; // 0.05%

// Cache fees for 1 hour to avoid hitting Pacifica too often
let cachedFees: { makerFee: number; takerFee: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/fees
 * Returns current trading fees (Pacifica + TFC)
 * Public endpoint - no auth required
 */
export async function GET() {
  try {
    // Check cache
    if (cachedFees && Date.now() - cachedFees.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: {
          makerFee: cachedFees.makerFee,
          takerFee: cachedFees.takerFee,
          makerFeePercent: (cachedFees.makerFee * 100).toFixed(4),
          takerFeePercent: (cachedFees.takerFee * 100).toFixed(4),
          tfcFee: TFC_FEE,
          tfcFeePercent: (TFC_FEE * 100).toFixed(2),
          cached: true,
        },
      });
    }

    // Fetch from Pacifica API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (PACIFICA_API_KEY) {
      headers['PF-API-KEY'] = PACIFICA_API_KEY;
    }

    const response = await fetch(
      `${PACIFICA_API_URL}/api/v1/account?account=${SERVICE_ACCOUNT}`,
      { headers, next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      throw new Error(`Pacifica API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid Pacifica response');
    }

    // Parse fees from Pacifica (they return as strings like "0.00015")
    const pacificaMakerFee = parseFloat(data.data.maker_fee || '0.00015');
    const pacificaTakerFee = parseFloat(data.data.taker_fee || '0.0004');

    // Add TFC fee
    const totalMakerFee = pacificaMakerFee + TFC_FEE;
    const totalTakerFee = pacificaTakerFee + TFC_FEE;

    // Update cache
    cachedFees = {
      makerFee: totalMakerFee,
      takerFee: totalTakerFee,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      data: {
        makerFee: totalMakerFee,
        takerFee: totalTakerFee,
        makerFeePercent: (totalMakerFee * 100).toFixed(4),
        takerFeePercent: (totalTakerFee * 100).toFixed(4),
        tfcFee: TFC_FEE,
        tfcFeePercent: (TFC_FEE * 100).toFixed(2),
        pacificaMakerFee,
        pacificaTakerFee,
        cached: false,
      },
    });
  } catch (error) {
    console.error('Error fetching fees:', error);

    // Return fallback values on error
    const fallbackMaker = 0.00015 + TFC_FEE; // 0.065%
    const fallbackTaker = 0.0004 + TFC_FEE;  // 0.09%

    return NextResponse.json({
      success: true,
      data: {
        makerFee: fallbackMaker,
        takerFee: fallbackTaker,
        makerFeePercent: (fallbackMaker * 100).toFixed(4),
        takerFeePercent: (fallbackTaker * 100).toFixed(4),
        tfcFee: TFC_FEE,
        tfcFeePercent: (TFC_FEE * 100).toFixed(2),
        fallback: true,
      },
    });
  }
}
