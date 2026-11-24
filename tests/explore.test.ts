import assert from 'node:assert/strict';
import test from 'node:test';
import { reportRange } from '../lib/report-range.ts';
import { directionsUrl, discoveryFilters } from '../lib/discovery.ts';
import { districts, provinces, locationSelection } from '../lib/locations.ts';

test('il ve ilçe seçimleri katalogdan gelmeli ve birbirine ait olmalı', () => {
  assert.equal(provinces.length, 81);
  assert.equal(districts.length, 973);
  assert.equal(new Set(districts.map((item) => item.id)).size, 973);
  assert.equal(locationSelection('34', '444')?.district.name, 'Kadıköy');
  assert.equal(locationSelection('6', '444'), null);
  assert.equal(locationSelection('34', 'Kadıköy'), null);
  assert.equal(locationSelection('34', '0444'), null);
});

test('tarih aralığı İstanbul gün sınırlarını ve artık günü korur', () => {
  const now = new Date('2028-02-29T21:30:00Z');
  assert.deepEqual(reportRange({ donem: 'gun' }, now), { from: '2028-03-01', to: '2028-03-01' });
  assert.deepEqual(reportRange({ baslangic: '2028-02-29', bitis: '2028-03-01' }, now), { from: '2028-02-29', to: '2028-03-01' });
  assert.throws(() => reportRange({ baslangic: '2028-02-30', bitis: '2028-03-01' }, now));
  assert.throws(() => reportRange({ baslangic: '2027-01-01', bitis: '2028-03-01' }, now));
});

test('keşif filtreleri güvenli değerler ve tam kuruş tutarı üretir', () => {
  const filters = discoveryFilters({ kategori: 'berber', fiyat: '250,50', sirala: 'puan', konum: '1', sayfa: '2' });
  assert.equal(filters.category, 'berber');
  assert.equal(filters.maxPrice, 25050);
  assert.equal(filters.located, true);
  assert.equal(filters.page, 2);
  assert.equal(discoveryFilters({ kategori: 'unknown', fiyat: '1e3' }).maxPrice, null);
  assert.equal(new URL(directionsUrl(40.99, 29.03)!).searchParams.get('destination'), '40.99,29.03');
  assert.equal(directionsUrl(null, 29.03), null);
});
