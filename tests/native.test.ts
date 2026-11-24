import assert from 'node:assert/strict';
import test from 'node:test';
import { postgresConfig } from '../lib/postgres-config.ts';

test('yerel PostgreSQL bağlantısı yalnız beklenen loopback adresini kullanır', () => {
  const config = postgresConfig('a'.repeat(48));
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 55433);
  assert.equal(config.database, 'randevu');
  assert.equal(config.user, 'randevu_app');
  assert.throws(() => postgresConfig(''));
});

test('üretim HTTPS ayarında yerel PostgreSQL parolası ortamdan alınabilir', async () => {
  const { runtimeDatabaseConfig } = await import('../lib/postgres-config.ts');
  const result = await runtimeDatabaseConfig({ APPOINTMENT_DB_PASSWORD: 'b'.repeat(48), APPOINTMENT_HTTPS: '1' });
  assert.equal(result.password, 'b'.repeat(48));
  assert.equal((await runtimeDatabaseConfig({ APPOINTMENT_DB_PASSWORD: 'b'.repeat(48), APPOINTMENT_DB_PORT: '5432' })).port, 5432);
  await assert.rejects(() => runtimeDatabaseConfig({ APPOINTMENT_DB_PASSWORD: 'b'.repeat(48), APPOINTMENT_DB_PORT: '0' }));
  await assert.rejects(() => runtimeDatabaseConfig({ APPOINTMENT_HTTPS: '1' }));
});
