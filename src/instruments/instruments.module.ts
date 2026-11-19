import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { InstrumentsController } from './instruments.controller.js';
import { InstrumentsRepository } from './instruments.repository.js';
import { InstrumentsService } from './instruments.service.js';

@Module({
  imports: [DbModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService, InstrumentsRepository],
})
export class InstrumentsModule {}
