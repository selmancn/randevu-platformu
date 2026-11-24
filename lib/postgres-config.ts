import { readFile } from 'node:fs/promises';

export const postgresPort = 55433;

export function postgresConfig(password: string, port = postgresPort) {
  if (!/^[a-f0-9]{48}$/.test(password)) throw new Error('Yerel PostgreSQL uygulama parolası geçersiz.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PostgreSQL bağlantı noktası geçersiz.');
  return {
    host: '127.0.0.1',
    port,
    database: 'randevu',
    user: 'randevu_app',
    password,
    connectionTimeoutMillis: 5000,
  };
}

export async function runtimeDatabaseConfig(env: Record<string, string | undefined> = process.env) {
  if (env.APPOINTMENT_DB_PASSWORD) {
    return postgresConfig(env.APPOINTMENT_DB_PASSWORD, env.APPOINTMENT_DB_PORT ? Number(env.APPOINTMENT_DB_PORT) : postgresPort);
  }
  if (env.APPOINTMENT_HTTPS === '1') throw new Error('HTTPS çalışma kipinde uygulama veritabanı parolası ortamdan alınmalı.');
  const { app } = JSON.parse(await readFile('.local/postgres-credentials.json', 'utf8'));
  return postgresConfig(app);
}
