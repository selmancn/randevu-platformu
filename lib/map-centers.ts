import centers from '../data/map-centers.json' with { type: 'json' };
import { districts } from './locations.ts';
import type { MapTarget } from './map-region.ts';

const coordinates: Record<string, number[]> = centers;
export const turkeyCenter: MapTarget = { latitude: 39, longitude: 35.5, zoom: 6 };

export function areaTarget(provinceId: number | null, districtId: number | null): MapTarget | null {
  const point = districtId !== null ? coordinates[districtId] : undefined;
  if (point) return { latitude: point[0], longitude: point[1], zoom: 13 };
  if (!provinceId) return null;
  const area = districts.filter((item) => item.provinceId === provinceId)
    .flatMap((item) => coordinates[item.id] ? [coordinates[item.id]] : []);
  if (!area.length) return null;
  return {
    latitude: (Math.min(...area.map(([lat]) => lat)) + Math.max(...area.map(([lat]) => lat))) / 2,
    longitude: (Math.min(...area.map(([, lon]) => lon)) + Math.max(...area.map(([, lon]) => lon))) / 2,
    zoom: 10,
  };
}
