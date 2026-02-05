/**
 * Wallet authentication endpoint
 * POST /api/auth/connect - Authenticate with Solana wallet signature
 */
import * as AuthService from '@/lib/server/services/auth';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, signature, referralCode } = body;

    if (!walletAddress || !signature) {
      throw new BadRequestError('walletAddress and signature are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    const result = await AuthService.authenticateWallet(walletAddress, signature, referralCode);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
