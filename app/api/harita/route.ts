import { getCatalog } from '../../../lib/database';
import { discoveryFilters } from '../../../lib/discovery';
import { readMapBounds } from '../../../lib/map-region';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const bounds = readMapBounds(params);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!bounds) return Response.json({ error: 'Geçerli bir harita alanı gerekli.' }, { status: 400, headers });
  const filters = discoveryFilters({ q: params.get('q'), kategori: params.get('kategori'),
    fiyat: params.get('fiyat'), sirala: params.get('sirala') });
  const listings = await (await getCatalog()).discover(filters, 'list', undefined, bounds);
  return Response.json({ listings, total: listings[0]?.total ?? 0 }, { headers });
}
