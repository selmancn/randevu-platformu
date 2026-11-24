'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CatalogError, sessionSeconds } from '../lib/catalog';
import { getCatalog } from '../lib/database';

const cookieName = 'randevu_musteri';
const field = (form: FormData, name: string) => String(form.get(name) ?? '');

export async function currentCustomer() {
  const token = (await cookies()).get(cookieName)?.value;
  return token ? (await getCatalog()).customer(token) : null;
}

async function authenticate(form: FormData, signup: boolean) {
  let token: string | null;
  const page = signup ? '/hesap?kayit=1&hata=' : '/hesap?hata=';
  try {
    const catalog = await getCatalog();
    const email = field(form, 'email');
    const password = field(form, 'password');
    token = signup ? await catalog.registerCustomer(field(form, 'name'), email, password) :
      await catalog.loginCustomer(email, password);
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    redirect(page + encodeURIComponent(error.message));
  }
  if (!token) redirect(page + encodeURIComponent('E-posta veya parola hatalı.'));
  (await cookies()).set(cookieName, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: sessionSeconds,
    secure: process.env.APPOINTMENT_HTTPS === '1',
  });
  redirect('/');
}

export async function signUpCustomer(form: FormData) {
  await authenticate(form, true);
}

export async function signInCustomer(form: FormData) {
  await authenticate(form, false);
}

export async function signOutCustomer() {
  const jar = await cookies();
  await (await getCatalog()).logoutCustomer(jar.get(cookieName)?.value);
  jar.delete(cookieName);
  redirect('/');
}
