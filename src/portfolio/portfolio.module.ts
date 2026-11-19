import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  imports: [DbModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioRepository],
})
export class PortfolioModule {}
