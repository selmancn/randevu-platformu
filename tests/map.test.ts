import assert from 'node:assert/strict';
import test from 'node:test';
import { readMapBounds, writeMapBounds } from '../lib/map-region.ts';
import { areaTarget } from '../lib/map-centers.ts';
import { districts } from '../lib/locations.ts';

test('harita sorgusu geçersiz sınırları reddeder ve tarih çizgisini korur', () => {
  const bounds = { south: 40.8, west: 28.7, north: 41.3, east: 29.4 };
  assert.deepEqual(readMapBounds(writeMapBounds(bounds)), bounds);
  assert.equal(readMapBounds(new URLSearchParams('south=-91&west=0&north=3&east=4')), null);
  assert.equal(readMapBounds(new URLSearchParams('south=1&west=2&north=3')), null);
  assert.deepEqual(readMapBounds(writeMapBounds({ south: 20, west: 175, north: 30, east: 185 })),
    { south: 20, west: 175, north: 30, east: -175 });
});

test('ilçe seçimi haritayı doğru merkeze taşımak için çevrimdışı veri kullanır', () => {
  const kadikoy = areaTarget(34, 444);
  assert.ok(kadikoy && Math.abs(kadikoy.latitude - 40.99) < 0.08 && Math.abs(kadikoy.longitude - 29.03) < 0.08);
  assert.ok(districts.every((item) => areaTarget(item.provinceId, item.id)?.zoom === 13));
});
