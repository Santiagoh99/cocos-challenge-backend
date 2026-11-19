import { Controller, Get, Query } from '@nestjs/common';
import { SearchInstrumentsQuery } from './dto/search-instruments.query.js';
import { InstrumentsService, type InstrumentSearchResult } from './instruments.service.js';

@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  search(@Query() query: SearchInstrumentsQuery): Promise<InstrumentSearchResult[]> {
    return this.instruments.search(query.search, query.limit);
  }
}
