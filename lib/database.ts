import pg from 'pg';
import { Catalog } from './catalog';
import { runtimeDatabaseConfig } from './postgres-config';
import { postgresAdapter } from './postgres';

const runtime = globalThis as typeof globalThis & { appointmentCatalog?: Promise<Catalog> };

export function getCatalog() {
  runtime.appointmentCatalog ??= openCatalog().catch((error: unknown) => {
    delete runtime.appointmentCatalog;
    throw error;
  });
  return runtime.appointmentCatalog;
}

async function openCatalog() {
  const pool = new pg.Pool({ ...await runtimeDatabaseConfig(), max: 10, idleTimeoutMillis: 30_000 });
  pool.on('error', (error) => console.error('PostgreSQL bağlantı hatası', error.name));
  return new Catalog(postgresAdapter(pool));
}
