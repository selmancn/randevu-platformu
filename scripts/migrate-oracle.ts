import pg from 'pg';
import { Catalog } from '../lib/catalog.ts';
import { postgresAdapter } from '../lib/postgres.ts';
import { postgresConfig } from '../lib/postgres-config.ts';

const pool = new pg.Pool({
  ...postgresConfig(process.env.APPOINTMENT_MIGRATOR_PASSWORD ?? '', 5432),
  user: 'randevu_migrate',
  max: 1,
});
try {
  await new Catalog(postgresAdapter(pool)).initialize();
  await pool.query(`
    DO $constraint$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilot_no_overlapping_appointments'
          AND conrelid='pilot_appointments'::regclass) THEN
        ALTER TABLE pilot_appointments ADD CONSTRAINT pilot_no_overlapping_appointments
          EXCLUDE USING gist (business_id WITH =, tstzrange(starts,ends,'[)') WITH &&)
          WHERE (status='confirmed');
      END IF;
    END $constraint$;
    GRANT USAGE ON SCHEMA public TO randevu_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO randevu_app;
  `);
} finally {
  await pool.end();
}
