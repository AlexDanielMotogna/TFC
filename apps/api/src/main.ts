import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module.js';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

async function bootstrap() {
  const logger = createLogger({ service: 'api' });

  // Initialize Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    });
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.API_PORT || 3000;
  const host = process.env.API_HOST || 'localhost';

  await app.listen(port, host);

  logger.info(LOG_EVENTS.AUTH_CONNECT_START, `API server started`, {
    port,
    host,
    env: process.env.NODE_ENV,
  });
}

bootstrap();
