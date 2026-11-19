import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers/create-app.js';

interface SearchResult {
  id: number;
  ticker: string;
  name: string;
  lastPrice: string | null;
  dailyReturnPercent: string | null;
}

describe('GET /instruments', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const search = async (query: Record<string, string>): Promise<SearchResult[]> => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query(query)
      .expect(200);
    return response.body as SearchResult[];
  };

  it('finds by ticker with last price and daily return', async () => {
    expect(await search({ search: 'pamp' })).toEqual([
      expect.objectContaining({
        ticker: 'PAMP',
        name: 'Pampa Holding S.A.',
        lastPrice: '925.85',
        dailyReturnPercent: '0.44',
        priceDate: '2023-07-14',
      }),
    ]);
  });

  it('finds by name, case insensitive', async () => {
    const tickers = (await search({ search: 'BANCO' })).map((r) => r.ticker);
    expect(tickers).toEqual(['BBAR', 'BHIP', 'BMA', 'BPAT']);
  });

  it('ranks an exact ticker match first', async () => {
    const [first] = await search({ search: 'bma' });
    expect(first?.ticker).toBe('BMA');
  });

  it('returns instruments without market data with null prices', async () => {
    expect(await search({ search: 'PGR' })).toEqual([
      expect.objectContaining({ ticker: 'PGR', lastPrice: null, dailyReturnPercent: null }),
    ]);
  });

  it('never returns the ARS currency', async () => {
    expect(await search({ search: 'ARS' })).toEqual([]);
  });

  it('treats LIKE wildcards as literal characters', async () => {
    expect(await search({ search: '%' })).toEqual([]);
    expect(await search({ search: '_' })).toEqual([]);
  });

  it('honours the limit', async () => {
    expect(await search({ search: 'a', limit: '3' })).toHaveLength(3);
  });

  it.each([
    [{}],
    [{ search: '' }],
    [{ search: '   ' }],
    [{ search: 'a'.repeat(51) }],
    [{ search: 'x', limit: '0' }],
    [{ search: 'x', limit: '51' }],
    [{ search: 'x', unknown: '1' }],
  ])('rejects invalid query %j', async (query) => {
    await request(app.getHttpServer()).get('/instruments').query(query).expect(400);
  });
});
