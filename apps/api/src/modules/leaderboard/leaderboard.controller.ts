import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService, LeaderboardRange, LeaderboardEntry } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET /leaderboard
   * Get leaderboard for a specific range
   *
   * Query params:
   * - range: 'weekly' | 'all_time' (default: 'weekly')
   * - limit: number (default: 50, max: 100)
   */
  @Get()
  async getLeaderboard(
    @Query('range') range?: string,
    @Query('limit') limit?: string
  ): Promise<{
    range: LeaderboardRange;
    snapshotTime: Date;
    entries: LeaderboardEntry[];
  }> {
    const validRanges: LeaderboardRange[] = ['weekly', 'all_time'];
    const selectedRange: LeaderboardRange = validRanges.includes(range as LeaderboardRange)
      ? (range as LeaderboardRange)
      : 'weekly';

    const parsedLimit = Math.min(
      Math.max(parseInt(limit || '50', 10) || 50, 1),
      100
    );

    return this.leaderboardService.getLeaderboard(selectedRange, parsedLimit);
  }
}
