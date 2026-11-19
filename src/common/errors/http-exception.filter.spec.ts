import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsInt, Min } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../../app.setup.js';
import { ConflictError, InvalidRequestError, NotFoundError } from './domain.errors.js';

class CreateThingDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

@Controller('probe')
class ProbeController {
  @Get('not-found')
  notFound(): never {
    throw new NotFoundError('User', 99);
  }

  @Get('invalid')
  invalid(): never {
    throw new InvalidRequestError('INSTRUMENT_NOT_TRADABLE', 'ARS cannot be traded');
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictError('ORDER_NOT_CANCELLABLE', 'Only NEW orders can be cancelled');
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection string postgres://secret leaked');
  }

  @Post('things')
  create(@Body() dto: CreateThingDto): CreateThingDto {
    return dto;
  }
}

describe('HttpExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    nestApp.useLogger(false);
    configureApp(nestApp);
    await nestApp.init();
    app = nestApp;
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps NotFoundError to 404', async () => {
    const response = await request(app.getHttpServer()).get('/probe/not-found').expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'User 99 not found',
      code: 'NOT_FOUND',
    });
  });

  it('maps InvalidRequestError to 400 with its code', async () => {
    const response = await request(app.getHttpServer()).get('/probe/invalid').expect(400);
    expect(response.body).toMatchObject({ code: 'INSTRUMENT_NOT_TRADABLE' });
  });

  it('maps ConflictError to 409', async () => {
    await request(app.getHttpServer()).get('/probe/conflict').expect(409);
  });

  it('hides internal error details', async () => {
    const response = await request(app.getHttpServer()).get('/probe/boom').expect(500);
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('keeps the same shape for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/nope').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('rejects unknown body properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe/things')
      .send({ quantity: 1, isAdmin: true })
      .expect(400);
    expect(response.body).toMatchObject({ message: ['property isAdmin should not exist'] });
  });

  it('does not coerce strings into numbers', async () => {
    await request(app.getHttpServer()).post('/probe/things').send({ quantity: '5' }).expect(400);
  });

  it('accepts a valid body', async () => {
    await request(app.getHttpServer()).post('/probe/things').send({ quantity: 5 }).expect(201);
  });

  it('rejects payloads above the size limit', async () => {
    const huge = { quantity: 1, padding: 'x'.repeat(20_000) };
    await request(app.getHttpServer()).post('/probe/things').send(huge).expect(413);
  });

  it('does not expose the framework', async () => {
    const response = await request(app.getHttpServer()).get('/nope');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
