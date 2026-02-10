/**
 * Auth service - ported from NestJS
 * Handles wallet authentication and Pacifica connections
 */
import { prisma } from '../db';
import * as Pacifica from '../pacifica';
import { generateToken } from '../auth';
import { generateReferralCode } from '../referral-utils';
import { processReferralRegistration } from './referral';
import { broadcastUserCreated, broadcastUserUpdated } from '../admin-realtime';
import * as ed from '@noble/ed25519';
import { base58 } from '@scure/base';

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';

/**
 * Connect a user's Pacifica account
 * Creates or updates the PacificaConnection record
 */
export async function connectPacifica(params: {
  userId: string;
  accountAddress: string;
  vaultKeyReference: string;
}): Promise<{ success: boolean; builderCodeApproved: boolean }> {
  console.log('Starting Pacifica connection', {
    userId: params.userId,
    pacificaAccountId: params.accountAddress,
  });

  try {
    // Check if builder code is already approved
    const approvals = await Pacifica.getBuilderCodeApprovals(params.accountAddress);
    const builderCode = process.env.PACIFICA_BUILDER_CODE || '';
    const isApproved = approvals.some((a) => a.builder_code === builderCode);

    // Upsert the connection
    await prisma.pacificaConnection.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        accountAddress: params.accountAddress,
        vaultKeyReference: params.vaultKeyReference,
        builderCodeApproved: isApproved,
        isActive: true,
      },
      update: {
        accountAddress: params.accountAddress,
        vaultKeyReference: params.vaultKeyReference,
        builderCodeApproved: isApproved,
        isActive: true,
      },
    });

    console.log('Pacifica connection successful', {
      userId: params.userId,
      pacificaAccountId: params.accountAddress,
      builderCodeApproved: isApproved,
    });

    return { success: true, builderCodeApproved: isApproved };
  } catch (error) {
    console.error('Pacifica connection failed', error, {
      userId: params.userId,
    });
    throw error;
  }
}

/**
 * Get a user's Pacifica connection
 */
export async function getConnection(userId: string) {
  return prisma.pacificaConnection.findUnique({
    where: { userId },
    include: { user: true },
  });
}

/**
 * Check if a user has an active Pacifica connection
 */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  const connection = await prisma.pacificaConnection.findUnique({
    where: { userId },
    select: { isActive: true, builderCodeApproved: true },
  });

  return connection?.isActive === true;
}

/**
 * Get or create a user by handle
 */
export async function getOrCreateUser(handle: string, avatarUrl?: string) {
  let user = await prisma.user.findUnique({ where: { handle } });

  if (!user) {
    // Create user first to get the ID
    user = await prisma.user.create({
      data: { handle, avatarUrl },
    });

    // Generate and set referral code
    const referralCode = generateReferralCode(user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { referralCode },
    });
  }

  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { pacificaConnection: true },
  });
}

/**
 * Link a Pacifica account to user (read-only, no vault key needed)
 * This allows viewing account data without trading capabilities
 */
export async function linkPacificaAccount(
  userId: string,
  pacificaAddress: string
): Promise<{ connected: boolean; pacificaAddress: string }> {
  console.log('Linking Pacifica account', {
    userId,
    pacificaAddress: pacificaAddress.slice(0, 8) + '...',
  });

  try {
    // Verify the Pacifica account exists by fetching it
    const accountInfo = await Pacifica.getAccount(pacificaAddress);
    if (!accountInfo || accountInfo.balance === undefined) {
      throw new Error('Pacifica account not found. Make sure you have deposited funds on Pacifica.');
    }

    // Upsert the connection (without vault key for read-only)
    await prisma.pacificaConnection.upsert({
      where: { userId },
      create: {
        userId,
        accountAddress: pacificaAddress,
        vaultKeyReference: 'read-only', // No vault key for read-only access
        builderCodeApproved: false,
        isActive: true,
      },
      update: {
        accountAddress: pacificaAddress,
        isActive: true,
      },
    });

    console.log('Pacifica account linked', {
      userId,
      pacificaAddress: pacificaAddress.slice(0, 8) + '...',
    });

    return { connected: true, pacificaAddress };
  } catch (error) {
    console.error('Failed to link Pacifica account', error, {
      userId,
    });
    throw error;
  }
}

/**
 * Authenticate user with Solana wallet signature
 * Automatically attempts to link Pacifica account using the same wallet address
 */
