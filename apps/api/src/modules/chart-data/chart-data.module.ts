import { Module } from '@nestjs/common';
import { ChartDataController } from './chart-data.controller.js';
import { ChartDataAggregator } from './chart-data.aggregator.js';
import { BinanceSource } from './sources/binance.source.js';
import { BybitSource } from './sources/bybit.source.js';
import { PacificaSource } from './sources/pacifica.source.js';
import { PacificaModule } from '../../pacifica/pacifica.module.js';

@Module({
  imports: [PacificaModule],
  controllers: [ChartDataController],
  providers: [
    ChartDataAggregator,
    BinanceSource,
    BybitSource,
    PacificaSource,
  ],
  exports: [ChartDataAggregator],
})
export class ChartDataModule {}
