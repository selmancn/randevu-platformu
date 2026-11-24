import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { Catalog, parsePrice } from '../lib/catalog.ts';
import { discoveryFilters } from '../lib/discovery.ts';

test('fiyat kuruşa çevrilir, geçersiz biçimler reddedilir', () => {
  assert.equal(parsePrice('250,50'), 25050);
  assert.equal(parsePrice('0'), 0);
  for (const value of ['-1', '', '1e2', '15,123']) assert.throws(() => parsePrice(value));
});

test('takvim boş saat sunar ve eşzamanlı rezervasyonda tek onay verir', async () => {
  const db = new PGlite();
  try {
    const catalog = new Catalog(db);
    await catalog.initialize();
    const session = await catalog.register('Takvim Berber', '34', '444', 'takvim@example.test', 'deneme-parola-1');
    const owner = await catalog.owner(session);
    assert.ok(owner);
    await catalog.addService(session, 'Saç', '250', '30');
    const service = (await catalog.profile(owner.slug))!.services[0];
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const weekday = new Date(date).getUTCDay();
    await catalog.setHours(session, String(weekday), '10:00', '11:00');
    assert.deepEqual(await catalog.slots(service.id, date), ['10:00', '10:15', '10:30']);
    const results = await Promise.allSettled([
      catalog.book(service.id, date, '10:00', 'Deneme 1', 'bir@example.test'),
      catalog.book(service.id, date, '10:00', 'Deneme 2', 'iki@example.test'),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const booked = results.find((result) => result.status === 'fulfilled');
    assert.ok(booked);
    assert.equal((await catalog.appointment(booked.value))?.status, 'confirmed');
    await catalog.cancel(booked.value);
    assert.deepEqual(await catalog.slots(service.id, date), ['10:00', '10:15', '10:30']);
    const requestService = await catalog.addService(session, 'Danışma', '100', '');
    assert.equal(requestService, undefined);
    const [consultation] = (await catalog.profile(owner.slug))!.services.filter((entry) => entry.duration === null);
    const visitor = 'a'.repeat(64);
    const request = await catalog.book(consultation.id, date, '12:00', 'Deneme', 'deneme@example.test', 'b'.repeat(64), visitor);
    const appointment = await catalog.appointment(request);
    assert.equal(appointment?.status, 'requested');
    assert.ok(appointment);
    await assert.rejects(() => catalog.leaveReview(request, '5', '4'));
    await assert.rejects(() => catalog.postMessage({ capability: request }, 'Merhaba'));
    await catalog.setChat(session, true);
    await catalog.postMessage({ capability: request }, 'Merhaba');
    assert.equal((await catalog.conversation({ token: session, id: appointment.id }))?.messages[0].body, 'Merhaba');
    await catalog.postMessage({ token: session, id: appointment.id }, 'Hoş geldin');
    assert.equal((await catalog.conversation({ capability: request }))?.messages.length, 2);
    assert.equal(await catalog.conversation({ token: 'invalid', id: appointment.id }), null);
    await catalog.proposeAppointment(session, appointment.id, date, '13:00');
    assert.ok((await catalog.appointment(request))?.proposed_start);
    await catalog.acceptProposal(request);
    assert.equal((await catalog.appointment(request))?.status, 'confirmed');
    await db.query(`UPDATE pilot_appointments SET starts=now()-interval '1 hour', ends=now()-interval '30 minutes' WHERE id=$1`, [appointment.id]);
    await catalog.updateAppointment(session, appointment.id, 'completed');
    await catalog.leaveReview(request, '5', '4');
    await assert.rejects(() => catalog.leaveReview(request, '5', '4'));
    assert.equal((await catalog.ratings(owner.id)).business.average, 5);
    assert.equal((await catalog.ratings(owner.id)).services[consultation.id].average, 4);
    const local = discoveryFilters({ il: '34', ilce: '444' });
    assert.deepEqual((await catalog.discover(local, 'personal', visitor)).map((item) => item.id), [owner.id]);
    assert.deepEqual(await catalog.discover(local, 'personal', 'c'.repeat(64)), []);
    assert.equal((await catalog.discover(local, 'popular'))[0].bookings, 1);
    assert.deepEqual(await catalog.discover(discoveryFilters({ il: '6' }), 'popular'), []);
  } finally {
    await db.close();
  }
});

test('işletme kaydı, oturum ve hizmet izolasyonu gerçek PostgreSQL sorgularıyla çalışır', async () => {
  const db = new PGlite();
  try {
    const catalog = new Catalog(db);
    await catalog.initialize();
    const first = await catalog.register('Birinci Berber', '34', '444', 'bir@example.test', 'deneme-parola-1');
    const second = await catalog.register('İkinci Berber', '34', '444', 'iki@example.test', 'deneme-parola-2');
    const customer = await catalog.registerCustomer('Müşteri', 'bir@example.test', 'musteri-parolasi-1');
    assert.equal((await catalog.customer(customer))?.name, 'Müşteri');
    assert.equal(await catalog.owner(customer), null);
    assert.equal(await catalog.customer(first), null);
    assert.equal(await catalog.loginCustomer('BIR@example.test', 'deneme-parola-1'), null);
    assert.ok(await catalog.loginCustomer('BIR@example.test', 'musteri-parolasi-1'));
    await catalog.logoutCustomer(customer);
    assert.equal(await catalog.customer(customer), null);
    const loggedIn = await catalog.login('BIR@example.test', 'deneme-parola-1');
    assert.ok(loggedIn);
    assert.equal((await catalog.owner(loggedIn))?.id, (await catalog.owner(first))?.id);
    assert.equal(await catalog.login('bir@example.test', 'yanlis'), null);
    await assert.rejects(() => catalog.register('Tekrar', '34', '444', 'bir@example.test', 'deneme-parola-3'));
    await assert.rejects(() => catalog.register('Karışık konum', '6', '444', 'uc@example.test', 'deneme-parola-3'));
    await catalog.addService(first, 'Saç kesimi', '350,25', '30');
    const one = await catalog.owner(first);
    const two = await catalog.owner(second);
    assert.ok(one && two);
    assert.equal((await catalog.profile(one.slug))?.services[0].price, 35025);
    const serviceId = (await catalog.profile(one.slug))!.services[0].id;
    await assert.rejects(() => catalog.editService(second, serviceId, 'Yetkisiz', '100', '20', true));
    await catalog.editService(first, serviceId, 'Saç kesimi', '400', '35', false);
    assert.deepEqual((await catalog.profile(one.slug))?.services, []);
    assert.equal((await catalog.profile(one.slug, true))?.services[0].price, 40000);
    assert.deepEqual((await catalog.profile(two.slug))?.services, []);
    assert.equal((await catalog.discover(discoveryFilters({ il: '34', ilce: '444' }))).length, 2);
    await catalog.setLocation(first, '40,99', '29,03', 'berber');
    await catalog.setLocation(second, '41,16', '29,05', 'dovme');
    const visibleArea = await catalog.discover(discoveryFilters({}), 'list', undefined,
      { south: 40.94, west: 28.99, north: 41.03, east: 29.1 });
    assert.deepEqual(visibleArea.map((item) => item.id), [one.id]);
    assert.equal((await catalog.discover(discoveryFilters({ kategori: 'berber', q: 'SAÇ', fiyat: '350,25', konum: '1' }))).length, 0);
    await catalog.editService(first, serviceId, 'Saç kesimi', '350,25', '30', true);
    assert.equal((await catalog.discover(discoveryFilters({ kategori: 'berber', q: 'SAÇ', fiyat: '350,25', konum: '1' }))).length, 1);
    assert.equal((await catalog.discover(discoveryFilters({ q: 'kuafor', il: '34' }))).length, 1);
    assert.ok((await catalog.suggestions('sac')).includes('Saç kesimi'));
    await catalog.addEntry(first, 'sale', 'Manuel hizmet', '500,00');
    await catalog.addEntry(first, 'expense', 'Malzeme', '125,50');
    const monthly = await catalog.finance(first, 'month');
    assert.equal(monthly.sales, 50000);
    assert.equal(monthly.expenses, 12550);
    assert.equal(monthly.series.find((entry) => entry.kind === 'sale')?.amount, '50000');
    assert.equal((await catalog.finance(first, { from: '2020-01-01', to: '2020-01-02' })).sales, 0);
    assert.equal((await catalog.finance(second, 'month')).sales, 0);
    await assert.rejects(() => catalog.addService('fake-session', 'Sakal', '100', '15'));
    await catalog.logout(first);
    assert.equal(await catalog.owner(first), null);
  } finally {
    await db.close();
  }
});
