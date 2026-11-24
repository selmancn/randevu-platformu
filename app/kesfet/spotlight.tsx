import Link from 'next/link';
import { Flame, MapPin, Sparkles } from 'lucide-react';
import type { Listing } from '../../lib/catalog';
import { categories, coverFor } from '../../lib/discovery';
import { formatMoney } from '../services';

export function Spotlight({ items, title, popular = false }: { items: Listing[]; title: string; popular?: boolean }) {
  if (!items.length) return null;
  const Icon = popular ? Flame : Sparkles;
  return <section className="spotlight">
    <div className="spotlight-heading"><Icon size={21} aria-hidden="true" /><div>
      <h2>{title}</h2>
      <p>{popular ? 'Son 30 günde en çok randevu alınan işletmeler' : 'Tamamladığın randevulardaki hizmet kategorilerine göre'}</p>
    </div></div>
    <div className="spotlight-grid">
      {items.map((item) => <Link key={item.id} href={`/isletme/${item.slug}`} className="spotlight-card">
        <div className="spotlight-cover"><img src={coverFor(item.category)} alt="" width="768" height="512" loading="lazy" />
          <span>Temsili görsel</span></div>
        <div className="spotlight-info"><small>{categories[item.category]}</small><h3>{item.name}</h3>
          <p><MapPin size={14} aria-hidden="true" />{[item.district, item.province].filter(Boolean).join(', ')}</p>
          <strong>{popular ? `${item.bookings} randevu` : item.low !== null ? `${formatMoney(item.low)} başlayan fiyat` : 'Randevuları gör'}</strong></div>
      </Link>)}
    </div>
  </section>;
}
