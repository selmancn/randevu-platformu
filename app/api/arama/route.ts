import { categorySuggestions } from '../../../lib/discovery';
import { getCatalog } from '../../../lib/database';
import { foldSearch } from '../../../lib/locations';

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  const categories = categorySuggestions(query).slice(0, 5).map(({ label }) => label);
  const services = query.length < 2 ? [] : await (await getCatalog()).suggestions(query);
  const values = new Map([...categories, ...services].map((label) => [foldSearch(label), label]));
  return Response.json([...values.values()].slice(0, 8), { headers: { 'Cache-Control': 'public, max-age=30' } });
}
