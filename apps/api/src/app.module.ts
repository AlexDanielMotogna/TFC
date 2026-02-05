import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { LoggingMiddleware } from './common/middleware/logging.middleware.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MarketsModule } from './modules/markets/markets.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { FightsModule } from './modules/fights/fights.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ChartDataModule } from './modules/chart-data/chart-data.module.js';
import { PacificaModule } from './pacifica/pacifica.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PacificaModule,
    AuthModule,
    MarketsModule,
    AccountModule,
    OrdersModule,
    FightsModule,
    UsersModule,
    LeaderboardModule,
    NotificationsModule,
    ChartDataModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggingMiddleware).forRoutes('*');
  }
}
