import { getCatalog } from '../../../lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await (await getCatalog()).db.query('SELECT 1 FROM pilot_businesses LIMIT 1');
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
