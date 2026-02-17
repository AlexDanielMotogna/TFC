/**
 * Beta access check endpoint
 * GET /api/beta/check?wallet=xxx - Check if wallet has beta access
 */
import { prisma } from '@tfc/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      throw new BadRequestError('wallet query parameter is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
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

    const hasAccess = entry.status === 'approved';

    // If beta is approved, check if this wallet is an alpha tester with restricted access
    if (hasAccess) {
      const alphaTester = await prisma.alphaTester.findUnique({
        where: { walletAddress },
      });
      if (alphaTester && !alphaTester.accessEnabled) {
        // Fetch user's referral code so alpha tester page can show it
        const user = await prisma.user.findUnique({
          where: { walletAddress },
          select: { referralCode: true },
        });
        return Response.json({
          success: true,
          hasAccess: false,
          status: entry.status,
          applied: true,
          appliedAt: entry.appliedAt,
          approvedAt: entry.approvedAt,
          isAlphaTester: true,
          referralCode: user?.referralCode || null,
        });
      }
    }

    return Response.json({
      success: true,
      hasAccess,
      status: entry.status,
      applied: true,
      appliedAt: entry.appliedAt,
      approvedAt: entry.approvedAt,
      isAlphaTester: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
