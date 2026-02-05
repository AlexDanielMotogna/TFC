/**
 * Link Pacifica account (read-only)
 * POST /api/auth/pacifica/link
 */
import { withAuth } from '@/lib/server/auth';
import * as AuthService from '@/lib/server/services/auth';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function POST(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const body = await request.json();
      const { pacificaAddress } = body;

      if (!pacificaAddress) {
        throw new BadRequestError('pacificaAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      const result = await AuthService.linkPacificaAccount(user.userId, pacificaAddress);

      return result;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
