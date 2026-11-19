import { Injectable } from '@nestjs/common';
import { containsPattern } from '../common/sql.js';
import { DbService } from '../db/db.service.js';

export interface InstrumentSearchRow {
  id: number;
  ticker: string;
  name: string;
  type: string;
  close: string | null;
  previousclose: string | null;
  price_date: string | null;
}

const SEARCH_SQL = `
  SELECT i.id, i.ticker, i.name, i.type,
         md.close, md.previousclose, to_char(md.date, 'YYYY-MM-DD') AS price_date
  FROM instruments i
  LEFT JOIN LATERAL (
    SELECT m.close, m.previousclose, m.date
    FROM marketdata m
    WHERE m.instrumentid = i.id
    ORDER BY m.date DESC
    LIMIT 1
  ) md ON true
  WHERE i.type <> 'MONEDA'
    AND (i.ticker ILIKE $1 ESCAPE '\\' OR i.name ILIKE $1 ESCAPE '\\')
  ORDER BY
    CASE
      WHEN upper(i.ticker) = upper($2) THEN 0
      WHEN i.ticker ILIKE $3 ESCAPE '\\' THEN 1
      ELSE 2
    END,
    i.ticker
  LIMIT $4
`;

@Injectable()
export class InstrumentsRepository {
  constructor(private readonly db: DbService) {}

  search(term: string, limit: number): Promise<InstrumentSearchRow[]> {
    const contains = containsPattern(term);
    const startsWith = contains.slice(1);
    return this.db.query<InstrumentSearchRow>(SEARCH_SQL, [contains, term, startsWith, limit]);
  }
}
