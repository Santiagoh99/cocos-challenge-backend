import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers/create-app.js';
import { queryTestDatabase, resetDatabase } from './helpers/test-database.js';

const USER = 1;
const EMPTY_USER = 2;
const PAMP = 47;
const METR = 54;
const BMA = 31;
const LOMA = 45;
const PGR_WITHOUT_PRICE = 3;
const ARS = 66;
const PAMP_CLOSE = '925.85';

interface OrderBody {
  id: number;
  userId: number;
  instrumentId: number;
  side: string;
  type: string;
  status: string;
  size: number;
  price: string;
  createdAt: string;
  rejectionReason: string | null;
}

interface PortfolioBody {
  cash: string;
  reservedCash: string;
  availableCash: string;
  positions: { ticker: string; quantity: number; availableQuantity: number }[];
}

interface StoredOrder {
  id: number;
  userid: number;
  instrumentid: number;
  side: string;
  type: string;
  status: string;
  size: number;
  price: string;
}

describe('Orders', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  const placeOrder = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/orders').send(body);

  const placed = async (body: Record<string, unknown>): Promise<OrderBody> => {
    const response = await placeOrder(body).expect(201);
    return response.body as OrderBody;
  };

  const cancel = (orderId: number | string, userId: number) =>
    request(app.getHttpServer()).patch(`/orders/${orderId}/cancel`).send({ userId });

  const portfolio = async (userId = USER): Promise<PortfolioBody> => {
    const response = await request(app.getHttpServer())
      .get(`/users/${userId}/portfolio`)
      .expect(200);
    return response.body as PortfolioBody;
  };

  const storedOrder = async (id: number): Promise<StoredOrder | undefined> => {
    const [row] = await queryTestDatabase<StoredOrder>(
      'SELECT id, userid, instrumentid, side, type, status, size, price FROM orders WHERE id = $1',
      [id],
    );
    return row;
  };

  const orderCount = async (): Promise<number> => {
    const [row] = await queryTestDatabase<{ count: string }>('SELECT count(*) FROM orders');
    return Number(row?.count);
  };

  const quantityOf = (body: PortfolioBody, ticker: string) =>
    body.positions.find((position) => position.ticker === ticker);

  describe('MARKET orders', () => {
    it('fills a buy at the last close and persists it', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
      });

      expect(order).toMatchObject({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        status: 'FILLED',
        size: 10,
        price: PAMP_CLOSE,
        rejectionReason: null,
      });
      expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
      expect(await storedOrder(order.id)).toMatchObject({
        userid: USER,
        instrumentid: PAMP,
        side: 'BUY',
        type: 'MARKET',
        status: 'FILLED',
        size: 10,
        price: PAMP_CLOSE,
      });
    });

    it('updates cash and positions once filled', async () => {
      await placed({ userId: USER, instrumentId: PAMP, side: 'BUY', type: 'MARKET', size: 10 });
      await placed({ userId: USER, instrumentId: METR, side: 'SELL', type: 'MARKET', size: 100 });

      const after = await portfolio();
      expect(after.cash).toBe('766691.50');
      expect(quantityOf(after, 'PAMP')?.quantity).toBe(50);
      expect(quantityOf(after, 'METR')?.quantity).toBe(400);
    });

    it('buys the maximum whole number of shares for an amount', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        amount: 10000,
      });

      expect(order).toMatchObject({ status: 'FILLED', size: 10, price: PAMP_CLOSE });
    });

    it('rejects an amount that does not reach a single share', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        amount: 925.84,
      });

      expect(order).toMatchObject({
        status: 'REJECTED',
        size: 0,
        rejectionReason: 'AMOUNT_BELOW_PRICE',
      });
    });

    it('rejects a buy above the available cash and stores it as REJECTED', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        size: 1000,
      });

      expect(order).toMatchObject({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_FUNDS' });
      expect((await storedOrder(order.id))?.status).toBe('REJECTED');
      expect((await portfolio()).cash).toBe('753000.00');
    });

    it('counts cash reserved by pending LIMIT buys as unavailable', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        amount: 700000,
      });

      expect(order.size).toBe(756);
      expect(order).toMatchObject({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_FUNDS' });
    });

    it('rejects a user without cash', async () => {
      const order = await placed({
        userId: EMPTY_USER,
        instrumentId: PAMP,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      });

      expect(order.rejectionReason).toBe('INSUFFICIENT_FUNDS');
    });

    it('rejects selling more shares than the user holds', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: METR,
        side: 'SELL',
        type: 'MARKET',
        size: 501,
      });

      expect(order).toMatchObject({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_SHARES' });
      expect(quantityOf(await portfolio(), 'METR')?.quantity).toBe(500);
    });

    it('rejects selling from the oversold BMA position', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: BMA,
        side: 'SELL',
        type: 'MARKET',
        size: 1,
      });

      expect(order.rejectionReason).toBe('INSUFFICIENT_SHARES');
    });

    it('refuses instruments without market data', async () => {
      const response = await placeOrder({
        userId: USER,
        instrumentId: PGR_WITHOUT_PRICE,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      }).expect(400);

      expect(response.body).toMatchObject({ code: 'NO_MARKET_PRICE' });
    });
  });

  describe('LIMIT orders', () => {
    it('stays NEW at the requested price and reserves cash', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: LOMA,
        side: 'BUY',
        type: 'LIMIT',
        size: 100,
        price: 700.5,
      });

      expect(order).toMatchObject({ status: 'NEW', size: 100, price: '700.50' });
      const after = await portfolio();
      expect(after.cash).toBe('753000.00');
      expect(after.reservedCash).toBe('195550.00');
      expect(after.availableCash).toBe('557450.00');
    });

    it('rejects a LIMIT buy that exceeds what is left after reservations', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: LOMA,
        side: 'BUY',
        type: 'LIMIT',
        size: 1000,
        price: 700,
      });

      expect(order).toMatchObject({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_FUNDS' });
    });

    it('reserves shares on a LIMIT sell', async () => {
      await placed({
        userId: USER,
        instrumentId: METR,
        side: 'SELL',
        type: 'LIMIT',
        size: 300,
        price: 300,
      });

      expect(quantityOf(await portfolio(), 'METR')).toMatchObject({
        quantity: 500,
        availableQuantity: 200,
      });

      const tooMany = await placed({
        userId: USER,
        instrumentId: METR,
        side: 'SELL',
        type: 'MARKET',
        size: 201,
      });
      expect(tooMany.rejectionReason).toBe('INSUFFICIENT_SHARES');
    });

    it('can be sent for instruments without market data', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: PGR_WITHOUT_PRICE,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        price: 5,
      });

      expect(order.status).toBe('NEW');
    });

    it('sizes an amount with the limit price', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: LOMA,
        side: 'BUY',
        type: 'LIMIT',
        amount: 1000,
        price: 300,
      });

      expect(order.size).toBe(3);
    });
  });

  describe('invalid requests', () => {
    const base = { userId: USER, instrumentId: PAMP, side: 'BUY', type: 'MARKET' };

    it.each([
      ['LIMIT without price', { ...base, type: 'LIMIT', size: 1 }, 'PRICE_REQUIRED'],
      ['MARKET with price', { ...base, size: 1, price: 900 }, 'PRICE_NOT_ALLOWED'],
      ['size and amount', { ...base, size: 1, amount: 1000 }, 'SIZE_OR_AMOUNT'],
      ['neither size nor amount', base, 'SIZE_OR_AMOUNT'],
      ['the ARS currency', { ...base, instrumentId: ARS, size: 1 }, 'INSTRUMENT_NOT_TRADABLE'],
    ])('rejects %s with 400 without storing it', async (_label, body, code) => {
      const before = await orderCount();

      const response = await placeOrder(body).expect(400);

      expect(response.body).toMatchObject({ code });
      expect(await orderCount()).toBe(before);
    });

    it.each([
      ['unknown user', { ...base, userId: 999, size: 1 }],
      ['unknown instrument', { ...base, instrumentId: 999, size: 1 }],
    ])('returns 404 for %s', async (_label, body) => {
      const response = await placeOrder(body).expect(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it.each([
      ['a cash side', { ...base, side: 'CASH_IN', size: 1 }],
      ['an unknown type', { ...base, type: 'STOP', size: 1 }],
      ['size as a string', { ...base, size: '5' }],
      ['a fractional size', { ...base, size: 1.5 }],
      ['a zero size', { ...base, size: 0 }],
      ['a negative amount', { ...base, amount: -100 }],
      ['a price with three decimals', { ...base, type: 'LIMIT', size: 1, price: 1.234 }],
      [
        'a price that does not fit NUMERIC(10,2)',
        { ...base, type: 'LIMIT', size: 1, price: 100000000 },
      ],
      ['a status sent by the client', { ...base, size: 1, status: 'FILLED' }],
      ['a missing userId', { instrumentId: PAMP, side: 'BUY', type: 'MARKET', size: 1 }],
    ])('rejects %s in validation', async (_label, body) => {
      await placeOrder(body).expect(400);
    });
  });

  describe('cancellation', () => {
    const SEEDED_NEW_LOMA_ORDER = 5;
    const SEEDED_FILLED_ORDER = 2;

    it('cancels a NEW order and releases its reservation', async () => {
      const response = await cancel(SEEDED_NEW_LOMA_ORDER, USER).expect(200);

      expect(response.body).toMatchObject({ id: SEEDED_NEW_LOMA_ORDER, status: 'CANCELLED' });
      expect((await storedOrder(SEEDED_NEW_LOMA_ORDER))?.status).toBe('CANCELLED');
      expect((await portfolio()).availableCash).toBe('663000.00');
    });

    it('does not cancel an order twice', async () => {
      await cancel(SEEDED_NEW_LOMA_ORDER, USER).expect(200);
      const response = await cancel(SEEDED_NEW_LOMA_ORDER, USER).expect(409);

      expect(response.body).toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    });

    it('does not cancel a FILLED order', async () => {
      const response = await cancel(SEEDED_FILLED_ORDER, USER).expect(409);

      expect(response.body).toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
      expect((await storedOrder(SEEDED_FILLED_ORDER))?.status).toBe('FILLED');
    });

    it("hides other users' orders", async () => {
      await cancel(SEEDED_NEW_LOMA_ORDER, EMPTY_USER).expect(404);
      expect((await storedOrder(SEEDED_NEW_LOMA_ORDER))?.status).toBe('NEW');
    });

    it('returns 404 for an unknown order and 400 for an invalid id', async () => {
      await cancel(9999, USER).expect(404);
      await cancel('abc', USER).expect(400);
    });

    it('cancels an order created through the API', async () => {
      const order = await placed({
        userId: USER,
        instrumentId: LOMA,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        price: 1,
      });

      await cancel(order.id, USER).expect(200);
    });
  });

  describe('concurrency', () => {
    it('never spends the same cash twice', async () => {
      const body = { userId: USER, instrumentId: PAMP, side: 'BUY', type: 'MARKET', size: 400 };

      const responses = await Promise.all(Array.from({ length: 10 }, () => placeOrder(body)));
      const statuses = responses.map((response) => (response.body as OrderBody).status);

      expect(statuses.filter((status) => status === 'FILLED')).toHaveLength(1);
      expect(statuses.filter((status) => status === 'REJECTED')).toHaveLength(9);
      expect((await portfolio()).cash).toBe('382660.00');
    });

    it('never sells the same shares twice', async () => {
      const body = { userId: USER, instrumentId: METR, side: 'SELL', type: 'MARKET', size: 300 };

      const responses = await Promise.all(Array.from({ length: 5 }, () => placeOrder(body)));
      const filled = responses.filter(
        (response) => (response.body as OrderBody).status === 'FILLED',
      );

      expect(filled).toHaveLength(1);
      expect(quantityOf(await portfolio(), 'METR')?.quantity).toBe(200);
    });

    it('cancels an order only once under concurrent requests', async () => {
      const responses = await Promise.all([cancel(5, USER), cancel(5, USER)]);

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    });
  });
});
