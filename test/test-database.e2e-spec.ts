import { testDatabaseUrl } from './helpers/test-database.js';

describe('test database guard', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = original;
  });

  it('accepts a local database ending in _test', () => {
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/cocos_test';
    expect(testDatabaseUrl().pathname).toBe('/cocos_test');
  });

  it('refuses the development database', () => {
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/cocos';
    expect(() => testDatabaseUrl()).toThrow('must end with _test');
  });

  it('refuses remote hosts even if the name looks like a test database', () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-example.neon.tech/neondb_test?sslmode=require';
    expect(() => testDatabaseUrl()).toThrow('tests only run locally');
  });
});
