import type { Pool } from 'pg';

export function postgresAdapter(pool: Pool) {
  return {
    exec: (sql: string) => pool.query(sql),
    query: <Row extends Record<string, unknown>>(sql: string, params?: unknown[]) => pool.query<Row>(sql, params),
    async transaction<T>(operation: (tx: {
      query: <Row extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
    }) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await operation({
          query: (sql, params) => client.query(sql, params),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
