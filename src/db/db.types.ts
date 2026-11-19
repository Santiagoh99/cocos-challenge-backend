import type { QueryResultRow } from 'pg';

export interface Queryable {
  query<Row extends QueryResultRow>(text: string, params?: readonly unknown[]): Promise<Row[]>;
}
