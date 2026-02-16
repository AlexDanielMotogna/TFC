/**
 * Beta whitelist application endpoint
 * POST /api/beta/apply - Register wallet for beta access
 * Captures IP, geolocation, user agent and flags duplicate IPs
 */
import { prisma } from '@tfc/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { extractIpAddress, extractUserAgent } from '@/lib/server/anti-cheat';
import { getIpGeoInfo } from '@/lib/server/ip-geo';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      throw new BadRequestError('walletAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    const rawIp = extractIpAddress(request);
    const ipAddress = rawIp !== 'unknown' ? rawIp : null;
    const userAgent = extractUserAgent(request);

    // Check if already applied
    const existing = await prisma.betaWhitelist.findUnique({
      where: { walletAddress },
    });

    if (existing) {
      // Backfill IP/geo/UA if missing (pre-migration applications)
      if (!existing.ipAddress && ipAddress) {
        const geo = await getIpGeoInfo(ipAddress);
        await prisma.betaWhitelist.update({
          where: { walletAddress },
          data: {
            ipAddress,
            country: geo.country,
            isp: geo.isp,
            userAgent: userAgent || existing.userAgent,
          },
        });
      }

      return Response.json({
        success: true,
        status: existing.status,
        appliedAt: existing.appliedAt,
        message: existing.status === 'approved'
          ? 'You already have beta access!'
          : 'You have already applied for beta access',
      });
    }

    // Resolve geolocation
    const geo = ipAddress ? await getIpGeoInfo(ipAddress) : { country: null, isp: null };

    // Check for duplicate IPs
    let multiIpFlag = false;
    let deviceMatchFlag = false;
    let ipAccountCount = 1;

    if (ipAddress) {
      const sameIpRecords = await prisma.betaWhitelist.findMany({
        where: { ipAddress },
        select: { userAgent: true },
      });

      ipAccountCount = sameIpRecords.length + 1;
      multiIpFlag = sameIpRecords.length > 0;
      deviceMatchFlag = sameIpRecords.some(
        (r) => r.userAgent && userAgent && r.userAgent === userAgent
      );
    }

    // Create new application
    const application = await prisma.betaWhitelist.create({
      data: {
        walletAddress,
        ipAddress,
        country: geo.country,
        isp: geo.isp,
        userAgent,
        multiIpFlag,
        deviceMatchFlag,
        ipAccountCount,
      },
    });

    // Flag all existing records with the same IP
    if (multiIpFlag && ipAddress) {
      await prisma.betaWhitelist.updateMany({
        where: {
          ipAddress,
          id: { not: application.id },
        },
        data: {
          multiIpFlag: true,
          ipAccountCount,
        },
      });

      // If device match, also flag those specific records
      if (deviceMatchFlag && userAgent) {
        await prisma.betaWhitelist.updateMany({
          where: {
            ipAddress,
            userAgent,
            id: { not: application.id },
          },
          data: { deviceMatchFlag: true },
        });
      }
    }

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
