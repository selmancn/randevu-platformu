import { existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { postgresAdapter } from '../lib/postgres.ts';

export async function importLegacy(target: ReturnType<typeof postgresAdapter>, directory: string) {
  if (!existsSync(directory)) return;
  const source = new PGlite(directory);
  try {
    await target.transaction(async (tx) => {
      for (const [table, fields] of [
        ['pilot_businesses', ['id', 'slug', 'name', 'district', 'email', 'salt', 'password_hash']],
        ['pilot_services', ['id', 'business_id', 'name', 'price', 'duration', 'created_at']],
      ] as const) {
        const { rows } = await source.query<Record<string, unknown>>(`SELECT ${fields.join(', ')} FROM ${table}`);
        let inserted = 0;
        for (const row of rows) {
          const values = fields.map((field) => row[field]);
          const params = fields.map((_, index) => `$${index + 1}`).join(', ');
          const result = await tx.query(`
            INSERT INTO ${table} (${fields.join(', ')}) VALUES (${params})
            ON CONFLICT (id) DO NOTHING RETURNING id
          `, values);
          inserted += result.rows.length;
        }
        console.log(`${table}: ${inserted}/${rows.length} kayıt aktarıldı.`);
      }
    });
  } finally {
    await source.close();
  }
}
