import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowLeft, ArrowRight, MapPin, SlidersHorizontal } from 'lucide-react';
import { getCatalog } from '../../lib/database';
import { categories, discoveryFilters } from '../../lib/discovery';
import { districts, provinces } from '../../lib/locations';
import { areaTarget, turkeyCenter } from '../../lib/map-centers';
import { LocationFields } from '../location-fields';
import { DiscoveryResults } from './results';
import { DiscoverySearch } from './search';
import { Spotlight } from './spotlight';
import { CustomerAccess } from '../customer-access';
import './discover.css';

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const filters = discoveryFilters(await searchParams);
  const catalog = await getCatalog();
  const visitor = (await cookies()).get('randevu_ziyaretci')?.value;
  const showSpotlights = !filters.query && !filters.category && filters.page === 1 && filters.maxPrice === null;
  const [listings, popular, personal] = await Promise.all([
    catalog.discover(filters),
    showSpotlights ? catalog.discover(filters, 'popular') : [],
    showSpotlights ? catalog.discover(filters, 'personal', visitor) : [],
  ]);
  const place = districts.find((item) => item.id === filters.districtId)?.name ??
    provinces.find((item) => item.id === filters.provinceId)?.name;
  const initial = new URLSearchParams();
  if (filters.query) initial.set('q', filters.query);
  if (filters.provinceId) initial.set('il', String(filters.provinceId));
  if (filters.districtId) initial.set('ilce', String(filters.districtId));
  if (filters.category) initial.set('kategori', filters.category);
  if (filters.maxPrice !== null) initial.set('fiyat', String(filters.maxPrice / 100));
  if (filters.sort !== 'onerilen') initial.set('sirala', filters.sort);
  if (filters.located) initial.set('konum', '1');
  function withQuery(update: Record<string, string>) {
    const params = new URLSearchParams(initial);
    for (const [key, value] of Object.entries(update)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return params.size ? `/kesfet?${params}` : '/kesfet';
  }
  const total = listings[0]?.total ?? 0;
  const mapTarget = areaTarget(filters.provinceId, filters.districtId) ?? turkeyCenter;
  const mapFilters = new URLSearchParams(initial);
  for (const field of ['il', 'ilce', 'konum']) mapFilters.delete(field);
  return <main className="wrap page discovery">
    <header className="discover-heading">
      <CustomerAccess />
      <p className="overline"><MapPin size={16} aria-hidden="true" /> Yerel hizmetler</p>
      <h1>Yakınındaki işletmeleri keşfet</h1>
    </header>
    <form action="/kesfet" method="get" className="card discovery-search" key={initial.toString()}>
      {filters.category && <input type="hidden" name="kategori" value={filters.category} />}
      <DiscoverySearch initial={filters.query} />
      <LocationFields provinceName="il" districtName="ilce" initialProvince={filters.provinceId} initialDistrict={filters.districtId} />
      <label>En yüksek başlangıç fiyatı
        <input name="fiyat" placeholder="₺" inputMode="decimal" defaultValue={filters.maxPrice === null ? '' : filters.maxPrice / 100}
          pattern="[0-9]{1,7}([,.][0-9]{1,2})?" maxLength={10} />
      </label>
      <label>Sırala<select name="sirala" defaultValue={filters.sort}>
        <option value="onerilen">Önerilen</option><option value="puan">En yüksek puan</option>
        <option value="fiyat-artan">En düşük fiyat</option><option value="fiyat-azalan">En yüksek fiyat</option>
      </select></label>
      <button className="icon-link"><SlidersHorizontal size={17} aria-hidden="true" /> Uygula</button>
      <label className="map-filter"><input name="konum" type="checkbox" value="1" defaultChecked={filters.located} /> Yalnızca haritada konumu olanlar</label>
    </form>
    <nav className="category-bar" aria-label="Hizmet kategorileri">
      <Link href={withQuery({ kategori: '' })} aria-current={!filters.category ? 'page' : undefined}>Tümü</Link>
      {Object.entries(categories).map(([key, label]) => (
        <Link key={key} href={withQuery({ kategori: key })} aria-current={filters.category === key ? 'page' : undefined}>{label}</Link>
      ))}
      {initial.size > 0 && <Link className="clear-filters" href="/kesfet">Filtreleri temizle</Link>}
    </nav>
    <Spotlight items={personal} title="Sana özel öneriler" />
    <Spotlight items={popular} title={place ? `${place} bölgesinde popüler` : 'Türkiye genelinde popüler'} popular />
    <DiscoveryResults key={initial.toString() + ':' + filters.page} listings={listings} total={total}
      initialTarget={mapTarget} manualArea={filters.provinceId !== null} filters={mapFilters.toString()}
      pagination={(filters.page > 1 || total > filters.page * 24) && <nav className="result-pages" aria-label="Sonuç sayfaları">
      {filters.page > 1 && <Link className="secondary icon-link" href={withQuery({ sayfa: String(filters.page - 1) })}>
        <ArrowLeft size={16} aria-hidden="true" /> Önceki
      </Link>}
      <span>Sayfa {filters.page}</span>
      {total > filters.page * 24 && <Link className="secondary icon-link" href={withQuery({ sayfa: String(filters.page + 1) })}>
        Sonraki <ArrowRight size={16} aria-hidden="true" />
      </Link>}
    </nav>} />
  </main>;
}
