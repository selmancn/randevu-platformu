import Link from 'next/link';
import { ArrowLeft, CalendarCheck, CircleUserRound, Mail } from 'lucide-react';
import { currentCustomer, signInCustomer, signOutCustomer, signUpCustomer } from '../customer-actions';
import '../account.css';

export default async function CustomerAccount({ searchParams }: {
  searchParams: Promise<{ kayit?: string; hata?: string }>;
}) {
  const [query, customer] = await Promise.all([searchParams, currentCustomer()]);
  const signup = query.kayit === '1';
  return <main className="wrap account-page">
    <Link href="/" className="account-back"><ArrowLeft size={17} aria-hidden="true" /> Keşfe dön</Link>
    <div className="account-layout">
      <section className="account-intro">
        <CalendarCheck size={37} aria-hidden="true" />
        <h1>Randevu hesabın</h1>
        <p>Mahallendeki hizmetleri keşfet, fiyatları incele ve randevunu al.</p>
      </section>
      <section className="card account-card">
        {customer ? <>
          <CircleUserRound size={34} aria-hidden="true" />
          <h2>{customer.name}</h2>
          <p>{customer.email}</p>
          <form action={signOutCustomer}><button className="secondary">Çıkış yap</button></form>
        </> : <>
          <h2>{signup ? 'Müşteri hesabı oluştur' : 'Müşteri girişi'}</h2>
          <button type="button" className="account-google" disabled aria-describedby="google-durum">
            <span aria-hidden="true">G</span> Google ile giriş yap
          </button>
          <p id="google-durum" className="account-note">Google girişi yakında.</p>
          <div className="account-divider"><span><Mail size={15} aria-hidden="true" /> E-posta ile devam et</span></div>
          {typeof query.hata === 'string' && <p role="alert" className="error">{query.hata}</p>}
          <form className="fields" action={signup ? signUpCustomer : signInCustomer}>
            {signup && <label>Ad soyad<input name="name" autoComplete="name" maxLength={80} required /></label>}
            <label>E-posta<input name="email" autoComplete="email" type="email" maxLength={254} required /></label>
            <label>Parola<input name="password" minLength={signup ? 12 : undefined} maxLength={128}
              autoComplete={signup ? 'new-password' : 'current-password'} type="password" required /></label>
            {signup && <small>En az 12 karakter kullan.</small>}
            <button>{signup ? 'E-posta ile kayıt ol' : 'Giriş yap'}</button>
          </form>
          <Link className="account-switch" href={signup ? '/hesap' : '/hesap?kayit=1'}>
            {signup ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
          </Link>
        </>}
      </section>
    </div>
  </main>;
}
