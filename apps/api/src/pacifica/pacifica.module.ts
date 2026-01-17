import { Module, Global } from '@nestjs/common';
import { PacificaService } from './pacifica.service.js';
import { PacificaSigningService } from './pacifica-signing.service.js';

@Global()
@Module({
  providers: [PacificaService, PacificaSigningService],
  exports: [PacificaService, PacificaSigningService],
})
export class PacificaModule {}
