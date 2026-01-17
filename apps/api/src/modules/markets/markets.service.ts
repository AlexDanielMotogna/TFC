import { Injectable } from '@nestjs/common';
import { PacificaService } from '../../pacifica/pacifica.service.js';

@Injectable()
export class MarketsService {
  constructor(private readonly pacifica: PacificaService) {}

  async getMarkets() {
    return this.pacifica.getMarkets();
  }

  async getPrices() {
    return this.pacifica.getPrices();
  }

  async getOrderbook(symbol: string, aggLevel = 1) {
    return this.pacifica.getOrderbook(symbol, aggLevel);
  }

  async getKlines(symbol: string, interval: string, startTime: number, endTime?: number) {
    return this.pacifica.getKlines({ symbol, interval, startTime, endTime });
  }

  async getRecentTrades(symbol: string) {
    return this.pacifica.getRecentTrades(symbol);
  }
}
