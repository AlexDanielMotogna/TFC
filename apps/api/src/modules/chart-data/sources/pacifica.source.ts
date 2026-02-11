import { Injectable, Logger } from '@nestjs/common';
import { PacificaService } from '../../../pacifica/pacifica.service.js';
import { Candle, DataSource } from '../types.js';
import { adaptPacificaCandles } from '../adapters/index.js';
import { mapSymbol, isSymbolSupported } from '../symbol-mapping.js';

/**
 * Pacifica API data source.
 * Primary source for recent data (June 2025+).
 * Uses the existing PacificaService for API calls.
 */
@Injectable()
export class PacificaSource implements DataSource {
  readonly name = 'pacifica';
  private readonly logger = new Logger(PacificaSource.name);

  constructor(private readonly pacificaService: PacificaService) {}

  /**
   * Pacifica has data starting from June 2025.
   */
  getHistoricalStart(): Date {
    return new Date('2025-06-01');
  }

  /**
   * Check if a TFC symbol is supported by Pacifica.
   */
  supportsSymbol(tfcSymbol: string): boolean {
    return isSymbolSupported(tfcSymbol, 'pacifica');
  }

  /**
   * Fetch candles from Pacifica API.
   */
  async fetchCandles(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const pacificaSymbol = mapSymbol(tfcSymbol, 'pacifica');

    if (!pacificaSymbol) {
      this.logger.warn(`Symbol ${tfcSymbol} not supported by Pacifica`);
      return [];
    }

    try {
      this.logger.debug(
        `Fetching from Pacifica: ${pacificaSymbol} ${interval} ${startTime}-${endTime}`
      );

      const rawCandles = await this.pacificaService.getKlines({
        symbol: pacificaSymbol,
        interval,
        startTime,
        endTime,
      });

      const candles = adaptPacificaCandles(rawCandles as any);

      this.logger.log(`Fetched ${candles.length} candles from Pacifica for ${tfcSymbol}`);
      return candles;
    } catch (error) {
      this.logger.error(`Failed to fetch from Pacifica: ${error}`);
      throw error;
    }
  }
}
