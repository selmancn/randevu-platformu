import { redirect } from 'next/navigation';
import Discover from './kesfet/page';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const params = await searchParams;
  if (params.kayit === '1' || typeof params.hata === 'string') {
    const query = new URLSearchParams();
    if (params.kayit === '1') query.set('kayit', '1');
    if (typeof params.hata === 'string') query.set('hata', params.hata);
    redirect(`/panel?${query}`);
  }
  return <Discover searchParams={searchParams} />;
}
