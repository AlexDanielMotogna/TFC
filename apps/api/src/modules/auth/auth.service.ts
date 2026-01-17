import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@tfc/db';
import { createLogger, updateContext } from '@tfc/logger';
import { LOG_EVENTS, AUTH_REJECTION } from '@tfc/shared';
import { PacificaService } from '../../pacifica/pacifica.service.js';
import * as ed from '@noble/ed25519';
import { base58 } from '@scure/base';

const logger = createLogger({ service: 'api' });

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';

@Injectable()
export class AuthService {
  constructor(
    private readonly pacifica: PacificaService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Connect a user's Pacifica account
   * Creates or updates the PacificaConnection record
   */
  async connectPacifica(params: {
    userId: string;
    accountAddress: string;
    vaultKeyReference: string;
  }): Promise<{ success: boolean; builderCodeApproved: boolean }> {
    logger.info(LOG_EVENTS.AUTH_CONNECT_START, 'Starting Pacifica connection', {
      userId: params.userId,
      pacificaAccountId: params.accountAddress,
    });

    try {
      // Check if builder code is already approved
      const approvals = await this.pacifica.getBuilderCodeApprovals(params.accountAddress);
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

      logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'Pacifica connection successful', {
        userId: params.userId,
        pacificaAccountId: params.accountAddress,
        builderCodeApproved: isApproved,
      });

      return { success: true, builderCodeApproved: isApproved };
    } catch (error) {
      logger.error(LOG_EVENTS.AUTH_CONNECT_FAILURE, 'Pacifica connection failed', error as Error, {
        userId: params.userId,
      });
      throw error;
    }
  }

  /**
   * Get a user's Pacifica connection
   */
  async getConnection(userId: string) {
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (connection) {
      // Update context for logging
      updateContext({
        userId,
        pacificaAccountId: connection.accountAddress,
      });
    }

    return connection;
  }

  /**
   * Check if a user has an active Pacifica connection
   */
  async hasActiveConnection(userId: string): Promise<boolean> {
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId },
      select: { isActive: true, builderCodeApproved: true },
    });

    return connection?.isActive === true;
  }

  /**
   * Get or create a user by handle
   */
  async getOrCreateUser(handle: string, avatarUrl?: string) {
    let user = await prisma.user.findUnique({ where: { handle } });

    if (!user) {
      user = await prisma.user.create({
        data: { handle, avatarUrl },
      });
    }

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { pacificaConnection: true },
    });
  }

  /**
   * Link a Pacifica account to user (read-only, no vault key needed)
   * This allows viewing account data without trading capabilities
   */
  async linkPacificaAccount(
    userId: string,
    pacificaAddress: string
  ): Promise<{ connected: boolean; pacificaAddress: string }> {
    logger.info(LOG_EVENTS.AUTH_CONNECT_START, 'Linking Pacifica account', {
      userId,
      pacificaAddress: pacificaAddress.slice(0, 8) + '...',
    });

    try {
      // Verify the Pacifica account exists by fetching it
      const accountInfo = await this.pacifica.getAccount(pacificaAddress);
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

      logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'Pacifica account linked', {
        userId,
        pacificaAddress: pacificaAddress.slice(0, 8) + '...',
      });

      return { connected: true, pacificaAddress };
    } catch (error) {
      logger.error(LOG_EVENTS.AUTH_CONNECT_FAILURE, 'Failed to link Pacifica account', error as Error, {
        userId,
      });
      throw error;
    }
  }

  /**
   * Authenticate user with Solana wallet signature
   * Automatically attempts to link Pacifica account using the same wallet address
   */
  async authenticateWallet(
    walletAddress: string,
    signatureBase58: string
  ): Promise<{
    token: string;
    user: { id: string; handle: string; avatarUrl: string | null };
    pacificaConnected: boolean;
  }> {
    logger.info(LOG_EVENTS.AUTH_CONNECT_START, 'Wallet authentication attempt', {
      walletAddress: walletAddress.slice(0, 8) + '...',
    });

    try {
      // Verify the signature
      const message = new TextEncoder().encode(AUTH_MESSAGE);
      const signature = base58.decode(signatureBase58);
      const publicKey = base58.decode(walletAddress);

      const isValid = await ed.verifyAsync(signature, message, publicKey);

      if (!isValid) {
        logger.warn(LOG_EVENTS.AUTH_CONNECT_FAILURE, 'Invalid wallet signature', {
          walletAddress: walletAddress.slice(0, 8) + '...',
        });
        throw new Error('Invalid signature');
      }

      // Find or create user by wallet address
      let user = await prisma.user.findUnique({
        where: { walletAddress },
        include: { pacificaConnection: true },
      });

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
        logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'New user created via wallet', {
          userId: user.id,
          walletAddress: walletAddress.slice(0, 8) + '...',
        });
      }

      // Check if Pacifica is already connected
      let pacificaConnected = user.pacificaConnection?.isActive === true;

      // If not connected, try to auto-link using the wallet address
      if (!pacificaConnected) {
        try {
          const accountInfo = await this.pacifica.getAccount(walletAddress);
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
            logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'Pacifica auto-linked on wallet connect', {
              userId: user.id,
              walletAddress: walletAddress.slice(0, 8) + '...',
              balance: accountInfo.balance,
            });
          }
        } catch (pacificaError) {
          // Pacifica account doesn't exist or error - user needs to deposit first
          logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'No Pacifica account found for wallet', {
            userId: user.id,
            walletAddress: walletAddress.slice(0, 8) + '...',
          });
        }
      }

      // Generate JWT token
      const token = this.jwtService.sign({
        sub: user.id,
        walletAddress: user.walletAddress,
      });

      logger.info(LOG_EVENTS.AUTH_CONNECT_SUCCESS, 'Wallet authentication successful', {
        userId: user.id,
        walletAddress: walletAddress.slice(0, 8) + '...',
        pacificaConnected,
      });

      return {
        token,
        user: {
          id: user.id,
          handle: user.handle,
          avatarUrl: user.avatarUrl,
        },
        pacificaConnected,
      };
    } catch (error) {
      logger.error(LOG_EVENTS.AUTH_CONNECT_FAILURE, 'Wallet authentication failed', error as Error, {
        walletAddress: walletAddress.slice(0, 8) + '...',
      });
      throw error;
    }
  }
}
