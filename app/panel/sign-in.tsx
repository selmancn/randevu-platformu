import Link from 'next/link';
import { ArrowLeft, Store } from 'lucide-react';
import { login, register } from '../actions';
import { LocationFields } from '../location-fields';
import '../account.css';

export function PanelSignIn({ signup, error }: { signup: boolean; error?: string }) {
  return <main className="wrap account-page">
    <Link href="/" className="account-back"><ArrowLeft size={17} aria-hidden="true" /> Müşteri keşfine dön</Link>
    <div className="account-layout">
      <section className="account-intro">
        <Store size={38} aria-hidden="true" /><h1>İşletmeni yönet</h1>
        <p>Hizmet tarifeni yayınla, randevularını takip et ve gelir-gider kayıtlarını tek yerden gör.</p>
      </section>
      <section className="card account-card">
        <h2>{signup ? 'İşletme hesabı oluştur' : 'İşletme girişi'}</h2>
        {error && <p role="alert" className="error">{error}</p>}
        <form action={signup ? register : login} className="fields">
          {signup && <>
            <label>İşletme adı<input name="name" required maxLength={80} autoComplete="organization" /></label>
            <LocationFields provinceName="province" districtName="district" required />
          </>}
          <label>E-posta<input type="email" name="email" required maxLength={254} autoComplete="email" /></label>
          <label>Parola<input name="password" type="password" required minLength={signup ? 12 : undefined}
            maxLength={128} autoComplete={signup ? 'new-password' : 'current-password'} /></label>
          {signup && <small>En az 12 karakter kullan.</small>}
          <button>{signup ? 'İşletme hesabı oluştur' : 'İşletme hesabıyla giriş yap'}</button>
        </form>
        <Link className="account-switch" href={signup ? '/panel' : '/panel?kayit=1'}>
          {signup ? 'Zaten hesabın var mı? Giriş yap' : 'Yeni işletme kaydı'}
        </Link>
      </section>
    </div>
  </main>;
}
