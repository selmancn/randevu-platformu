'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CatalogError, sessionSeconds } from '../lib/catalog';
import { getCatalog } from '../lib/database';
import { reportRange } from '../lib/report-range';

const cookieName = 'randevu_session';
const value = (form: FormData, field: string) => String(form.get(field) ?? '');

export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value ?? '';
}

async function authenticate(form: FormData, register: boolean) {
  let token: string | null;
  try {
    const catalog = await getCatalog();
    const email = value(form, 'email');
    const password = value(form, 'password');
    token = register
      ? await catalog.register(value(form, 'name'), value(form, 'province'), value(form, 'district'), email, password)
      : await catalog.login(email, password);
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    redirect('/panel?hata=' + encodeURIComponent(error.message) + '&kayit=1');
  }
  if (!token) redirect('/panel?hata=' + encodeURIComponent('E-posta veya parola hatalı.'));
  (await cookies()).set(cookieName, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: sessionSeconds,
    secure: process.env.APPOINTMENT_HTTPS === '1',
  });
  redirect('/panel');
}

export async function login(form: FormData) {
  return authenticate(form, false);
}

export async function register(form: FormData) {
  return authenticate(form, true);
}

export async function logout() {
  await (await getCatalog()).logout(await sessionToken());
  (await cookies()).delete(cookieName);
  redirect('/panel');
}

export async function addService(form: FormData) {
  try {
    await (await getCatalog()).addService(await sessionToken(), value(form, 'name'),
      value(form, 'price'), value(form, 'duration'));
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    redirect('/panel?hata=' + encodeURIComponent(error.message));
  }
  redirect('/panel?kaydedildi=1');
}

export async function editService(id: string, form: FormData) {
  await panelAction(async () => (await getCatalog()).editService(await sessionToken(), id,
    value(form, 'name'), value(form, 'price'), value(form, 'duration'), value(form, 'active') === '1'));
}

export async function setHours(form: FormData) {
  await panelAction(async () => (await getCatalog()).setHours(await sessionToken(),
    value(form, 'weekday'), value(form, 'opens'), value(form, 'closes')));
}

export async function updateAppointment(form: FormData) {
  await panelAction(async () => (await getCatalog()).updateAppointment(await sessionToken(),
    value(form, 'id'), value(form, 'status')));
}

export async function proposeAppointment(id: string, form: FormData) {
  await panelAction(async () => (await getCatalog()).proposeAppointment(await sessionToken(), id,
    value(form, 'day'), value(form, 'time')));
}

export async function acceptProposal(id: string, expectedStart: string) {
  await panelAction(async () => {
    const capability = (await cookies()).get(`randevu_${id}`)?.value ?? '';
    await (await getCatalog()).acceptProposal(capability, expectedStart);
  }, `/randevu/${encodeURIComponent(id)}`);
}

export async function addEntry(form: FormData) {
  let path = '/panel/rapor';
  if (form.has('baslangic') || form.has('bitis')) {
    try {
      const { from, to } = reportRange({ baslangic: form.get('baslangic'), bitis: form.get('bitis') });
      path += '?' + new URLSearchParams({ baslangic: from, bitis: to });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  await panelAction(async () => (await getCatalog()).addEntry(await sessionToken(),
    value(form, 'kind'), value(form, 'label'), value(form, 'amount')), path);
}

async function panelAction(operation: () => Promise<void>, path = '/panel') {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    redirect(path + (path.includes('?') ? '&' : '?') + 'hata=' + encodeURIComponent(error.message));
  }
  redirect(path);
}

export async function bookService(slug: string, service: string, day: string, capability: string, form: FormData) {
  const jar = await cookies();
  const previousVisitor = jar.get('randevu_ziyaretci')?.value ?? '';
  const visitor = /^[a-f0-9]{64}$/.test(previousVisitor) ? previousVisitor : randomBytes(32).toString('hex');
  try {
    await (await getCatalog()).book(service, day, value(form, 'time'), value(form, 'customer'), value(form, 'email'), capability, visitor);
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    const query = new URLSearchParams({ hizmet: service, gun: day, hata: error.message });
    redirect(`/isletme/${encodeURIComponent(slug)}?${query}#randevu`);
  }
  const { id } = (await (await getCatalog()).appointment(capability))!;
  jar.set('randevu_ziyaretci', visitor, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 365 * 86400,
    secure: process.env.APPOINTMENT_HTTPS === '1',
  });
  jar.set(`randevu_${id}`, capability, {
    httpOnly: true, sameSite: 'lax', path: '/randevu', maxAge: 90 * 86400,
    secure: process.env.APPOINTMENT_HTTPS === '1',
  });
  redirect(`/randevu/${id}`);
}

export async function cancelBooking(id: string) {
  const capability = (await cookies()).get(`randevu_${id}`)?.value;
  if (capability) await (await getCatalog()).cancel(capability);
  redirect(`/randevu/${encodeURIComponent(id)}`);
}

export async function setChat(form: FormData) {
  await panelAction(async () => (await getCatalog()).setChat(await sessionToken(), value(form, 'enabled') === '1'));
}

export async function setLocation(form: FormData) {
  await panelAction(async () => (await getCatalog()).setLocation(await sessionToken(), value(form, 'latitude'),
    value(form, 'longitude'), form.has('category') ? value(form, 'category') : undefined,
    { provinceId: value(form, 'province'), districtId: value(form, 'district') }));
}

export async function reviewBooking(id: string, form: FormData) {
  await panelAction(async () => {
    const capability = (await cookies()).get(`randevu_${id}`)?.value ?? '';
    await (await getCatalog()).leaveReview(capability, value(form, 'business'), value(form, 'service'));
  }, `/randevu/${encodeURIComponent(id)}`);
}

export async function sendMessage(id: string, side: 'business' | 'customer', form: FormData) {
  await panelAction(async () => {
    const access = side === 'business' ? { token: await sessionToken(), id } :
      { capability: (await cookies()).get(`randevu_${id}`)?.value ?? '' };
    await (await getCatalog()).postMessage(access, value(form, 'body'));
  }, `${side === 'business' ? '/panel/sohbet' : '/randevu'}/${encodeURIComponent(id)}`);
}
