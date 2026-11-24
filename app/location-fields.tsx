'use client';

import { useState } from 'react';
import { districts, provinces } from '../lib/locations';

const sortedProvinces = [...provinces].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

export function LocationFields({ provinceName, districtName, initialProvince, initialDistrict, required = false }: {
  provinceName: string; districtName: string; initialProvince?: number | null; initialDistrict?: number | null; required?: boolean;
}) {
  const [province, setProvince] = useState(initialProvince ? String(initialProvince) : '');
  const [district, setDistrict] = useState(initialDistrict ? String(initialDistrict) : '');
  const choices = districts.filter((entry) => String(entry.provinceId) === province).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return <>
    <label>İl<select name={provinceName} required={required} value={province} onChange={(event) => {
      setProvince(event.target.value);
      setDistrict('');
    }}>
      <option value="">{required ? 'İl seçin' : 'Tüm iller'}</option>
      {sortedProvinces.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select></label>
    <label>İlçe<select name={districtName} required={required} disabled={!province} value={district}
      onChange={(event) => setDistrict(event.target.value)}>
      <option value="">{!province ? 'Önce il seçin' : required ? 'İlçe seçin' : 'Tüm ilçeler'}</option>
      {choices.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select></label>
  </>;
}
