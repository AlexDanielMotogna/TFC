import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FightStatus } from '@tfc/db';
import { FightsService } from './fights.service.js';

class CreateFightDto {
  durationMinutes!: number;
  stakeUsdc!: number;
}

@Controller('fights')
export class FightsController {
  constructor(private readonly fightsService: FightsService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return userId;
  }

  /**
   * Create a new fight
   * POST /api/fights
   */
  @Post()
  async createFight(
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateFightDto
  ) {
    const userId = this.getUserId(headers);
    const fight = await this.fightsService.createFight({
      creatorId: userId,
      durationMinutes: dto.durationMinutes,
      stakeUsdc: dto.stakeUsdc,
    });
    return { success: true, data: fight };
  }

  /**
   * Join a fight
   * POST /api/fights/:id/join
   */
  @Post(':id/join')
  async joinFight(
    @Headers() headers: Record<string, string>,
    @Param('id') fightId: string
  ) {
    const userId = this.getUserId(headers);
    const fight = await this.fightsService.joinFight(fightId, userId);
    return { success: true, data: fight };
  }

  /**
   * List fights
   * GET /api/fights
   */
  @Get()
  async listFights(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.fightsService.listFights({
      status: status as FightStatus | undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return { success: true, data: result.fights, pagination: result.pagination };
  }

  /**
   * Get user's fights
   * GET /api/fights/user/me
   * NOTE: This must be defined BEFORE :id route to avoid conflicts
   */
  @Get('user/me')
  async getMyFights(
    @Headers() headers: Record<string, string>,
    @Query('status') status?: string
  ) {
    const userId = this.getUserId(headers);
    const fights = await this.fightsService.getUserFights(
      userId,
      status as FightStatus | undefined
    );
    return { success: true, data: fights };
  }

  /**
   * Get fight by ID
   * GET /api/fights/:id
   */
  @Get(':id')
  async getFight(@Param('id') fightId: string) {
    const fight = await this.fightsService.getFight(fightId);
    if (!fight) {
      throw new HttpException('Fight not found', HttpStatus.NOT_FOUND);
    }
    return { success: true, data: fight };
  }

  /**
   * Cancel a fight (only creator can cancel waiting fights)
   * DELETE /api/fights/:id
   */
  @Delete(':id')
  async cancelFight(
    @Headers() headers: Record<string, string>,
    @Param('id') fightId: string
  ) {
    const userId = this.getUserId(headers);
    const result = await this.fightsService.cancelFight(fightId, userId);
    return { success: true, data: result };
  }
}
