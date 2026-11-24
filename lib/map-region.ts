export type MapBounds = { south: number; west: number; north: number; east: number };
export type MapTarget = { latitude: number; longitude: number; zoom: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

export function writeMapBounds(bounds: MapBounds) {
  const world = bounds.east - bounds.west >= 360;
  const west = world ? -180 : wrap(bounds.west);
  const east = world ? 180 : wrap(bounds.east);
  return new URLSearchParams({
    south: clamp(bounds.south, -90, 90).toFixed(4),
    west: west.toFixed(4),
    north: clamp(bounds.north, -90, 90).toFixed(4),
    east: east.toFixed(4),
  });
}

export function readMapBounds(params: URLSearchParams): MapBounds | null {
  const coordinates = ['south', 'west', 'north', 'east'].map((key) => params.get(key));
  if (coordinates.some((value) => value === null || !/^-?\d{1,3}(?:\.\d{1,6})?$/.test(value))) return null;
  const [south, west, north, east] = coordinates.map(Number);
  if (south < -90 || north > 90 || south >= north || Math.abs(west) > 180 || Math.abs(east) > 180 || west === east) {
    return null;
  }
  return { south, west, north, east };
}

export function approximateBounds(target: MapTarget): MapBounds {
  const vertical = 100 / 2 ** Math.max(0, target.zoom - 1);
  const horizontal = 180 / 2 ** Math.max(0, target.zoom - 1);
  return { south: target.latitude - vertical, west: target.longitude - horizontal,
    north: target.latitude + vertical, east: target.longitude + horizontal };
}
