import { readFile } from 'node:fs/promises';
import { getCatalog } from '../../../lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await (await getCatalog()).db.query('SELECT 1 FROM pilot_businesses LIMIT 1');
    const revision = (await readFile('.revision', 'utf8').catch(() => '')).trim();
    return Response.json(/^[0-9a-f]{40}$/.test(revision) ? { status: 'ready', revision } : { status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
