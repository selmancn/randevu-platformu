import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCatalog } from '../../../../lib/database';
import { sessionToken } from '../../../actions';
import { Chat } from '../../../chat';

export default async function OwnerChat({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const token = await sessionToken();
  if (!token) redirect('/panel');
  const conversation = await (await getCatalog()).conversation({ id, token });
  if (!conversation) notFound();
  return <main className="wrap page profile">
    <Link href="/panel">İşletme paneli</Link>
    <h1>{conversation.service}</h1>
    {hata && <p role="alert" className="error">{hata}</p>}
    <Chat id={id} side="business" conversation={conversation} />
  </main>;
}
