import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { Catalog } from '../lib/catalog.ts';
import { postgresAdapter } from '../lib/postgres.ts';
import { postgresConfig } from '../lib/postgres-config.ts';

const tables = [
  'pilot_businesses', 'pilot_services', 'pilot_hours', 'pilot_appointments',
  'pilot_finance', 'pilot_chat_settings', 'pilot_messages', 'pilot_reviews',
  'pilot_customers',
] as const;
const local = resolve('.local');
const keyPath = resolve(local, 'backup.key');
const credentials = JSON.parse(await readFile(resolve(local, 'postgres-credentials.json'), 'utf8'));
const config = { ...postgresConfig(credentials.app), user: 'randevu_admin', password: credentials.admin };
const [command, path] = process.argv.slice(2);

if (command === 'create') {
  await mkdir(resolve(local, 'backups'), { recursive: true });
  try {
    await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  }
  const key = await readFile(keyPath);
  const pool = new pg.Pool(config);
  try {
    const snapshot = await postgresAdapter(pool).transaction(async ({ query }) => {
      await query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const data: Record<string, string> = {};
      for (const table of tables) {
        const { rows } = await query<{ entries: string }>(
          `SELECT coalesce(json_agg(r)::text, '[]') AS entries FROM ${table} r`,
        );
        data[table] = rows[0].entries;
      }
      return { version: 1, data };
    });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = Buffer.concat([cipher.update(JSON.stringify(snapshot), 'utf8'), cipher.final()]);
    const file = resolve(local, 'backups', `randevu-${Date.now()}.bin`);
    await writeFile(file, Buffer.concat([iv, cipher.getAuthTag(), payload]), { flag: 'wx', mode: 0o600 });
    console.log(file);
  } finally {
    await pool.end();
  }
} else if (command === 'verify' && path) {
  const snapshot = await readFile(path);
  const key = await readFile(keyPath);
  const decipher = createDecipheriv('aes-256-gcm', key, snapshot.subarray(0, 12));
  decipher.setAuthTag(snapshot.subarray(12, 28));
  const { version, data } = JSON.parse(Buffer.concat([
    decipher.update(snapshot.subarray(28)), decipher.final(),
  ]).toString('utf8'));
  if (version !== 1) throw new Error('Desteklenmeyen yedek sürümü.');
  const pool = new pg.Pool(config);
  const schema = `restore_check_${randomBytes(8).toString('hex')}`;
  try {
    await postgresAdapter(pool).transaction(async (tx) => {
      await tx.query(`CREATE SCHEMA ${schema}`);
      await tx.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
      await new Catalog({
        query: tx.query,
        exec: tx.query,
        transaction: (callback) => callback(tx),
      }).initialize();
      for (const table of tables) {
        const entries = JSON.parse(data[table] ?? '[]');
        if (table === 'pilot_services') {
          for (const entry of entries) entry.active ??= true;
        }
        if (table === 'pilot_businesses') {
          for (const entry of entries) entry.category ??= 'diger';
        }
        await tx.query(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table}, $1)`, [JSON.stringify(entries)]);
        const { rows } = await tx.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`);
        if (rows[0].count !== entries.length) throw new Error(`Kayıt sayısı uyuşmuyor: ${table}`);
      }
      await tx.query(`DROP SCHEMA ${schema} CASCADE`);
    });
    console.log(`Yedek doğrulandı. Geçici şemaya geri yüklenen ${tables.length} tablonun kayıt sayıları eşleşti.`);
  } finally {
    await pool.end();
  }
} else {
  throw new Error('Kullanım: npm run db:backup -- create veya npm run db:backup -- verify <dosya>');
}
