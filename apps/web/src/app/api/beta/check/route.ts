/**
 * Beta access check endpoint
 * GET /api/beta/check?wallet=xxx - Check if wallet has beta access
 */
import { prisma } from '@tfc/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      throw new BadRequestError('wallet query parameter is required');
    }

    const entry = await prisma.betaWhitelist.findUnique({
      where: { walletAddress },
    });

    if (!entry) {
      return Response.json({
        success: true,
        hasAccess: false,
        status: null,
        applied: false,
      });
    }

    return Response.json({
      success: true,
      hasAccess: entry.status === 'approved',
      status: entry.status,
      applied: true,
      appliedAt: entry.appliedAt,
      approvedAt: entry.approvedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
