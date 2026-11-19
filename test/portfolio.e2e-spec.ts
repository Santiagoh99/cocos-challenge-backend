import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers/create-app.js';

describe('GET /users/:userId/portfolio', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns user 1 portfolio built from the seeded orders', async () => {
    const response = await request(app.getHttpServer()).get('/users/1/portfolio').expect(200);

    expect(response.body).toEqual({
      userId: 1,
      totalValue: '889756.00',
      cash: '753000.00',
      reservedCash: '125500.00',
      availableCash: '627500.00',
      positions: [
        {
          instrumentId: 31,
          ticker: 'BMA',
          name: 'Banco Macro S.A.',
          quantity: -10,
          availableQuantity: -10,
          averageCost: null,
          lastPrice: '1502.80',
          marketValue: '-15028.00',
          totalReturnPercent: null,
          dailyReturnPercent: '-1.15',
        },
        {
          instrumentId: 54,
          ticker: 'METR',
          name: 'MetroGAS S.A.',
          quantity: 500,
          availableQuantity: 500,
          averageCost: '250.00',
          lastPrice: '229.50',
          marketValue: '114750.00',
          totalReturnPercent: '-8.20',
          dailyReturnPercent: '-1.08',
        },
        {
          instrumentId: 47,
          ticker: 'PAMP',
          name: 'Pampa Holding S.A.',
          quantity: 40,
          availableQuantity: 40,
          averageCost: '930.00',
          lastPrice: '925.85',
          marketValue: '37034.00',
          totalReturnPercent: '-0.45',
          dailyReturnPercent: '0.44',
        },
      ],
    });
  });

  it('returns an empty portfolio for a user without orders', async () => {
    const response = await request(app.getHttpServer()).get('/users/2/portfolio').expect(200);

    expect(response.body).toEqual({
      userId: 2,
      totalValue: '0.00',
      cash: '0.00',
      reservedCash: '0.00',
      availableCash: '0.00',
      positions: [],
    });
  });

  it('returns 404 for an unknown user', async () => {
    const response = await request(app.getHttpServer()).get('/users/999/portfolio').expect(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('returns 400 for user id %j', async (id) => {
    await request(app.getHttpServer()).get(`/users/${id}/portfolio`).expect(400);
  });
});
