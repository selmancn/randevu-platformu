'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ArrowUpRight, MapPin, Navigation2, Star, X } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import type { Listing } from '../../lib/catalog';
import { categories, coverFor, directionsUrl } from '../../lib/discovery';
import type { MapBounds, MapTarget } from '../../lib/map-region';
import 'leaflet/dist/leaflet.css';

const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

function MapListing({ entry }: { entry: Listing }) {
  const directions = directionsUrl(entry.latitude, entry.longitude);
  return <article className="pin-business">
    <div className="pin-cover"><img src={coverFor(entry.category)} alt="" width="768" height="512" />
      <span>Temsili görsel</span></div>
    <div className="pin-business-body">
      <small>{categories[entry.category]}</small>
      <h3><Link href={`/isletme/${entry.slug}`}>{entry.name}</Link></h3>
      <p><MapPin size={15} aria-hidden="true" />{entry.district}</p>
      <p className="pin-rating" aria-label={entry.score === null ? 'Henüz puan yok' :
        `${decimal.format(entry.score)} / 5, ${entry.review_count} değerlendirme`}>
          <span className="pin-stars" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((star) => <span key={star}><Star size={15} />
              <span style={{ width: `${Math.max(0, Math.min(1, (entry.score ?? 0) - star)) * 100}%` }}><Star size={15} /></span>
            </span>)}
          </span>
          {entry.score === null ? <span>Henüz puan yok</span> : <>
            <strong>{decimal.format(entry.score)} / 5</strong> <small>({entry.review_count})</small>
          </>}
      </p>
      <div className="pin-links">
        <Link href={`/isletme/${entry.slug}`}>Profili gör <ArrowUpRight size={14} aria-hidden="true" /></Link>
        {directions && <a href={directions} target="_blank" rel="noreferrer"><Navigation2 size={14} aria-hidden="true" /> Yol tarifi</a>}
      </div>
    </div>
  </article>;
}

type MapState = { leaflet: typeof Leaflet; map: Leaflet.Map; layer: Leaflet.LayerGroup };
const positionKey = (item: Listing) => `${item.latitude!.toFixed(5)},${item.longitude!.toFixed(5)}`;

