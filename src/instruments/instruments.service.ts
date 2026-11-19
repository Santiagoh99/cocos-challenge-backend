import { Injectable } from '@nestjs/common';
import { formatMoney, formatPercent, money } from '../common/money.js';
import { dailyReturn } from '../common/quote.js';
import { InstrumentsRepository, type InstrumentSearchRow } from './instruments.repository.js';

export interface InstrumentSearchResult {
  id: number;
  ticker: string;
  name: string;
  type: string;
  lastPrice: string | null;
  dailyReturnPercent: string | null;
  priceDate: string | null;
}

@Injectable()
export class InstrumentsService {
  constructor(private readonly repository: InstrumentsRepository) {}

  async search(term: string, limit: number): Promise<InstrumentSearchResult[]> {
    const rows = await this.repository.search(term, limit);
    return rows.map(toResult);
  }
}

function toResult(row: InstrumentSearchRow): InstrumentSearchResult {
  const quote =
    row.close === null || row.previousclose === null
      ? null
      : { close: money(row.close), previousClose: money(row.previousclose) };
  const dailyRatio = quote === null ? null : dailyReturn(quote);

  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    type: row.type,
    lastPrice: quote === null ? null : formatMoney(quote.close),
    dailyReturnPercent: dailyRatio === null ? null : formatPercent(dailyRatio),
    priceDate: row.price_date,
  };
}
