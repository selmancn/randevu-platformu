import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { Catalog } from '../lib/catalog.ts';
import { postgresAdapter } from '../lib/postgres.ts';
import { postgresConfig, postgresPort } from '../lib/postgres-config.ts';

const local = resolve('.local');
await mkdir(local, { recursive: true });
const credentialPath = resolve(local, 'postgres-credentials.json');
const directory = resolve(local, 'postgres');
if (!existsSync(credentialPath)) {
  if (existsSync(resolve(directory, 'PG_VERSION'))) {
    throw new Error('Var olan PostgreSQL kümesinin kimlik dosyası bulunamadı.');
  }
  const credentials = { admin: randomBytes(24).toString('hex'), app: randomBytes(24).toString('hex') };
  await writeFile(credentialPath, JSON.stringify(credentials), { flag: 'wx', mode: 0o600 });
}
const credentials = JSON.parse(await readFile(credentialPath, 'utf8'));
const app = postgresConfig(credentials.app);
if (!/^[a-f0-9]{48}$/.test(credentials.admin)) throw new Error('PostgreSQL yönetici parolası geçersiz.');

const instance = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'randevu_admin',
  password: credentials.admin,
  port: postgresPort,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--auth=scram-sha-256'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message) => console.error(message),
});
const migrateOnly = process.argv.includes('--migrate-only');
if (!migrateOnly) {
  if (!existsSync(resolve(directory, 'PG_VERSION'))) await instance.initialise();
  await instance.start();
}

try {
  const cluster = instance.getPgClient('postgres', '127.0.0.1');
  await cluster.connect();
  try {
    const { rowCount } = await cluster.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [app.user]);
    if (!rowCount) await cluster.query(`CREATE ROLE randevu_app LOGIN PASSWORD '${credentials.app}'`);
    const database = await cluster.query('SELECT 1 FROM pg_database WHERE datname = $1', [app.database]);
    if (!database.rowCount) await cluster.query('CREATE DATABASE randevu');
  } finally {
    await cluster.end();
  }
  const owner = new pg.Pool({
    ...app, user: 'randevu_admin', password: credentials.admin, max: 1,
  });
  try {
    const adapter = postgresAdapter(owner);
    await new Catalog(adapter).initialize();
    await owner.query(`
      CREATE EXTENSION IF NOT EXISTS btree_gist;
      DO $constraint$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilot_no_overlapping_appointments'
                       AND conrelid = 'pilot_appointments'::regclass) THEN
          ALTER TABLE pilot_appointments ADD CONSTRAINT pilot_no_overlapping_appointments
            EXCLUDE USING gist (business_id WITH =, tstzrange(starts, ends, '[)') WITH &&)
            WHERE (status = 'confirmed');
        END IF;
      END $constraint$;
      REVOKE ALL ON DATABASE randevu FROM public;
      GRANT CONNECT ON DATABASE randevu TO randevu_app;
      REVOKE CREATE ON SCHEMA public FROM public;
      GRANT USAGE ON SCHEMA public TO randevu_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO randevu_app
    `);
    if (process.argv.includes('--import-pglite')) {
      const { importLegacy } = await import('./import-legacy.ts');
      await importLegacy(adapter, resolve(local, 'database'));
    }
  } finally {
    await owner.end();
  }
  console.log(`PostgreSQL hazır · 127.0.0.1:${postgresPort}/randevu`);
} catch (error) {
  if (!migrateOnly) await instance.stop();
  throw error;
}

async function shutdown() {
  await instance.stop();
  process.exit(0);
}
if (!migrateOnly) {
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  setInterval(() => {}, 60_000);
}