export function DiscoveryMap({ points, selected, target, location, onSelect, onBounds }: {
  points: Listing[]; selected: string | null; target: MapTarget; onSelect: (id: string | null) => void;
  location: Pick<MapTarget, 'latitude' | 'longitude'> | null;
  onBounds: (bounds: MapBounds) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const state = useRef<MapState | null>(null);
  const popup = useRef<Leaflet.Popup | null>(null);
  const initialTarget = useRef(target);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [portal] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'));
  const groups = useMemo(() => {
    const result = new Map<string, Listing[]>();
    for (const entry of points) {
      if (entry.latitude === null || entry.longitude === null) continue;
      const key = positionKey(entry);
      const group = result.get(key);
      if (group) group.push(entry);
      else result.set(key, [entry]);
    }
    return result;
  }, [points]);

  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let current: Leaflet.Map | undefined;
    async function start() {
      const L = await import('leaflet');
      if (disposed || !element.current) return;
      const node = element.current;
      const created = L.map(node, { scrollWheelZoom: true, zoomControl: false, minZoom: 3, maxZoom: 19, worldCopyJump: true });
      current = created;
      const layer = L.layerGroup().addTo(created);
      state.current = { leaflet: L, map: created, layer };
      L.control.zoom({ position: 'topright' }).addTo(created);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'discovery-base-tiles',
      });
      tiles.on('tileerror', () => { if (!disposed) setTileError(true); });
      tiles.on('tileload', () => { if (!disposed) setTileError(false); });
      tiles.addTo(created);
      function publishBounds() {
        if (!node.clientWidth || !node.clientHeight) return;
        const bounds = created.getBounds();
        onBounds({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
      }
      created.on('moveend', publishBounds);
      const first = initialTarget.current;
      created.setView([first.latitude, first.longitude], first.zoom);
      resize = new ResizeObserver(() => {
        if (!node.clientWidth || !node.clientHeight) return;
        created.invalidateSize({ animate: false, debounceMoveend: true });
        publishBounds();
      });
      resize.observe(node);
      setReady(true);
    }
    start().catch(() => { if (!disposed) setAvailable(false); });
    return () => {
      disposed = true;
      resize?.disconnect();
      current?.remove();
      state.current = null;
      popup.current = null;
    };
  }, [onBounds]);

  useEffect(() => {
    if (!ready || !state.current) return;
    const { map } = state.current;
    map.stop();
    map.setView([target.latitude, target.longitude], target.zoom, { animate: false });
  }, [target, ready]);

  useEffect(() => {
    if (!ready || !state.current || !location) return;
    const { leaflet: L, map } = state.current;
    const user = L.circleMarker([location.latitude, location.longitude], {
      radius: 7, color: '#fff', weight: 2, fillColor: '#3769ae', fillOpacity: 1,
      interactive: false, className: 'map-user-dot',
    }).addTo(map);
    return () => { user.remove(); };
  }, [location, ready]);

  useEffect(() => {
    if (!ready || !state.current) return;
    const { leaflet: L, layer } = state.current;
    layer.clearLayers();
    let index = 0;
    for (const list of groups.values()) {
      const top = list[0];
      index++;
      const label = document.createElement('span');
      label.textContent = String(list.length > 1 ? list.length : index);
      const active = list.some((item) => item.id === selected);
      const name = list.length > 1 ? `${top.district} · ${list.length} işletme` : top.name;
      const icon = L.divIcon({ className: `business-marker${active ? ' is-active' : ''}`,
        html: label, iconSize: [36, 36], iconAnchor: [18, 18] });
      const marker = L.marker([top.latitude!, top.longitude!], { icon, title: name, autoPanOnFocus: false })
        .on('click', () => onSelect(top.id)).addTo(layer);
      marker.getElement()?.setAttribute('aria-label', name);
    }
  }, [groups, onSelect, ready, selected]);

  const active = points.find((item) => item.id === selected && item.latitude !== null && item.longitude !== null);
  const activeKey = active ? positionKey(active) : null;
  const activeGroup = activeKey ? groups.get(activeKey) : undefined;
  const activeLatitude = active?.latitude;
  const activeLongitude = active?.longitude;
  useEffect(() => {
    if (!ready || !state.current || !portal) return;
    const { leaflet: L, map } = state.current;
    if (activeLatitude == null || activeLongitude == null) {
      popup.current?.remove();
      popup.current = null;
      return;
    }
    if (!popup.current) {
      L.DomEvent.disableScrollPropagation(portal);
      L.DomEvent.disableClickPropagation(portal);
      popup.current = L.popup({
        offset: [0, -16], closeButton: false, closeOnClick: false, closeOnEscapeKey: false,
        autoPanPadding: [16, 25], maxWidth: 300, minWidth: 232, className: 'discovery-popup',
      }).setContent(portal);
    }
    popup.current.setLatLng([activeLatitude, activeLongitude]).openOn(map);
  }, [activeLatitude, activeLongitude, portal, ready]);

  return <div className="map-frame" onKeyDown={(event) => { if (event.key === 'Escape' && selected) onSelect(null); }}>
    {available ? <div ref={element} className="map-canvas" aria-label="İşletme konumları ve yakınlaştırma kontrolleri" /> :
      <p className="map-empty">Harita yüklenemedi. İşletmeleri listeden inceleyebilirsin.</p>}
    {tileError && <p className="map-notice" role="status">Harita zemini şu anda yüklenemiyor.</p>}
    {portal && activeGroup && createPortal(<div className="pin-popup">
      <button type="button" className="pin-close" aria-label="İşletme kartını kapat" onClick={() => onSelect(null)}><X size={17} /></button>
      <div className="pin-content">{activeGroup.map((entry) => <MapListing key={entry.id} entry={entry} />)}</div>
    </div>, portal)}
  </div>;
}
