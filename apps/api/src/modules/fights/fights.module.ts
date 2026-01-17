import { Module } from '@nestjs/common';
import { FightsController } from './fights.controller.js';
import { FightsService } from './fights.service.js';

@Module({
  controllers: [FightsController],
  providers: [FightsService],
  exports: [FightsService],
})
export class FightsModule {}
