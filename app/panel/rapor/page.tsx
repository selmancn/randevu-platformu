import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowDownToLine, CalendarDays, CircleDollarSign, CreditCard, Receipt, Wallet } from 'lucide-react';
import { getCatalog } from '../../../lib/database';
import { reportDays, reportRange } from '../../../lib/report-range';
import { addEntry, sessionToken } from '../../actions';
import { appointmentTime } from '../../appointments';
import { formatMoney } from '../../services';
import { ReportChart, type ReportPoint } from './chart';
import './report.css';

const kinds = { sale: 'Satış', payment: 'Tahsilat', expense: 'Gider', refund: 'İade' };
const presets = [['gun', 'Bugün'], ['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['ay', 'Bu ay']] as const;
type Query = { donem?: string; baslangic?: string; bitis?: string; hata?: string };

export default async function Reports({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const catalog = await getCatalog();
  const token = await sessionToken();
  const owner = await catalog.owner(token);
  if (!owner) redirect('/panel');
  let range;
  let warning;
  try {
    range = reportRange(query);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    warning = error.message;
    range = reportRange({});
  }
  const report = await catalog.finance(token, range);
  const pointsByDay = new Map(reportDays(range).map((day): [string, ReportPoint] =>
    [day, { day, sale: 0, payment: 0, expense: 0, refund: 0 }]));
  for (const item of report.series) {
    const point = pointsByDay.get(item.day);
    if (point) point[item.kind] = Number(item.amount);
  }
  const points = [...pointsByDay.values()];
  const routeQuery = new URLSearchParams({ baslangic: range.from, bitis: range.to }).toString();
  const tiles = [
    { label: 'Ciro', amount: report.sales, note: `${report.count} satış işlemi`, icon: CircleDollarSign },
    { label: 'Tahsilat', amount: report.payments, note: 'Kaydedilen tahsilatlar', icon: CreditCard },
    { label: 'Gider', amount: report.expenses, note: `İadeler ${formatMoney(report.refunds)}`, icon: Receipt },
    { label: 'Nakit farkı', amount: report.payments - report.expenses - report.refunds, note: 'Tahsilat − gider − iade', icon: Wallet },
  ];
  return <main className="wrap page analytics">
    <div className="page-heading">
      <div><Link className="back-link" href="/panel">{owner.name} / Panel</Link><h1>Gelir ve gider</h1></div>
      <a className="secondary icon-link" href={`/panel/rapor/csv?${routeQuery}`}><ArrowDownToLine size={17} aria-hidden="true" /> CSV indir</a>
    </div>
    <section className="card date-toolbar" aria-label="Rapor tarih aralığı">
      <nav aria-label="Hazır tarih aralıkları" className="date-presets">
        {presets.map(([period, label]) => (
          <Link key={period} href={`/panel/rapor?donem=${period}`}
            aria-current={!query.baslangic && (query.donem ?? 'ay') === period ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>
      <form method="get" className="date-form">
        <label>Başlangıç<input type="date" name="baslangic" defaultValue={range.from} max={reportRange({ donem: 'gun' }).to} required /></label>
        <label>Bitiş<input type="date" name="bitis" defaultValue={range.to} max={reportRange({ donem: 'gun' }).to} required /></label>
        <button className="icon-link"><CalendarDays size={17} aria-hidden="true" /> Uygula</button>
      </form>
    </section>
    {(warning || typeof query.hata === 'string') && <p role="alert" className="error">{warning ?? query.hata}</p>}
    <div className="metric-tiles">
      {tiles.map(({ label, amount, note, icon: Icon }) => <section className="card metric-tile" key={label}>
        <div><h2>{label}</h2><Icon size={20} aria-hidden="true" /></div>
        <strong>{formatMoney(amount)}</strong>
        <small>{note}</small>
      </section>)}
    </div>
    <ReportChart key={routeQuery} points={points} />
    <div className="analytics-lower">
      <section className="card"><h2>Hizmete göre satış</h2>
        {report.byService.length ? <ul className="services">{report.byService.map((entry) => (
          <li key={entry.label}>
            <div><strong>{entry.label}</strong><small>{entry.count} satış</small>
              <progress aria-label={`${entry.label} ciro payı`} max={Math.max(1, report.sales)} value={Number(entry.amount)} /></div>
            <strong>{formatMoney(Number(entry.amount))}</strong>
          </li>
        ))}</ul> : <p className="note">Bu aralıkta satış yok.</p>}
      </section>
      <section className="card"><h2>İşlem ekle</h2>
        <form action={addEntry} className="fields">
          <input type="hidden" name="baslangic" value={range.from} /><input type="hidden" name="bitis" value={range.to} />
          <label>İşlem türü<select name="kind">{Object.entries(kinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
          <label>Açıklama<input name="label" required maxLength={120} /></label>
          <label>Tutar (₺)<input name="amount" required inputMode="decimal" maxLength={10} /></label>
          <button>İşlemi kaydet</button>
        </form>
      </section>
    </div>
    <section className="card section-gap"><h2>Son işlemler</h2>
      {report.rows.length ? <ul className="services">{report.rows.map((entry) => (
        <li key={entry.id}><div><strong>{entry.label}</strong><small>{kinds[entry.kind]} · {appointmentTime(entry.recorded_at)}</small></div>
          <strong>{formatMoney(entry.amount)}</strong></li>
      ))}</ul> : <p className="note">Bu aralıkta işlem yok.</p>}
    </section>
  </main>;
}
