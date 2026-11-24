import { redirect } from 'next/navigation';

export default async function LegacyBusinessSignIn({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const params = await searchParams;
  redirect(params.kayit === '1' ? '/panel?kayit=1' : '/panel');
}
