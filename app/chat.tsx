import { sendMessage } from './actions';
import { appointmentTime } from './appointments';
import { ChatRefresh } from './chat-refresh';
import type { Catalog } from '../lib/catalog';

export function Chat({ id, side, conversation }: {
  id: string; side: 'business' | 'customer'; conversation: NonNullable<Awaited<ReturnType<Catalog['conversation']>>>;
}) {
  return <section className="card section-gap">
    <h2>Randevu sohbeti</h2>
    <ChatRefresh />
    {conversation.messages.length > 0 ? <ul className="services">{conversation.messages.map((message) => (
      <li key={message.id}><div>
        <strong>{message.sender === 'business' ? 'İşletme' : 'Müşteri'}</strong>
        <small>{appointmentTime(message.sent_at)}</small><p>{message.body}</p>
      </div></li>
    ))}</ul> : <p className="note">Henüz mesaj yok.</p>}
    {conversation.enabled ? <form action={sendMessage.bind(null, id, side)} className="fields">
      <label>Mesaj<textarea name="body" maxLength={1000} rows={3} required /></label>
      <button>Mesaj gönder</button>
    </form> : <p className="note">İşletme sohbeti kapattı.</p>}
  </section>;
}
