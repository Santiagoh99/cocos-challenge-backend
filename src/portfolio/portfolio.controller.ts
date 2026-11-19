import { Controller, Get, Param } from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { PortfolioService, type PortfolioResponse } from './portfolio.service.js';

@Controller('users/:userId/portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  get(@Param('userId', ParseIdPipe) userId: number): Promise<PortfolioResponse> {
    return this.portfolio.getPortfolio(userId);
  }
}
