import Link from 'next/link';
import { CalendarDays, CircleCheck, HandCoins, Store } from 'lucide-react';
import { getCatalog } from '../../lib/database';
import { addService, editService, proposeAppointment, sessionToken, setChat, setHours, setLocation, updateAppointment } from '../actions';
import { appointmentStatus, appointmentTime } from '../appointments';
import { formatMoney } from '../services';
import { categories } from '../../lib/discovery';
import { LocationFields } from '../location-fields';
import { PanelSignIn } from './sign-in';

export default async function Panel({ searchParams }: {
  searchParams: Promise<{ hata?: string; kaydedildi?: string; kayit?: string }>;
}) {
  const { hata, kaydedildi, kayit } = await searchParams;
  const token = await sessionToken();
  if (!token) return <PanelSignIn signup={kayit === '1'} error={typeof hata === 'string' ? hata : undefined} />;
  const catalog = await getCatalog();
  const owner = await catalog.owner(token);
  if (!owner) return <PanelSignIn signup={kayit === '1'} error={typeof hata === 'string' ? hata : undefined} />;
  const profile = await catalog.profile(owner.slug, true);
  const [hours, appointments, chatEnabled, overview] = await Promise.all([
    catalog.hours(owner.id), catalog.appointments(token), catalog.chatEnabled(owner.id), catalog.appointmentOverview(token),
  ]);
  const week = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return (
    <main className="wrap page panel-dashboard">
      <div className="page-heading">
        <div><p className="overline">İşletme paneli · {owner.district}</p><h1>{owner.name}</h1></div>
        <div className="actions">
          <Link className="secondary" href={`/isletme/${owner.slug}`}>Müşteri profilini aç</Link>
        </div>
      </div>
      <div className="panel-overview">
        <div className="card"><Store size={21} aria-hidden="true" /><strong>{profile?.services.filter((service) => service.active).length ?? 0}</strong><span>Yayındaki hizmet</span></div>
        <div className="card"><CalendarDays size={21} aria-hidden="true" /><strong>{overview.requested}</strong><span>Bekleyen talep</span></div>
        <div className="card"><CircleCheck size={21} aria-hidden="true" /><strong>{overview.upcoming}</strong><span>Yaklaşan randevu</span></div>
        <Link className="card" href="/panel/rapor"><HandCoins size={21} aria-hidden="true" /><strong>Raporlar</strong><span>Gelir ve gideri incele</span></Link>
      </div>
      {hata && <p className="error" role="alert">{hata}</p>}
      <div className="grid">
        <section className="card"><h2>Hizmet tarifesi</h2>
          {profile?.services.length ? <ul className="services">{profile.services.map((service) => (
            <li className="editable-service" key={service.id}>
              <details>
                <summary>{service.name} · {formatMoney(service.price)}{service.active ? '' : ' · Pasif'}</summary>
                <form className="fields" action={editService.bind(null, service.id)}>
                  <label>Hizmet adı<input name="name" required maxLength={100} defaultValue={service.name} /></label>
                  <label>Fiyat (₺)<input name="price" required inputMode="decimal" defaultValue={(service.price / 100).toFixed(2)} /></label>
                  <label>Süre (dakika)<input name="duration" type="number" min={5} max={720} defaultValue={service.duration ?? ''} /></label>
                  <label>Görünürlük<select name="active" defaultValue={service.active ? '1' : '0'}>
                    <option value="1">Yayında</option><option value="0">Pasif</option>
                  </select></label>
                  <button>Değişiklikleri kaydet</button>
                </form>
              </details>
            </li>
          ))}</ul> : <p className="note">İlk hizmetini eklediğinde burada görünecek.</p>}
        </section>
        <section className="card"><h2>Hizmet ekle</h2>
          {kaydedildi === '1' && <p className="success" role="status">Hizmet tarifeye eklendi.</p>}
          <form action={addService} className="fields">
            <label>Hizmet adı<input name="name" required maxLength={100} /></label>
            <label>Fiyat (₺)<input name="price" inputMode="decimal" required maxLength={10} placeholder="350,00" /></label>
            <label>Süre (dakika)<input name="duration" type="number" min={5} max={720} step={1} /></label>
            <small>Süreyi boş bırakabilirsin.</small>
            <button>Tarifeye ekle</button>
          </form>
        </section>
      </div>
      <div className="grid section-gap">
        <section id="randevular" className="card"><h2>Randevular</h2>
          <form action={setChat}>
            <button className="secondary" name="enabled" value={chatEnabled ? '0' : '1'}>
              {chatEnabled ? 'Sohbeti kapat' : 'Sohbeti aç'}
            </button>
          </form>
          {appointments.length === 0 && <p className="note">Henüz randevu yok.</p>}
          <ul className="services">{appointments.map((entry) => (
            <li key={entry.id}>
              <div><strong>{entry.service_name}</strong><small>{entry.customer} · {appointmentTime(entry.starts)}</small>
                <small>{entry.email}</small><small>{appointmentStatus[entry.status]}</small>
                {entry.proposed_start && <small>Saat önerildi · {appointmentTime(entry.proposed_start)}</small>}
                <Link href={`/panel/sohbet/${entry.id}`}>Sohbet</Link>
                {entry.status === 'requested' && <details>
                  <summary>Başka saat öner</summary>
                  <form className="fields" action={proposeAppointment.bind(null, entry.id)}>
                    <label>Gün<input name="day" type="date" required /></label>
                    <label>Saat<input name="time" type="time" required /></label>
                    <button>Öner</button>
                  </form>
                </details>}
              </div>
              {['requested', 'confirmed'].includes(entry.status) && <form action={updateAppointment} className="fields">
                <input type="hidden" name="id" value={entry.id} />
                {entry.status === 'requested' && +new Date(entry.starts) > Date.now() &&
                  <button name="status" value="confirmed">Onayla</button>}
                {entry.status === 'confirmed' && +new Date(entry.starts) <= Date.now() &&
                  <button name="status" value="completed">Tamamlandı</button>}
                <button className="secondary" name="status" value="cancelled">İptal et</button>
              </form>}
            </li>
          ))}</ul>
        </section>
        <section className="card"><h2>Çalışma saatleri</h2>
          {hours.length > 0 && <ul className="services">{hours.map((entry) => (
            <li key={entry.weekday}><strong>{week[entry.weekday]}</strong><span>{entry.opens}–{entry.closes}</span></li>
          ))}</ul>}
          <form action={setHours} className="fields">
            <label>Gün<select name="weekday" defaultValue="1">{week.map((name, index) => <option value={index} key={name}>{name}</option>)}</select></label>
            <label>Açılış<input type="time" name="opens" defaultValue="09:00" required /></label>
            <label>Kapanış<input type="time" name="closes" defaultValue="18:00" required /></label>
            <button>Çalışma saatini kaydet</button>
          </form>
          <div className="section-gap">
            <h2>Keşif profili</h2>
            <form action={setLocation} className="fields">
              <LocationFields provinceName="province" districtName="district" initialProvince={owner.province_id}
                initialDistrict={owner.district_id} required />
              <label>Kategori<select name="category" defaultValue={owner.category}>{Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}</select></label>
              <label>Enlem<input name="latitude" inputMode="decimal" maxLength={13} defaultValue={owner.latitude ?? ''} placeholder="40,9900" /></label>
              <label>Boylam<input name="longitude" inputMode="decimal" maxLength={13} defaultValue={owner.longitude ?? ''} placeholder="29,0300" /></label>
              <small>Bu konum müşterilere gösterilir.</small>
              <button>Profili kaydet</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
