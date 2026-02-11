/**
 * Admin Referral Payout Retry API
 * POST /api/admin/referrals/payouts/[id]/retry - Manually retry a failed payout
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError, NotFoundError } from '@/lib/server/errors';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return withAdminAuth(request, async () => {
      const payoutId = params.id;

      // Find the payout
      const payout = await prisma.referralPayout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        throw new NotFoundError('Payout not found');
      }

      // Only allow retry for failed payouts
      if (payout.status !== 'failed') {
        throw new BadRequestError(
          `Cannot retry payout with status "${payout.status}". Only failed payouts can be retried.`
        );
      }

      // Reset payout to pending
      const updatedPayout = await prisma.referralPayout.update({
        where: { id: payoutId },
        data: {
          status: 'pending',
          processedAt: null,
        },
      });

      return Response.json({
        success: true,
        message: 'Payout reset to pending. The automated processor will retry it on the next cycle (within 15 minutes).',
        payout: {
          id: updatedPayout.id,
          status: updatedPayout.status,
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
