import Link from 'next/link';
import { BarChart3, CalendarDays, ExternalLink, LayoutDashboard, LogOut, Store } from 'lucide-react';
import { logout, sessionToken } from '../actions';
import { getCatalog } from '../../lib/database';
import './panel.css';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const token = await sessionToken();
  const owner = token ? await (await getCatalog()).owner(token) : null;
  if (!owner) return children;
  return <div className="panel-shell">
    <aside className="panel-sidebar">
      <Link className="panel-identity" href="/panel"><span><Store size={20} aria-hidden="true" /></span>
        <div><strong>{owner.name}</strong><small>İşletme alanı</small></div></Link>
      <nav className="panel-nav" aria-label="İşletme menüsü">
        <Link href="/panel"><LayoutDashboard size={17} aria-hidden="true" /> Genel görünüm</Link>
        <Link href="/panel#randevular"><CalendarDays size={17} aria-hidden="true" /> Randevular</Link>
        <Link href="/panel/rapor"><BarChart3 size={17} aria-hidden="true" /> Gelir ve gider</Link>
        <Link href={`/isletme/${owner.slug}`}><ExternalLink size={17} aria-hidden="true" /> Müşteri profili</Link>
      </nav>
      <form action={logout}><button className="panel-signout"><LogOut size={17} aria-hidden="true" /> Çıkış yap</button></form>
    </aside>
    <div className="panel-content">{children}</div>
  </div>;
}