export async function authenticateWallet(
  walletAddress: string,
  signatureBase58: string,
  referralCode?: string
): Promise<{
  token: string;
  user: { id: string; handle: string; avatarUrl: string | null; role: 'USER' | 'ADMIN' };
  pacificaConnected: boolean;
}> {
  console.log('Wallet authentication attempt', {
    walletAddress: walletAddress.slice(0, 8) + '...',
  });

  try {
    // Verify the signature
    const message = new TextEncoder().encode(AUTH_MESSAGE);
    const signature = base58.decode(signatureBase58);
    const publicKey = base58.decode(walletAddress);

    const isValid = await ed.verifyAsync(signature, message, publicKey);

    if (!isValid) {
      console.warn('Invalid wallet signature', {
        walletAddress: walletAddress.slice(0, 8) + '...',
      });
      throw new Error('Invalid signature');
    }

    // Find or create user by wallet address
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { pacificaConnection: true },
    });

    // Check if user is banned or deleted
    if (user && user.status === 'BANNED') {
      console.warn('Banned user attempted login', {
        userId: user.id,
        walletAddress: walletAddress.slice(0, 8) + '...',
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
      });
      throw new Error('Your account has been banned. Please contact support if you believe this is an error.');
    }

    if (user && user.status === 'DELETED') {
      console.warn('Deleted user attempted login', {
        userId: user.id,
        walletAddress: walletAddress.slice(0, 8) + '...',
        deletedAt: user.deletedAt,
      });
      throw new Error('This account has been deleted.');
    }

    if (!user) {
      // Create new user with wallet address as handle (shortened)
      const shortAddress = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
      user = await prisma.user.create({
        data: {
          handle: shortAddress,
          walletAddress,
        },
        include: { pacificaConnection: true },
      });

      // Generate and set referral code
      const userReferralCode = generateReferralCode(user.id);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: userReferralCode },
        include: { pacificaConnection: true },
      });

      console.log('New user created via wallet', {
        userId: user.id,
        walletAddress: walletAddress.slice(0, 8) + '...',
        referralCode: userReferralCode,
      });

      // Broadcast user creation to admin panel
      await broadcastUserCreated({
        id: user.id,
        handle: user.handle,
        walletAddress: user.walletAddress!,
        role: user.role || 'USER',
        createdAt: user.createdAt,
      });

      // Process referral registration if referral code was provided
      if (referralCode) {
        await processReferralRegistration(user.id, referralCode);
      }
    }

    // Check if Pacifica is already connected
    let pacificaConnected = user.pacificaConnection?.isActive === true;

    // If not connected, try to auto-link using the wallet address
    if (!pacificaConnected) {
      try {
        const accountInfo = await Pacifica.getAccount(walletAddress);
        // Pacifica returns an object with balance if account exists
        if (accountInfo && accountInfo.balance !== undefined) {
          // Account exists on Pacifica, link it
          await prisma.pacificaConnection.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              accountAddress: walletAddress,
              vaultKeyReference: 'read-only',
              builderCodeApproved: false,
              isActive: true,
            },
            update: {
              accountAddress: walletAddress,
              isActive: true,
            },
          });
          pacificaConnected = true;
          console.log('Pacifica auto-linked on wallet connect', {
            userId: user.id,
            walletAddress: walletAddress.slice(0, 8) + '...',
            balance: accountInfo.balance,
          });
        }
      } catch (pacificaError) {
        // Pacifica account doesn't exist or error - user needs to deposit first
        console.log('No Pacifica account found for wallet', {
          userId: user.id,
          walletAddress: walletAddress.slice(0, 8) + '...',
        });
      }
    }

    // Check if wallet is an admin wallet
    const ADMIN_WALLET_ADDRESSES = (process.env.ADMIN_WALLET_ADDRESSES || '')
      .split(',')
      .map((addr) => addr.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = ADMIN_WALLET_ADDRESSES.includes(walletAddress.toLowerCase());

    // If admin status changed, update user role
    if (isAdmin && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
        include: { pacificaConnection: true },
      });
      console.log('User promoted to admin', {
        userId: user.id,
        walletAddress: walletAddress.slice(0, 8) + '...',
      });

      // Broadcast role update to admin panel
      await broadcastUserUpdated({
        id: user.id,
        handle: user.handle,
        walletAddress: user.walletAddress,
        role: 'ADMIN',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }

    // Generate JWT token with role
    const token = generateToken(user.id, user.walletAddress!, user.role || 'USER');

    console.log('Wallet authentication successful', {
      userId: user.id,
      walletAddress: walletAddress.slice(0, 8) + '...',
      pacificaConnected,
      role: user.role || 'USER',
    });

    return {
      token,
      user: {
        id: user.id,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        role: user.role || 'USER',
      },
      pacificaConnected,
    };
  } catch (error) {
    console.error('Wallet authentication failed', error, {
      walletAddress: walletAddress.slice(0, 8) + '...',
    });
    throw error;
  }
}
