import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`Listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
