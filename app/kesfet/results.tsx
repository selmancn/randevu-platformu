'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LayoutGrid, LocateFixed, Map, MapPin, Navigation2, Search, Star } from 'lucide-react';
import type { Listing } from '../../lib/catalog';
import { categories, coverFor, directionsUrl } from '../../lib/discovery';
import { approximateBounds, writeMapBounds, type MapBounds, type MapTarget } from '../../lib/map-region';
import { DiscoveryMap } from './map';

const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const radians = (degrees: number) => degrees * Math.PI / 180;
type Position = { latitude: number; longitude: number };

function distance(location: Position | null, item: Listing) {
  if (!location || item.latitude === null || item.longitude === null) return Infinity;
  const arc = Math.sin(radians(item.latitude - location.latitude) / 2) ** 2 +
    Math.cos(radians(item.latitude)) * Math.cos(radians(location.latitude)) *
    Math.sin(radians(item.longitude - location.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

export function DiscoveryResults({ listings, total, initialTarget, manualArea, filters, pagination }: {
  listings: Listing[]; total: number; initialTarget: MapTarget; manualArea: boolean; filters: string; pagination?: ReactNode;
}) {
  const [location, setLocation] = useState<Position | null>(null);
  const [target, setTarget] = useState(initialTarget);
  const [bounds, setBounds] = useState(() => writeMapBounds(approximateBounds(initialTarget)).toString());
  const [scoped, setScoped] = useState<{ key: string; listings: Listing[]; total: number }>();
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<string | null>(null);
  const current = scoped?.listings ?? listings;
  const points = useMemo(() => current.filter((entry) => entry.latitude !== null && entry.longitude !== null), [current]);
  const entries = current.map((entry) => ({ entry, distance: distance(location, entry) }));
  const onBounds = useCallback((next: MapBounds) => setBounds(writeMapBounds(next).toString()), []);
  const locate = useCallback((cancelled: () => boolean = () => false) => {
    if (!navigator.geolocation) {
      setStatus('Konum kullanılamıyor. İlçe filtresiyle devam edebilirsin.');
      return;
    }
    setLocating(true);
    setStatus('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (cancelled()) return;
      const next = { latitude: coords.latitude, longitude: coords.longitude, zoom: 13 };
      setLocation(next);
      setTarget(next);
      onBounds(approximateBounds(next));
      setSelected(null);
      setLocating(false);
    }, () => {
      if (cancelled()) return;
      setStatus('Konum alınamadı. İl ve ilçe seçebilir veya haritayı taşıyabilirsin.');
      setLocating(false);
    }, { timeout: 8000 });
  }, [onBounds]);

  useEffect(() => {
    if (manualArea) return;
    let cancelled = false;
    locate(() => cancelled);
    return () => { cancelled = true; };
  }, [manualArea, locate]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMapError(false);
      try {
        const response = await fetch('/api/harita?' + bounds + (filters ? '&' + filters : ''), {
          signal: controller.signal, cache: 'no-store',
        });
        if (!response.ok) throw new Error('Harita sonucu yüklenemedi.');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setScoped({ key: bounds, listings: data.listings, total: data.total });
          setSelected((previous) => previous && (data.listings as Listing[]).some((entry) => entry.id === previous) ? previous : null);
        }
      } catch {
        if (!controller.signal.aborted) setMapError(true);
      }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [bounds, filters]);

  const count = scoped?.total ?? total;
  const updating = !mapError && scoped?.key !== bounds;
  return <section aria-label="İşletme sonuçları">
    <div className="result-toolbar">
      <div className="map-result-count"><h2>{count} işletme</h2><p>Haritada görünen alan</p></div>
      <div className="actions">
        <button type="button" className="secondary icon-link" onClick={() => locate()} disabled={locating}>
          <LocateFixed size={17} aria-hidden="true" />{locating ? 'Konum alınıyor…' : 'Konumuma git'}
        </button>
        <div className="view-switch" aria-label="Sonuç görünümü">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><LayoutGrid size={17} aria-hidden="true" /> Liste</button>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><Map size={17} aria-hidden="true" /> Harita</button>
        </div>
      </div>
    </div>
    {status && <p className="note" role="status">{status}</p>}
    {mapError && <p className="note" role="status">Bu alan yüklenemedi. Haritayı tekrar taşıyıp deneyebilirsin.</p>}
    <div className="discovery-layout" data-view={view}>
      <div className="listing-grid" aria-busy={updating}>
        {!entries.length && <div className="card discovery-empty"><Search size={29} aria-hidden="true" />
          <h3>{updating ? 'Bu alan taranıyor…' : 'Bu alanda işletme bulunamadı'}</h3>
          {!updating && <p>Haritayı taşı, uzaklaş veya farklı bir ilçe seç.</p>}
        </div>}
          {entries.map(({ entry, distance: km }) => {
            const directions = directionsUrl(entry.latitude, entry.longitude);
            return <article className="listing-card" key={entry.id} data-selected={selected === entry.id}>
              <Link className="listing-cover" href={`/isletme/${entry.slug}`} aria-label={`${entry.name} profilini aç`}>
                {/* The local category cover is decorative and is not a business photograph. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverFor(entry.category)} alt="" width="768" height="512" loading="lazy" />
                <span>Temsili görsel</span>
              </Link>
              <div className="listing-body">
                <div className="listing-meta"><span>{categories[entry.category]}</span>
                  {entry.score !== null && <span className="listing-rating"><Star size={14} aria-hidden="true" />{decimal.format(entry.score)} ({entry.review_count})</span>}
                </div>
                <h3><Link href={`/isletme/${entry.slug}`}>{entry.name}</Link></h3>
                <p><MapPin size={15} aria-hidden="true" />{[entry.district, entry.province].filter(Boolean).join(', ')}{Number.isFinite(km) && ` · ${decimal.format(km)} km`}</p>
                <p>{entry.low !== null ? <><strong>{money.format(entry.low / 100)}</strong> <span>başlayan fiyat</span></> : 'Fiyat bilgisi eklenmedi'}</p>
                {directions && <div className="listing-actions">
                  <button type="button" aria-pressed={selected === entry.id} onClick={() => { setSelected(entry.id); setView('map'); }}><Map size={15} aria-hidden="true" /> Haritada gör</button>
                  <a href={directions} target="_blank" rel="noreferrer"><Navigation2 size={14} aria-hidden="true" /> Yol tarifi</a>
                </div>}
              </div>
            </article>;
          })}
        {scoped && count > current.length && <p className="map-result-limit">Daha fazla sonucu görmek için haritada yakınlaş.</p>}
        {!scoped && pagination}
      </div>
      <aside className="discovery-map-panel" aria-label="Sonuç haritası">
        <DiscoveryMap points={points} selected={selected} target={target} location={location} onSelect={setSelected} onBounds={onBounds} />
      </aside>
    </div>
  </section>;
}
