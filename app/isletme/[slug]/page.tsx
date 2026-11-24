import { randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Navigation2, Star } from 'lucide-react';
import { getCatalog } from '../../../lib/database';
import { CatalogError } from '../../../lib/catalog';
import { categories, coverFor, directionsUrl } from '../../../lib/discovery';
import { bookService } from '../../actions';
import { formatMoney } from '../../services';
import { CustomerAccess } from '../../customer-access';
import './detail.css';

const weekdayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const ratingValue = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export default async function BusinessProfile({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hizmet?: string; gun?: string; hata?: string }>;
}) {
  await connection();
  const { slug } = await params;
  const catalog = await getCatalog();
  const profile = await catalog.profile(slug);
  if (!profile) notFound();

  const [ratings, hours, query] = await Promise.all([
    catalog.ratings(profile.id), catalog.hours(profile.id), searchParams,
  ]);
  const directions = directionsUrl(profile.latitude, profile.longitude);
  const location = [profile.district, profile.province].filter(Boolean).join(', ');
  const service = profile.services.find((item) => item.id === query.hizmet);
  const day = typeof query.gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.gun) ? query.gun : undefined;
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const orderedHours = [...hours].sort((left, right) => (left.weekday + 6) % 7 - (right.weekday + 6) % 7);
  const lowestService = profile.services.reduce<(typeof profile.services)[number] | undefined>(
    (lowest, item) => !lowest || item.price < lowest.price ? item : lowest, undefined,
  );
  const lowest = lowestService?.price ?? null;
  const bookable = lowest !== null;
  let options;
  let dayError: string | undefined;
  if (query.gun !== undefined && !day) dayError = 'Geçerli bir gün seç.';
  if (service && day) {
    try {
      options = await catalog.bookingOptions(service.id, day);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      dayError = error.message;
    }
  }
  const error = typeof query.hata === 'string' ? query.hata : dayError;
  function serviceLink(id: string) {
    const values = new URLSearchParams({ hizmet: id });
    if (day && !dayError) values.set('gun', day);
    return `/isletme/${slug}?${values}#randevu`;
  }

  return <main className={`wrap page business-detail${bookable ? ' has-booking' : ''}`}>
    <header className="detail-header">
      <div className="detail-access"><Link href="/kesfet" className="detail-back"><ArrowLeft size={17} aria-hidden="true" /> Keşfe dön</Link>
        <CustomerAccess /></div>
      <div className="detail-title-row">
        <div>
          <p className="detail-category">{categories[profile.category]}</p>
          <h1>{profile.name}</h1>
          <div className="detail-meta">
            <span><MapPin size={17} aria-hidden="true" />{location}</span>
            <a href="#degerlendirmeler"><Star size={17} aria-hidden="true" />
              {ratings.business.count > 0
                ? <><strong>{ratingValue(ratings.business.average)} / 5</strong> · {ratings.business.count} değerlendirme</>
                : 'Henüz değerlendirme yok'}
            </a>
          </div>
        </div>
        {directions && <a className="secondary detail-directions" href={directions} target="_blank" rel="noreferrer">
          <Navigation2 size={17} aria-hidden="true" /> Yol tarifi
        </a>}
      </div>
    </header>

    <figure className="detail-cover">
      <img src={coverFor(profile.category)} alt="" width="768" height="512" fetchPriority="high" />
      <figcaption>Temsili kategori görseli</figcaption>
    </figure>

    <div className={`detail-layout${bookable ? '' : ' detail-layout-single'}`}>
      <div className="detail-content">
        <section id="hizmetler" className="detail-section" aria-labelledby="hizmetler-baslik">
          <header className="detail-section-heading">
            <div><h2 id="hizmetler-baslik">Hizmetler ve fiyatlar</h2>
              {bookable && <p>Randevu almak için bir hizmet seç.</p>}</div>
            {bookable && <span className="detail-service-count">{profile.services.length} hizmet</span>}
          </header>
          {bookable ? <ul className="detail-services">
            {profile.services.map((item) => {
              const score = ratings.services[item.id];
              const chosen = service?.id === item.id;
              return <li key={item.id}>
                <Link href={serviceLink(item.id)} className="detail-service" data-chosen={chosen}
                  aria-current={chosen ? 'true' : undefined}>
                  <div><h3>{item.name}</h3>
                    <div className="detail-service-meta">
                      {item.duration !== null && <span><Clock3 size={15} aria-hidden="true" />{item.duration} dk</span>}
                      {score && <span><Star size={15} aria-hidden="true" />{ratingValue(score.average)} / 5 · {score.count} değerlendirme</span>}
                    </div>
                  </div>
                  <div className="detail-service-price"><strong>{formatMoney(item.price)}</strong><ArrowRight size={17} aria-hidden="true" /></div>
                </Link>
              </li>;
            })}
          </ul> : <p className="note">İşletmenin henüz yayınlanmış hizmeti yok.</p>}
        </section>

        <section id="konum" className="detail-section">
          <header className="detail-section-heading"><h2>Konum ve çalışma saatleri</h2></header>
          <div className="detail-location">
            <div className="detail-location-info"><MapPin size={20} aria-hidden="true" /><strong>{location}</strong></div>
            {directions && <a href={directions} target="_blank" rel="noreferrer">Haritada yol tarifi al</a>}
          </div>
          {orderedHours.length > 0 ? <dl className="detail-hours">
            {orderedHours.map((row) => <div key={row.weekday}><dt>{weekdayNames[row.weekday]}</dt><dd>{row.opens}–{row.closes}</dd></div>)}
          </dl> : <p className="note">Çalışma saatleri henüz paylaşılmadı.</p>}
        </section>

        <section id="degerlendirmeler" className="detail-section detail-review">
          <header className="detail-section-heading"><h2>Değerlendirmeler</h2></header>
          {ratings.business.count > 0 ? <p><Star size={21} aria-hidden="true" />
            <strong>{ratingValue(ratings.business.average)} / 5</strong> · {ratings.business.count} tamamlanan randevu değerlendirmesi
          </p> : <p className="note">Bu işletme için henüz puan verilmemiş.</p>}
        </section>
      </div>

      {bookable && <aside className="detail-reservation" aria-labelledby="randevu-baslik">
        <section id="randevu" className="card detail-booking">
          <div className="detail-booking-top">
            <div><h2 id="randevu-baslik">Randevu al</h2>
              <p><strong>{formatMoney(service?.price ?? lowest)}</strong>{!service && <span>başlayan fiyat</span>}</p>
            </div>
            <div className="detail-calendar-icon"><CalendarDays size={24} aria-hidden="true" /></div>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <form key={`${service?.id ?? 'initial'}:${day ?? ''}`} method="get" action="#randevu" className="fields detail-select">
            <label>Hizmet<select name="hizmet" defaultValue={service?.id ?? lowestService?.id}>{profile.services.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}</select></label>
            <label>Tarih<input type="date" name="gun" required min={today} defaultValue={day && !dayError ? day : today} /></label>
            <button>Randevu seçeneklerini gör <ArrowRight size={17} aria-hidden="true" /></button>
          </form>
          {service && day && options && <div className="detail-availability">
            {options.mode === 'instant' && !options.times.length ? <p role="status" className="note">Bu gün boş saat yok. Başka bir tarih seç.</p> :
              <form className="fields" action={bookService.bind(null, slug, service.id, day, randomBytes(32).toString('hex'))}>
                <h3>{options.mode === 'request' ? 'Randevu talebi' : 'Saati seç ve onayla'}</h3>
                {options.mode === 'request' && <p className="note">Seçtiğin saati işletmenin onayına gönder.</p>}
                <label>{options.mode === 'request' ? 'Tercih ettiğin saat' : 'Boş saat'}
                  {options.mode === 'request' ? <input type="time" name="time" required /> :
                    <select name="time">{options.times.map((time) => <option key={time}>{time}</option>)}</select>}
                </label>
                <label>Ad soyad<input name="customer" autoComplete="name" maxLength={80} required /></label>
                <label>E-posta<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
                <button>{options.mode === 'request' ? 'Randevu talebi gönder' : 'Randevuyu onayla'}</button>
              </form>}
          </div>}
        </section>
      </aside>}
    </div>

    {bookable && <div className="detail-mobile-booking">
      <div><strong>{formatMoney(service?.price ?? lowest)}</strong><small>{service ? service.name : 'Başlayan fiyat'}</small></div>
      <a href="#randevu">Randevu al <ArrowRight size={16} aria-hidden="true" /></a>
    </div>}
  </main>;
}
