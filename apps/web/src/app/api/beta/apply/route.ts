/**
 * Beta whitelist application endpoint
 * POST /api/beta/apply - Register wallet for beta access
 */
import { prisma } from '@tfc/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      throw new BadRequestError('walletAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Check if already applied
    const existing = await prisma.betaWhitelist.findUnique({
      where: { walletAddress },
    });

    if (existing) {
      return Response.json({
        success: true,
        status: existing.status,
        appliedAt: existing.appliedAt,
        message: existing.status === 'approved'
          ? 'You already have beta access!'
          : 'You have already applied for beta access',
      });
    }

    // Create new application
    const application = await prisma.betaWhitelist.create({
      data: { walletAddress },
    });

    return Response.json({
      success: true,
      status: application.status,
      appliedAt: application.appliedAt,
      message: 'Beta application submitted successfully',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
