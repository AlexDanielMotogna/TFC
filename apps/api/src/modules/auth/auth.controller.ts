import { Controller, Post, Get, Body, Param, HttpException, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

class ConnectWalletDto {
  @IsString()
  walletAddress!: string;

  @IsString()
  signature!: string;
}

class ConnectPacificaDto {
  @IsString()
  handle!: string;

  @IsString()
  accountAddress!: string;

  @IsString()
  vaultKeyReference!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

class LinkPacificaDto {
  @IsString()
  pacificaAddress!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate with Solana wallet
   * POST /api/auth/connect
   */
  @Post('connect')
  async connectWallet(@Body() dto: ConnectWalletDto) {
    try {
      const result = await this.authService.authenticateWallet(
        dto.walletAddress,
        dto.signature
      );

      return {
        token: result.token,
        user: {
          id: result.user.id,
          handle: result.user.handle,
          avatarUrl: result.user.avatarUrl,
        },
        pacificaConnected: result.pacificaConnected,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Authentication failed',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * Connect a Pacifica account
   * POST /api/auth/pacifica/connect
   */
  @Post('pacifica/connect')
  async connectPacifica(@Body() dto: ConnectPacificaDto) {
    // Get or create user
    const user = await this.authService.getOrCreateUser(dto.handle, dto.avatarUrl);

    // Connect Pacifica account
    const result = await this.authService.connectPacifica({
      userId: user.id,
      accountAddress: dto.accountAddress,
      vaultKeyReference: dto.vaultKeyReference,
    });

    return {
      success: true,
      data: {
        userId: user.id,
        handle: user.handle,
        ...result,
      },
    };
  }

  /**
   * Get connection status
   * GET /api/auth/pacifica/status/:userId
   */
  @Get('pacifica/status/:userId')
  async getConnectionStatus(@Param('userId') userId: string) {
    const connection = await this.authService.getConnection(userId);

    if (!connection) {
      return {
        success: true,
        data: {
          connected: false,
          builderCodeApproved: false,
        },
      };
    }

    return {
      success: true,
      data: {
        connected: connection.isActive,
        builderCodeApproved: connection.builderCodeApproved,
        accountAddress: connection.accountAddress,
        connectedAt: connection.connectedAt,
      },
    };
  }

  /**
   * Link Pacifica account to current user (for read-only access)
   * POST /api/auth/pacifica/link
   * Requires JWT authentication
   */
  @Post('pacifica/link')
  @UseGuards(JwtAuthGuard)
  async linkPacifica(
    @Request() req: { user: { userId: string } },
    @Body() dto: LinkPacificaDto
  ) {
    try {
      const result = await this.authService.linkPacificaAccount(
        req.user.userId,
        dto.pacificaAddress
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to link Pacifica account',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get my Pacifica connection status
   * GET /api/auth/pacifica/me
   * Requires JWT authentication
   */
  @Get('pacifica/me')
  @UseGuards(JwtAuthGuard)
  async getMyConnectionStatus(@Request() req: { user: { userId: string } }) {
    const connection = await this.authService.getConnection(req.user.userId);

    if (!connection) {
      return {
        success: true,
        data: {
          connected: false,
          pacificaAddress: null,
        },
      };
    }

    return {
      success: true,
      data: {
        connected: connection.isActive,
        pacificaAddress: connection.accountAddress,
        connectedAt: connection.connectedAt,
      },
    };
  }
}
