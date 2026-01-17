import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me - Get current user profile
   * Requires authentication
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: { user: { userId: string } }) {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * GET /users/me/fights - Get current user's fight history
   * Requires authentication
   */
  @Get('me/fights')
  @UseGuards(JwtAuthGuard)
  async getMyFightHistory(
    @Request() req: { user: { userId: string } },
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.usersService.getFightHistory(req.user.userId, parsedLimit);
  }

  /**
   * GET /users/:id - Get user profile by ID (public)
   */
  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  /**
   * GET /users/:id/fights - Get user's fight history (public)
   */
  @Get(':id/fights')
  async getFightHistory(
    @Param('id') id: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.usersService.getFightHistory(id, parsedLimit);
  }
}
