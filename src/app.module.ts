import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { DbModule } from './db/db.module.js';
import { InstrumentsModule } from './instruments/instruments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DbModule,
    InstrumentsModule,
  ],
})
export class AppModule {}
