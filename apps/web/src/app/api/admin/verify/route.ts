/**
 * Admin Verify API
 * GET /api/admin/verify - Lightweight check that user has admin role
 */
import { withAdminAuth } from '@/lib/server/admin-auth';

export async function GET(request: Request) {
  return withAdminAuth(request, async (user) => {
    return Response.json({ success: true, admin: true, userId: user.userId });
  });
}
