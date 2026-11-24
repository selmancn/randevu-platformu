import { foldSearch, locationFilter } from './locations.ts';

export const categories = {
  berber: 'Berber ve kuaför',
  dovme: 'Dövme stüdyosu',
  oto: 'Oto servis',
  diger: 'Diğer hizmetler',
} as const;
export type Category = keyof typeof categories;
const aliases = [
  { label: 'Berber', category: 'berber' }, { label: 'Kuaför', category: 'berber' },
  { label: 'Berber ve kuaför', category: 'berber' }, { label: 'Dövme', category: 'dovme' },
  { label: 'Dövme stüdyosu', category: 'dovme' }, { label: 'Oto servis', category: 'oto' },
  { label: 'Araba tamircisi', category: 'oto' },
] as const;
export const categorySuggestions = (query: string) => aliases.filter((item) => foldSearch(item.label).includes(foldSearch(query)));
export const searchCategory = (query: string) => aliases.find((item) => foldSearch(item.label) === foldSearch(query))?.category ?? null;
const sorts = ['onerilen', 'puan', 'fiyat-artan', 'fiyat-azalan'] as const;
type Params = Record<string, unknown>;

export function discoveryFilters(params: Params) {
  const get = (key: string) => typeof params[key] === 'string' ? params[key].trim().slice(0, 80) : '';
  const category = get('kategori');
  const sort = get('sirala');
  const price = get('fiyat');
  const page = get('sayfa');
  const [whole, cents = ''] = price.split(/[,.]/);
  return {
    query: get('q'),
    ...locationFilter(get('il'), get('ilce')),
    category: Object.hasOwn(categories, category) ? category as Category : '',
    sort: sorts.find((entry) => entry === sort) ?? 'onerilen',
    maxPrice: /^\d{1,7}(?:[,.]\d{1,2})?$/.test(price) ? Number(whole) * 100 + Number(cents.padEnd(2, '0')) : null,
    located: get('konum') === '1',
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  } as const;
}

export function directionsUrl(lat: number | null, lon: number | null) {
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1', destination: `${lat},${lon}` });
}

export function coverFor(category: string) {
  return `/kapaklar/${Object.hasOwn(categories, category) ? category : 'diger'}.webp`;
}
