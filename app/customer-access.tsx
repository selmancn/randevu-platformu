import Link from 'next/link';
import { CircleUserRound } from 'lucide-react';
import { currentCustomer } from './customer-actions';
import './account.css';

export async function CustomerAccess() {
  const customer = await currentCustomer();
  return <nav className="customer-access" aria-label="Müşteri hesabı">
    {customer ? <Link className="access-main" href="/hesap"><CircleUserRound size={18} aria-hidden="true" /> Hesabım</Link> : <>
      <Link href="/hesap">Giriş yap</Link>
      <Link className="access-main" href="/hesap?kayit=1">Kayıt ol</Link>
    </>}
  </nav>;
}
