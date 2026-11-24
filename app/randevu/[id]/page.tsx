import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCatalog } from '../../../lib/database';
import { acceptProposal, cancelBooking, reviewBooking } from '../../actions';
import { appointmentStatus, appointmentTime } from '../../appointments';
import { Chat } from '../../chat';
import { CustomerAccess } from '../../customer-access';

export default async function AppointmentPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const capability = (await cookies()).get(`randevu_${id}`)?.value;
  if (!capability) notFound();
  const catalog = await getCatalog();
  const entry = await catalog.appointment(capability);
  if (!entry || entry.id !== id) notFound();
  const [conversation, reviewed, { hata }] = await Promise.all([
    catalog.conversation({ capability }), catalog.reviewed(entry.id), searchParams,
  ]);
  const canCancel = ['requested', 'confirmed'].includes(entry.status) &&
    Math.max(+new Date(entry.starts), entry.proposed_start ? +new Date(entry.proposed_start) : 0) > Date.now();
  return <main className="wrap page profile">
    <CustomerAccess />
    <section className="card">
      <p className="overline">{appointmentStatus[entry.status]}</p>
      <h1>{entry.service_name}</h1>
      <p>{appointmentTime(entry.starts)}</p>
      {hata && <p role="alert" className="error">{hata}</p>}
      {entry.status === 'requested' && entry.proposed_start && <form className="section-gap"
        action={acceptProposal.bind(null, id, new Date(entry.proposed_start).toISOString())}>
        <p>Önerilen saat · {appointmentTime(entry.proposed_start)}</p>
        <button>Önerilen saati kabul et</button>
      </form>}
      {canCancel && <form action={cancelBooking.bind(null, id)}><button>Gelemeyeceğim</button></form>}
      <p className="note">Randevu durumunu bu tarayıcıdan takip edebilirsin.</p>
    </section>
    {entry.status === 'completed' && <section className="card section-gap">
      <h2>Randevunu değerlendir</h2>
      {reviewed ? <p>Puanların kaydedildi.</p> : <form action={reviewBooking.bind(null, id)} className="fields">
        {Object.entries({ business: 'İşletme puanı', service: 'Hizmet puanı' }).map(([key, label]) => (
          <label key={key}>{label}<select name={key} defaultValue="" required>
            <option value="" disabled>Puan seç</option>
            {[5,4,3,2,1].map((score) => <option key={score} value={score}>{score} / 5</option>)}
          </select></label>
        ))}
        <button>Puanları kaydet</button>
      </form>}
    </section>}
    {conversation && (conversation.enabled || conversation.messages.length > 0) &&
      <Chat id={id} side="customer" conversation={conversation} />}
  </main>;
}
