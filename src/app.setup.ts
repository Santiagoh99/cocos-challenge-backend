import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';

export function configureApp(app: NestExpressApplication): void {
  app.disable('x-powered-by');
  app.use(helmet());
  app.useBodyParser('json', { limit: '10kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();
}
