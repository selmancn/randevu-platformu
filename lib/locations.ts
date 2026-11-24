import data from '../data/locations.json' with { type: 'json' };

export const provinces = data.provinces;
export const districts = data.districts;
const byProvince = new Map(provinces.map((entry) => [String(entry.id), entry]));
const byDistrict = new Map(districts.map((entry) => [String(entry.id), entry]));

export function foldSearch(value: string) {
  return value.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD').replace(/\p{Mark}/gu, '');
}

export function locationSelection(provinceId: string, districtId: string) {
  const province = byProvince.get(provinceId);
  const district = byDistrict.get(districtId);
  return province && district?.provinceId === province.id ? { province, district } : null;
}

export function locationFilter(provinceId: string, districtId: string) {
  const province = byProvince.get(provinceId);
  const selected = locationSelection(provinceId, districtId);
  return { provinceId: province?.id ?? null, districtId: selected?.district.id ?? null };
}
