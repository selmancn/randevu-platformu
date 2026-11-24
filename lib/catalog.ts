import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { categories, discoveryFilters, searchCategory, type Category } from './discovery.ts';
import { reportRange, type ReportRange } from './report-range.ts';
import { districts, foldSearch, locationSelection, provinces } from './locations.ts';
import type { MapBounds } from './map-region.ts';
type Query = <Row extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
type Database = {
  query: Query;
  exec(sql: string): Promise<unknown>;
  transaction<T>(operation: (tx: { query: Query }) => Promise<T>): Promise<T>;
};

const derive = promisify(scrypt);
export const sessionSeconds = 60 * 60 * 24 * 7;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export class CatalogError extends Error {}

export function parsePrice(input: string) {
  const value = input.trim();
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(value)) {
    throw new CatalogError('Fiyatı 350,50 biçiminde gir.');
  }
  const [lira, pennies = ''] = value.split(/[,.]/);
  return Number(lira) * 100 + Number(pennies.padEnd(2, '0'));
}

type Business = { id: string; slug: string; name: string; district: string; latitude: number | null; longitude: number | null; category: Category;
  district_id: number | null; province_id: number | null; province: string | null };
export type Listing = Business & { count: number; low: number | null; score: number | null; review_count: number; total: number; bookings: number };
type DiscoverMode = 'list' | 'popular' | 'personal';
const foldSql = (column: string) => `translate(lower(translate(${column}, 'İIıÇĞÖŞÜ', 'iiicgosu')), 'çğöşü', 'cgosu')`;
const validVisitor = /^[a-f0-9]{64}$/;
export type Service = { id: string; name: string; price: number; duration: number | null; active: boolean };
type Hours = { weekday: number; opens: string; closes: string };
type Appointment = {
  id: string; customer: string; email: string; service_name: string; price: number;
  starts: string; ends: string; status: 'requested' | 'confirmed' | 'cancelled' | 'completed';
  proposed_start: string | null;
};
type Entry = { id: string; kind: 'sale' | 'payment' | 'expense' | 'refund'; label: string; amount: number; recorded_at: string };
type ConversationAccess = { capability: string } | { token: string; id: string };
type Message = { id: string; sender: 'business' | 'customer'; body: string; sent_at: string };
type Rating = { average: number; count: number };
const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const validId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const timeText = (count: number) => `${String(Math.floor(count / 60)).padStart(2, '0')}:${String(count % 60).padStart(2, '0')}`;
const dayAt = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`);

function serviceDetails(name: string, priceInput: string, durationInput: string) {
  name = name.trim();
  if (!name || name.length > 100) throw new CatalogError('Hizmet adı 1–100 karakter olmalı.');
  const price = parsePrice(priceInput);
  const duration = durationInput === '' ? null : Number(durationInput);
  if (duration !== null && (!/^\d+$/.test(durationInput) || duration < 5 || duration > 720)) {
    throw new CatalogError('Süre 5–720 dakika olmalı veya boş bırakılmalı.');
  }
  return { name, price, duration };
}

function bookingDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new CatalogError('Geçerli bir gün seç.');
  const value = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(+value) || value.toISOString().slice(0, 10) !== day ||
      +value < Date.now() - 86400000 || +value > Date.now() + 60 * 86400000) {
    throw new CatalogError('Önümüzdeki 60 gün içinde bir gün seç.');
  }
  return value;
}

export class Catalog {
  readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async initialize() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ref_provinces (id integer PRIMARY KEY, name text NOT NULL);
      CREATE TABLE IF NOT EXISTS ref_districts (
        id integer PRIMARY KEY, province_id integer NOT NULL REFERENCES ref_provinces(id), name text NOT NULL, normalized_name text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pilot_businesses (
        id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL,
        district text NOT NULL, email text NOT NULL UNIQUE, salt text NOT NULL,
        password_hash text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pilot_sessions (
        token_hash text PRIMARY KEY, business_id uuid REFERENCES pilot_businesses(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pilot_customers (
        id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
        salt text NOT NULL, password_hash text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pilot_customer_sessions (
        token_hash text PRIMARY KEY, customer_id uuid NOT NULL REFERENCES pilot_customers(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      );
      ALTER TABLE pilot_businesses ADD COLUMN IF NOT EXISTS latitude double precision CHECK (latitude BETWEEN -90 AND 90);
      ALTER TABLE pilot_businesses ADD COLUMN IF NOT EXISTS longitude double precision CHECK (longitude BETWEEN -180 AND 180);
      ALTER TABLE pilot_businesses ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'diger'
        CHECK (category IN ('berber','dovme','oto','diger'));
      ALTER TABLE pilot_businesses ADD COLUMN IF NOT EXISTS district_id integer REFERENCES ref_districts(id);
      CREATE INDEX IF NOT EXISTS pilot_businesses_district ON pilot_businesses(district_id);
      CREATE INDEX IF NOT EXISTS pilot_businesses_coordinates ON pilot_businesses(latitude,longitude)
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
      CREATE TABLE IF NOT EXISTS pilot_services (
        id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES pilot_businesses(id) ON DELETE CASCADE,
        name text NOT NULL, price integer NOT NULL CHECK (price >= 0),
        duration integer CHECK (duration BETWEEN 5 AND 720), created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS pilot_services_business ON pilot_services (business_id);
      ALTER TABLE pilot_services ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
      CREATE TABLE IF NOT EXISTS pilot_hours (
        business_id uuid NOT NULL REFERENCES pilot_businesses(id) ON DELETE CASCADE,
        weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        opens time NOT NULL, closes time NOT NULL CHECK (closes > opens),
        PRIMARY KEY (business_id, weekday)
      );
      CREATE TABLE IF NOT EXISTS pilot_appointments (
        id uuid PRIMARY KEY, capability_hash text NOT NULL UNIQUE,
        business_id uuid NOT NULL REFERENCES pilot_businesses(id),
        service_id uuid NOT NULL REFERENCES pilot_services(id),
        service_name text NOT NULL, price integer NOT NULL CHECK (price >= 0),
        customer text NOT NULL, email text NOT NULL, starts timestamptz NOT NULL,
        ends timestamptz NOT NULL CHECK (ends > starts),
        status text NOT NULL CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed'))
      );
      CREATE INDEX IF NOT EXISTS pilot_appointments_business ON pilot_appointments (business_id, starts);
      ALTER TABLE pilot_appointments ADD COLUMN IF NOT EXISTS proposed_start timestamptz;
      ALTER TABLE pilot_appointments ADD COLUMN IF NOT EXISTS visitor_hash text;
      ALTER TABLE pilot_appointments ADD COLUMN IF NOT EXISTS booked_category text
        CHECK (booked_category IN ('berber','dovme','oto','diger'));
      ALTER TABLE pilot_appointments ADD COLUMN IF NOT EXISTS booked_at timestamptz;
      ALTER TABLE pilot_appointments ALTER COLUMN booked_at SET DEFAULT now();
      CREATE INDEX IF NOT EXISTS pilot_appointments_visitor ON pilot_appointments(visitor_hash) WHERE visitor_hash IS NOT NULL;
      CREATE TABLE IF NOT EXISTS pilot_finance (
        id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES pilot_businesses(id),
        appointment_id uuid UNIQUE REFERENCES pilot_appointments(id),
        kind text NOT NULL CHECK (kind IN ('sale','payment','expense','refund')),
        label text NOT NULL, amount integer NOT NULL CHECK (amount >= 0),
        recorded_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS pilot_finance_business ON pilot_finance (business_id, recorded_at DESC);
      CREATE TABLE IF NOT EXISTS pilot_chat_settings (
        business_id uuid PRIMARY KEY REFERENCES pilot_businesses(id), enabled boolean NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pilot_messages (
        id uuid PRIMARY KEY, appointment_id uuid NOT NULL REFERENCES pilot_appointments(id),
        sender text NOT NULL CHECK (sender IN ('business','customer')),
        body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
        sent_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS pilot_messages_timeline ON pilot_messages (appointment_id,sent_at DESC,id);
      CREATE TABLE IF NOT EXISTS pilot_reviews (
        appointment_id uuid PRIMARY KEY REFERENCES pilot_appointments(id),
        business_score smallint NOT NULL CHECK (business_score BETWEEN 1 AND 5),
        service_score smallint NOT NULL CHECK (service_score BETWEEN 1 AND 5)
      );
    `);
    await this.db.transaction(async ({ query }) => {
      await query(`
        INSERT INTO ref_provinces SELECT * FROM json_to_recordset($1) AS p(id integer,name text)
        ON CONFLICT (id) DO NOTHING
      `, [JSON.stringify(provinces)]);
      await query(`
        INSERT INTO ref_districts
        SELECT id, "provinceId", name, folded
        FROM json_to_recordset($1) AS d(id integer,"provinceId" integer,name text,folded text)
        ON CONFLICT (id) DO NOTHING
      `, [JSON.stringify(districts.map((item) => ({ ...item, folded: foldSearch(item.name) })))]);
      await query(`
        UPDATE pilot_businesses b SET district_id=known.id, district=known.name
        FROM (
          SELECT normalized_name,min(id) AS id,min(name) AS name FROM ref_districts
          GROUP BY normalized_name HAVING count(*)=1
        ) known WHERE b.district_id IS NULL AND ${foldSql('trim(b.district)')}=known.normalized_name
      `);
    });
  }

  async register(name: string, provinceId: string, districtId: string, email: string, password: string) {
    name = name.trim();
    const location = locationSelection(provinceId, districtId);
    if (!location) throw new CatalogError('Listeden bir il ve o ile ait bir ilçe seç.');
    email = email.trim().toLowerCase();
    if (!name || name.length > 80 ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 12 || password.length > 128) {
      throw new CatalogError('Bilgileri kontrol et. Parola 12–128 karakter olmalı.');
    }
    const id = randomUUID();
    const slugBase = name.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD')
      .replace(/\p{Mark}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase || 'isletme'}-${id.slice(0, 8)}`;
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await derive(password, salt, 64) as Buffer).toString('hex');
    const token = randomBytes(32).toString('hex');
    await this.db.transaction(async (tx) => {
      const inserted = await tx.query<{ id: string }>(`
        INSERT INTO pilot_businesses (id, slug, name, district, email, salt, password_hash, district_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO NOTHING RETURNING id
      `, [id, slug, name, location.district.name, email, salt, passwordHash, location.district.id]);
      if (!inserted.rows.length) throw new CatalogError('Bu e-posta ile bir hesap var.');
      await tx.query('INSERT INTO pilot_sessions VALUES ($1, $2, $3)',
        [tokenHash(token), id, new Date(Date.now() + sessionSeconds * 1000).toISOString()]);
    });
    return token;
  }

  async login(email: string, password: string) {
    if (email.length > 254 || password.length > 128) return null;
    const result = await this.db.query<{ id: string; salt: string; password_hash: string }>(
      'SELECT id, salt, password_hash FROM pilot_businesses WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    const derived = await derive(password, user?.salt ?? '0'.repeat(32), 64) as Buffer;
    if (!user || !timingSafeEqual(derived, Buffer.from(user.password_hash, 'hex'))) return null;
    const token = randomBytes(32).toString('hex');
    await this.db.query('INSERT INTO pilot_sessions VALUES ($1, $2, $3)',
      [tokenHash(token), user.id, new Date(Date.now() + sessionSeconds * 1000).toISOString()]);
    return token;
  }

  async registerCustomer(name: string, email: string, password: string) {
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name || name.length > 80 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 12 || password.length > 128) {
      throw new CatalogError('Bilgileri kontrol et. Parola 12–128 karakter olmalı.');
    }
    const id = randomUUID();
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await derive(password, salt, 64) as Buffer).toString('hex');
    return this.db.transaction(async ({ query }) => {
      const { rows } = await query(`
        INSERT INTO pilot_customers (id,name,email,salt,password_hash) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (email) DO NOTHING RETURNING id
      `, [id, name, email, salt, passwordHash]);
      if (!rows.length) throw new CatalogError('Bu e-posta ile bir müşteri hesabı var. Giriş yapabilirsin.');
      return this.openCustomerSession(query, id);
    });
  }

  private async openCustomerSession(query: Query, id: string) {
    const token = randomBytes(32).toString('hex');
    await query('INSERT INTO pilot_customer_sessions VALUES ($1,$2,$3)',
      [tokenHash(token), id, new Date(Date.now() + sessionSeconds * 1000).toISOString()]);
    return token;
  }

  async loginCustomer(email: string, password: string) {
    if (email.length > 254 || password.length > 128) return null;
    const { rows: [customer] } = await this.db.query<{ id: string; salt: string; password_hash: string }>(
      'SELECT id,salt,password_hash FROM pilot_customers WHERE email=$1', [email.trim().toLowerCase()],
    );
    const candidate = await derive(password, customer?.salt ?? '0'.repeat(32), 64) as Buffer;
    if (!customer || !timingSafeEqual(candidate, Buffer.from(customer.password_hash, 'hex'))) return null;
    return this.openCustomerSession(this.db.query.bind(this.db), customer.id);
  }

  async customer(token = '') {
    if (!validVisitor.test(token)) return null;
    const { rows: [customer] } = await this.db.query<{ name: string; email: string }>(`
      SELECT c.name,c.email FROM pilot_customers c JOIN pilot_customer_sessions s ON s.customer_id=c.id
      WHERE s.token_hash=$1 AND s.expires_at>now()
    `, [tokenHash(token)]);
    return customer ?? null;
  }

  async logoutCustomer(token = '') {
    if (validVisitor.test(token)) await this.db.query('DELETE FROM pilot_customer_sessions WHERE token_hash=$1', [tokenHash(token)]);
  }

  async owner(token = '') {
    const result = await this.db.query<Business>(`
      SELECT b.id,b.slug,b.name,b.district,b.latitude,b.longitude,b.category,b.district_id,d.province_id,p.name AS province FROM pilot_businesses b
      JOIN pilot_sessions s ON s.business_id = b.id
      LEFT JOIN ref_districts d ON d.id=b.district_id LEFT JOIN ref_provinces p ON p.id=d.province_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `, [tokenHash(token)]);
    return result.rows[0] ?? null;
  }

  async logout(token = '') {
    await this.db.query('DELETE FROM pilot_sessions WHERE token_hash = $1', [tokenHash(token)]);
  }

  async addService(token: string, name: string, priceInput: string, durationInput: string) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş. Yeniden giriş yap.');
    const details = serviceDetails(name, priceInput, durationInput);
    await this.db.query(
      'INSERT INTO pilot_services (id, business_id, name, price, duration) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), owner.id, details.name, details.price, details.duration],
    );
  }

  async editService(token: string, id: string, name: string, priceInput: string, durationInput: string, active: boolean) {
    const owner = await this.owner(token);
    if (!owner || !validId.test(id)) throw new CatalogError('Hizmet bulunamadı.');
    const details = serviceDetails(name, priceInput, durationInput);
    await this.db.transaction(async ({ query }) => {
      await query('SELECT id FROM pilot_businesses WHERE id=$1 FOR UPDATE', [owner.id]);
      const { rows } = await query(`
        UPDATE pilot_services SET name=$3, price=$4, duration=$5, active=$6
        WHERE id=$1 AND business_id=$2 RETURNING id
      `, [id, owner.id, details.name, details.price, details.duration, active]);
      if (!rows.length) throw new CatalogError('Hizmet bulunamadı.');
    });
  }

  async profile(slug: string, includeInactive = false) {
    const result = await this.db.query<Business>(
      `SELECT b.id,b.slug,b.name,b.district,b.latitude,b.longitude,b.category,b.district_id,d.province_id,p.name AS province
       FROM pilot_businesses b LEFT JOIN ref_districts d ON d.id=b.district_id LEFT JOIN ref_provinces p ON p.id=d.province_id
       WHERE b.slug=$1`, [slug],
    );
    const business = result.rows[0];
    if (!business) return null;
    const services = await this.db.query<Service>(
      'SELECT id, name, price, duration, active FROM pilot_services WHERE business_id=$1 AND (active OR $2) ORDER BY created_at,id',
      [business.id, includeInactive],
    );
    return { ...business, services: services.rows };
  }

  async discover(filters: ReturnType<typeof discoveryFilters>, mode: DiscoverMode = 'list', visitor?: string,
    bounds?: MapBounds) {
    const visitorHash = visitor && validVisitor.test(visitor) ? tokenHash(visitor) : null;
    if (mode === 'personal' && !visitorHash) return [];
    const orders = {
      onerilen: '(count > 0) DESC, (latitude IS NOT NULL AND longitude IS NOT NULL) DESC, review_count DESC, count DESC',
      puan: 'score DESC NULLS LAST, review_count DESC',
      'fiyat-artan': 'low ASC NULLS LAST',
      'fiyat-azalan': 'low DESC NULLS LAST',
    };
    const order = mode === 'popular' ? 'bookings DESC, score DESC NULLS LAST' :
      mode === 'personal' ? 'preference DESC, bookings DESC, score DESC NULLS LAST' : orders[filters.sort];
    const region = mode === 'list' ? filters : { ...filters, category: '', query: '', maxPrice: null, located: false };
    return (await this.db.query<Listing>(`
      WITH preferred AS (
        SELECT coalesce(a.booked_category,b.category) AS category,count(*)::int AS preference FROM pilot_appointments a
        JOIN pilot_businesses b ON b.id=a.business_id WHERE $7::text IS NOT NULL AND a.visitor_hash=$7
          AND a.status='completed' AND a.starts >= now() - interval '365 days' GROUP BY 1
      ), matches AS (
        SELECT b.id,b.slug,b.name,b.district,b.latitude,b.longitude,b.category,b.district_id,d.province_id,
          p.name AS province,s.count,s.low,r.score,r.review_count,coalesce(popular.bookings,0) AS bookings,
          coalesce(preferred.preference,0) AS preference
        FROM pilot_businesses b
        LEFT JOIN ref_districts d ON d.id=b.district_id
        LEFT JOIN ref_provinces p ON p.id=d.province_id
        LEFT JOIN preferred ON preferred.category=b.category
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS count,min(price) AS low FROM pilot_services WHERE business_id=b.id AND active
        ) s
        CROSS JOIN LATERAL (
          SELECT avg(r.business_score)::float AS score,count(*)::int AS review_count FROM pilot_reviews r
          JOIN pilot_appointments a ON a.id=r.appointment_id WHERE a.business_id=b.id
        ) r
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS bookings FROM pilot_appointments a WHERE a.business_id=b.id
            AND a.status IN ('confirmed','completed')
            AND coalesce(a.booked_at,a.starts) BETWEEN now() - interval '30 days' AND now()
        ) popular ON $8 <> 'list'
        WHERE ($1::int IS NULL OR d.province_id=$1) AND ($6::int IS NULL OR b.district_id=$6)
          AND ($12::float IS NULL OR (
            b.latitude BETWEEN $12::float AND $13::float AND
            CASE WHEN $14::float <= $15::float THEN b.longitude BETWEEN $14::float AND $15::float
              ELSE b.longitude >= $14::float OR b.longitude <= $15::float END
          ))
          AND ($2 = '' OR b.category=$2)
          AND ($3::int IS NULL OR s.low <= $3)
          AND (NOT $4::boolean OR (b.latitude IS NOT NULL AND b.longitude IS NOT NULL))
          AND ($5 = '' OR b.category=$11::text OR strpos(${foldSql('b.name')}, $5) > 0
               OR EXISTS (SELECT 1 FROM pilot_services WHERE business_id=b.id AND active
                 AND strpos(${foldSql('name')}, $5) > 0))
      )
      SELECT *,count(*) OVER ()::int AS total FROM matches
      WHERE ($8 <> 'popular' OR bookings>0) AND ($8 <> 'personal' OR (preference>0 AND count>0))
      ORDER BY ${order}, name, id LIMIT $9 OFFSET $10
    `, [region.provinceId, region.category, region.maxPrice, region.located, foldSearch(region.query), region.districtId,
      mode === 'personal' ? visitorHash : null, mode, bounds ? 100 : mode === 'list' ? 24 : 4,
      mode === 'list' && !bounds ? (filters.page - 1) * 24 : 0,
      searchCategory(region.query), bounds?.south ?? null, bounds?.north ?? null, bounds?.west ?? null, bounds?.east ?? null])).rows;
  }

  async suggestions(text: string) {
    const query = foldSearch(text.trim().slice(0, 80));
    if (query.length < 2) return [];
    const { rows } = await this.db.query<{ label: string }>(`
      SELECT label FROM (
        SELECT name AS label FROM pilot_services WHERE active AND strpos(${foldSql('name')}, $1)>0
        UNION SELECT name AS label FROM pilot_businesses WHERE strpos(${foldSql('name')}, $1)>0
      ) combined ORDER BY (strpos(${foldSql('label')}, $1)=1) DESC, length(label), label LIMIT 7
    `, [query]);
    return rows.map((row) => row.label);
  }

  async setLocation(token: string, latitude: string, longitude: string, category?: string,
    selection?: { provinceId: string; districtId: string }) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş.');
    const pair = [latitude.trim(), longitude.trim()];
    const clear = pair.every((item) => item === '');
    const [lat, lon] = pair.map((value) => Number(value.replace(',', '.')));
    if (!clear && (!pair.every((item) => /^-?\d{1,3}(?:[.,]\d{1,8})?$/.test(item)) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180)) {
      throw new CatalogError('Enlem ve boylamı kontrol et. İkisini boş bırakarak konumu kaldırabilirsin.');
    }
    if (category !== undefined && !Object.hasOwn(categories, category)) throw new CatalogError('Geçerli kategori seç.');
    const location = selection && locationSelection(selection.provinceId, selection.districtId);
    if (selection && !location) throw new CatalogError('Listeden geçerli bir il ve ilçe seç.');
    await this.db.query(`UPDATE pilot_businesses SET latitude=$2,longitude=$3,category=coalesce($4,category),
      district_id=coalesce($5,district_id),district=coalesce($6,district) WHERE id=$1`,
    [owner.id, clear ? null : lat, clear ? null : lon, category ?? null, location?.district.id ?? null, location?.district.name ?? null]);
  }

  async addEntry(token: string, kind: string, label: string, input: string) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş.');
    label = label.trim();
    if (!['sale','payment','expense','refund'].includes(kind) || !label || label.length > 120) {
      throw new CatalogError('Kayıt türünü ve açıklamayı kontrol et.');
    }
    const amount = parsePrice(input);
    if (amount <= 0) throw new CatalogError('Tutar sıfırdan büyük olmalı.');
    await this.db.query(`
      INSERT INTO pilot_finance (id,business_id,kind,label,amount) VALUES ($1,$2,$3,$4,$5)
    `, [randomUUID(), owner.id, kind, label, amount]);
  }

  async leaveReview(capability: string, business: string, service: string) {
    if (!/^[1-5]$/.test(business) || !/^[1-5]$/.test(service)) throw new CatalogError('Her iki puanı da seç.');
    const { rows } = await this.db.query(`
      INSERT INTO pilot_reviews (appointment_id,business_score,service_score)
      SELECT id,$2,$3 FROM pilot_appointments WHERE capability_hash=$1 AND status='completed'
      ON CONFLICT (appointment_id) DO NOTHING RETURNING appointment_id
    `, [tokenHash(capability), Number(business), Number(service)]);
    if (!rows.length) throw new CatalogError('Bu randevu şu anda değerlendirilemiyor.');
  }

  async reviewed(id: string) {
    const { rows } = await this.db.query('SELECT 1 FROM pilot_reviews WHERE appointment_id=$1', [id]);
    return rows.length > 0;
  }

  async ratings(businessId: string) {
    const { rows } = await this.db.query<{ service_id: string | null; average: number; count: number }>(`
      SELECT a.service_id, (CASE WHEN GROUPING(a.service_id)=1 THEN avg(r.business_score)
        ELSE avg(r.service_score) END)::float AS average, count(*)::int AS count
      FROM pilot_reviews r JOIN pilot_appointments a ON a.id = r.appointment_id
      WHERE a.business_id=$1 GROUP BY GROUPING SETS ((a.service_id), ())
    `, [businessId]);
    const business = rows.find((row) => row.service_id === null);
    const services: Record<string, Rating> = Object.fromEntries(rows.filter((row) => row.service_id).map((row) => [
      row.service_id, { average: row.average, count: row.count },
    ]));
    return { business: { average: business?.average ?? 0, count: business?.count ?? 0 }, services };
  }

  async chatEnabled(businessId: string) {
    const { rows } = await this.db.query<{ enabled: boolean }>('SELECT enabled FROM pilot_chat_settings WHERE business_id=$1', [businessId]);
    return rows[0]?.enabled ?? false;
  }

  async setChat(token: string, enabled: boolean) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş.');
    await this.db.transaction(async ({ query }) => {
      await query('SELECT id FROM pilot_businesses WHERE id=$1 FOR UPDATE', [owner.id]);
      await query(`
        INSERT INTO pilot_chat_settings VALUES ($1,$2)
        ON CONFLICT (business_id) DO UPDATE SET enabled=EXCLUDED.enabled
      `, [owner.id, enabled]);
    });
  }

  private async chatParticipant(access: ConversationAccess, query: Query) {
    if ('capability' in access) {
      const { rows } = await query<{ id: string; business_id: string; service_name: string }>(
        'SELECT id,business_id,service_name FROM pilot_appointments WHERE capability_hash=$1',
        [tokenHash(access.capability)],
      );
      return rows[0] && { ...rows[0], sender: 'customer' as const };
    }
    if (!validId.test(access.id)) return null;
    const { rows } = await query<{ id: string; business_id: string; service_name: string }>(`
      SELECT a.id,a.business_id,a.service_name FROM pilot_appointments a
      JOIN pilot_sessions s ON s.business_id=a.business_id
      WHERE a.id=$1 AND s.token_hash=$2 AND s.expires_at > now()
    `, [access.id, tokenHash(access.token)]);
    return rows[0] && { ...rows[0], sender: 'business' as const };
  }

  async conversation(access: ConversationAccess) {
    const participant = await this.chatParticipant(access, this.db.query.bind(this.db));
    if (!participant) return null;
    const [enabled, { rows }] = await Promise.all([
      this.chatEnabled(participant.business_id),
      this.db.query<Message>(`
        SELECT id,sender,body,sent_at FROM pilot_messages WHERE appointment_id=$1 ORDER BY sent_at DESC,id LIMIT 50
      `, [participant.id]),
    ]);
    return { service: participant.service_name, messages: rows.reverse(), enabled };
  }

  async postMessage(access: ConversationAccess, body: string) {
    body = body.trim();
    if (!body || body.length > 1000) throw new CatalogError('Mesaj 1–1000 karakter olmalı.');
    await this.db.transaction(async ({ query }) => {
      const participant = await this.chatParticipant(access, query);
      if (!participant) throw new CatalogError('Sohbet bulunamadı.');
      await query('SELECT id FROM pilot_businesses WHERE id=$1 FOR UPDATE', [participant.business_id]);
      const { rows } = await query<{ enabled: boolean }>('SELECT enabled FROM pilot_chat_settings WHERE business_id=$1', [participant.business_id]);
      if (!rows[0]?.enabled) throw new CatalogError('İşletme sohbeti kapattı.');
      const recent = await query(`
        SELECT 1 FROM pilot_messages WHERE appointment_id=$1 AND sender=$2 AND sent_at > now() - interval '2 seconds' LIMIT 1
      `, [participant.id, participant.sender]);
      if (recent.rows.length) throw new CatalogError('Yeni mesaj için birkaç saniye bekle.');
      await query('INSERT INTO pilot_messages (id,appointment_id,sender,body) VALUES ($1,$2,$3,$4)',
        [randomUUID(), participant.id, participant.sender, body]);
    });
  }

  async finance(token: string, period: 'day' | 'month' | ReportRange, exportAll = false) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş.');
    return this.db.transaction(async ({ query }) => {
      await query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const range = typeof period === 'string' ? reportRange({ donem: period === 'day' ? 'gun' : 'ay' }) : period;
      const start = dayAt(range.from, '00:00');
      const end = new Date(+dayAt(range.to, '00:00') + 86400000);
      const params = [owner.id, start.toISOString(), end.toISOString()];
      const filter = 'business_id = $1 AND recorded_at >= $2 AND recorded_at < $3';
      const { rows } = await query<Entry>(`
        SELECT id,kind,label,amount,recorded_at FROM pilot_finance WHERE ${filter}
        ORDER BY recorded_at DESC,id LIMIT ${exportAll ? '10000' : '100'}
      `, params);
      const totals = await query<{ kind: Entry['kind']; amount: string; count: string }>(`
        SELECT kind, sum(amount)::text AS amount, count(*)::text AS count
        FROM pilot_finance WHERE ${filter} GROUP BY kind
      `, params);
      const { rows: byService } = await query<{ label: string; amount: string; count: number }>(`
        SELECT label, sum(amount)::text AS amount, count(*)::int AS count
        FROM pilot_finance WHERE ${filter} AND kind='sale'
        GROUP BY label ORDER BY sum(amount) DESC, label LIMIT 100
      `, params);
      const amounts = new Map(totals.rows.map((row) => [row.kind, Number(row.amount)]));
      const { rows: series } = await query<{ day: string; kind: Entry['kind']; amount: string }>(`
        SELECT to_char(recorded_at AT TIME ZONE 'Europe/Istanbul','YYYY-MM-DD') AS day,kind,sum(amount)::text AS amount
        FROM pilot_finance WHERE ${filter} GROUP BY 1,2 ORDER BY 1,2
      `, params);
      return {
        sales: amounts.get('sale') ?? 0,
        payments: amounts.get('payment') ?? 0,
        expenses: amounts.get('expense') ?? 0,
        refunds: amounts.get('refund') ?? 0,
        count: Number(totals.rows.find((row) => row.kind === 'sale')?.count ?? 0),
        rows,
        byService,
        series,
      };
    });
  }

  async hours(businessId: string) {
    return (await this.db.query<Hours>(`
      SELECT weekday, to_char(opens, 'HH24:MI') AS opens, to_char(closes, 'HH24:MI') AS closes
      FROM pilot_hours WHERE business_id = $1 ORDER BY weekday
    `, [businessId])).rows;
  }

  async setHours(token: string, weekday: string, opens: string, closes: string) {
    const owner = await this.owner(token);
    if (!owner) throw new CatalogError('Oturum süren dolmuş.');
    if (!/^[0-6]$/.test(weekday) || !validTime.test(opens) || !validTime.test(closes) || opens >= closes) {
      throw new CatalogError('Açılış ve kapanış saatlerini kontrol et.');
    }
    await this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM pilot_businesses WHERE id = $1 FOR UPDATE', [owner.id]);
      await tx.query(`
        INSERT INTO pilot_hours VALUES ($1, $2, $3, $4)
        ON CONFLICT (business_id, weekday) DO UPDATE SET opens = EXCLUDED.opens, closes = EXCLUDED.closes
      `, [owner.id, Number(weekday), opens, closes]);
    });
  }

  private async service(query: Query, id: string) {
    if (!validId.test(id)) throw new CatalogError('Hizmet bulunamadı.');
    const { rows } = await query<Service & { business_id: string; category: Category }>(
      `SELECT s.id,s.business_id,s.name,s.price,s.duration,s.active,b.category
       FROM pilot_services s JOIN pilot_businesses b ON b.id=s.business_id WHERE s.id=$1 AND s.active`, [id],
    );
    if (!rows[0]) throw new CatalogError('Hizmet bulunamadı.');
    return rows[0];
  }

  private async availability(query: Query, businessId: string, duration: number | null, day: string) {
    const weekday = bookingDay(day).getUTCDay();
    const { rows: [hours] } = await query<Hours>(`
      SELECT to_char(opens, 'HH24:MI') AS opens, to_char(closes, 'HH24:MI') AS closes
      FROM pilot_hours WHERE business_id = $1 AND weekday = $2
    `, [businessId, weekday]);
    if (!hours || duration === null) return { mode: 'request' as const, times: [] };
    const ranges = await query<{ starts: Date | string; ends: Date | string }>(`
      SELECT starts, ends FROM pilot_appointments WHERE business_id = $1 AND status = 'confirmed'
        AND starts < $3 AND ends > $2
    `, [businessId, dayAt(day, hours.opens).toISOString(), dayAt(day, hours.closes).toISOString()]);
    const times = [];
    for (let minute = minutes(hours.opens); minute + duration <= minutes(hours.closes); minute += 15) {
      const time = timeText(minute);
      const starts = +dayAt(day, time);
      const end = starts + duration * 60000;
      if (starts > Date.now() && !ranges.rows.some((range) => starts < +new Date(range.ends) && end > +new Date(range.starts))) {
        times.push(time);
      }
    }
    return { mode: 'instant' as const, times };
  }

  async bookingOptions(id: string, day: string) {
    const query = this.db.query.bind(this.db);
    const service = await this.service(query, id);
    return this.availability(query, service.business_id, service.duration, day);
  }

  async slots(id: string, day: string) {
    return (await this.bookingOptions(id, day)).times;
  }

  async book(id: string, day: string, time: string, customer: string, email: string, capability = randomBytes(32).toString('hex'),
    visitor?: string) {
    bookingDay(day);
    customer = customer.trim();
    email = email.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(capability) || !validTime.test(time) || !customer || customer.length > 80 ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new CatalogError('Ad, e-posta ve saat bilgilerini kontrol et.');
    }
    const starts = dayAt(day, time);
    if (+starts <= Date.now()) throw new CatalogError('Gelecekteki bir saat seç.');
    await this.db.transaction(async ({ query }) => {
      const initial = await this.service(query, id);
      await query('SELECT id FROM pilot_businesses WHERE id = $1 FOR UPDATE', [initial.business_id]);
      const { rows: [prior] } = await query<{ service_id: string; customer: string; email: string }>(
        'SELECT service_id,customer,email FROM pilot_appointments WHERE capability_hash=$1', [tokenHash(capability)],
      );
      if (prior) {
        if (prior.service_id === id && prior.customer === customer && prior.email === email) return;
        throw new CatalogError('Bu randevu formu kullanılmış. Yeniden form aç.');
      }
      const service = await this.service(query, id);
      const options = await this.availability(query, service.business_id, service.duration, day);
      if (options.mode === 'instant' && !options.times.includes(time)) {
        throw new CatalogError('Bu saat artık boş değil. Başka bir saat seç.');
      }
      const ends = new Date(+starts + (service.duration ?? 30) * 60000);
      await query(`
        INSERT INTO pilot_appointments
          (id, capability_hash, business_id, service_id, service_name, price, customer, email, starts, ends, status, visitor_hash, booked_category)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [randomUUID(), tokenHash(capability), service.business_id, service.id, service.name,
        service.price, customer, email, starts.toISOString(), ends.toISOString(),
        options.mode === 'instant' ? 'confirmed' : 'requested', visitor && validVisitor.test(visitor) ? tokenHash(visitor) : null,
        service.category]);
    });
    return capability;
  }

  async appointment(capability: string) {
    const { rows } = await this.db.query<Omit<Appointment, 'customer' | 'email'>>(`
      SELECT id, service_name, price, starts, ends, status, proposed_start FROM pilot_appointments WHERE capability_hash = $1
    `, [tokenHash(capability)]);
    return rows[0] ?? null;
  }

  async cancel(capability: string) {
    await this.db.query(`
      UPDATE pilot_appointments SET status = 'cancelled', proposed_start = null
      WHERE capability_hash = $1 AND status IN ('requested', 'confirmed') AND greatest(starts, proposed_start) > now()
    `, [tokenHash(capability)]);
  }

  async appointments(token: string) {
    const owner = await this.owner(token);
    if (!owner) return [];
    return (await this.db.query<Appointment>(`
      SELECT id, customer, email, service_name, price, starts, ends, status, proposed_start
      FROM pilot_appointments WHERE business_id = $1 ORDER BY starts DESC LIMIT 100
    `, [owner.id])).rows;
  }

  async appointmentOverview(token: string) {
    const owner = await this.owner(token);
    if (!owner) return { requested: 0, upcoming: 0 };
    const { rows: [counts] } = await this.db.query<{ requested: number; upcoming: number }>(`
      SELECT count(*) FILTER (WHERE status='requested')::int AS requested,
             count(*) FILTER (WHERE status='confirmed' AND starts>now())::int AS upcoming
      FROM pilot_appointments WHERE business_id=$1
    `, [owner.id]);
    return counts;
  }

  async proposeAppointment(token: string, id: string, day: string, time: string) {
    const owner = await this.owner(token);
    bookingDay(day);
    if (!owner || !validId.test(id) || !validTime.test(time)) throw new CatalogError('Önerilen saati kontrol et.');
    const start = dayAt(day, time);
    if (+start <= Date.now()) throw new CatalogError('Gelecekteki bir saat seç.');
    const { rows } = await this.db.query(`
      UPDATE pilot_appointments SET proposed_start=$3
      WHERE id=$1 AND business_id=$2 AND status='requested' RETURNING id
    `, [id, owner.id, start.toISOString()]);
    if (!rows.length) throw new CatalogError('Bu randevu için saat önerilemiyor.');
  }

  async acceptProposal(capability: string, expectedStart?: string) {
    const hash = tokenHash(capability);
    await this.db.transaction(async ({ query }) => {
      const { rows: [identity] } = await query<{ business_id: string }>(
        'SELECT business_id FROM pilot_appointments WHERE capability_hash=$1', [hash],
      );
      if (!identity) throw new CatalogError('Randevu bulunamadı.');
      await query('SELECT id FROM pilot_businesses WHERE id=$1 FOR UPDATE', [identity.business_id]);
      const { rows: [entry] } = await query<Appointment>(
        'SELECT * FROM pilot_appointments WHERE capability_hash=$1 FOR UPDATE', [hash],
      );
      if (entry.status === 'confirmed') return;
      if (entry.status !== 'requested' || !entry.proposed_start || +new Date(entry.proposed_start) <= Date.now()) {
        throw new CatalogError('Geçerli bir saat önerisi yok.');
      }
      const starts = new Date(entry.proposed_start);
      if (expectedStart && starts.toISOString() !== expectedStart) throw new CatalogError('İşletme öneriyi güncelledi.');
      const ends = new Date(+starts + (+new Date(entry.ends) - +new Date(entry.starts)));
      const conflict = await query(`
        SELECT 1 FROM pilot_appointments WHERE business_id=$1 AND status='confirmed'
          AND starts < $3 AND ends > $2 LIMIT 1
      `, [identity.business_id, starts.toISOString(), ends.toISOString()]);
      if (conflict.rows.length) throw new CatalogError('Önerilen saat artık müsait değil.');
      await query(`
        UPDATE pilot_appointments SET starts=$2, ends=$3, status='confirmed', proposed_start=null WHERE id=$1
      `, [entry.id, starts.toISOString(), ends.toISOString()]);
    });
  }

  async updateAppointment(token: string, id: string, action: string) {
    const owner = await this.owner(token);
    if (!owner || !validId.test(id) || !['confirmed', 'cancelled', 'completed'].includes(action)) {
      throw new CatalogError('İşlem yapılamadı.');
    }
    await this.db.transaction(async ({ query }) => {
      await query('SELECT id FROM pilot_businesses WHERE id = $1 FOR UPDATE', [owner.id]);
      const { rows: [appointment] } = await query<Appointment>(
        'SELECT * FROM pilot_appointments WHERE id = $1 AND business_id = $2 FOR UPDATE', [id, owner.id],
      );
      if (!appointment) throw new CatalogError('Randevu bulunamadı.');
      if (action === 'confirmed' && appointment.status === 'requested' && +new Date(appointment.starts) > Date.now()) {
        const conflict = await query(`
          SELECT 1 FROM pilot_appointments WHERE business_id = $1 AND status = 'confirmed'
          AND starts < $3 AND ends > $2 LIMIT 1
        `, [owner.id, appointment.starts, appointment.ends]);
        if (conflict.rows.length) throw new CatalogError('Bu saat başka bir randevuyla çakışıyor.');
      } else if (!(action === 'cancelled' && ['requested', 'confirmed'].includes(appointment.status)) &&
                 !(action === 'completed' && appointment.status === 'confirmed' && +new Date(appointment.starts) <= Date.now())) {
        throw new CatalogError('Randevunun durumu bu işleme uygun değil.');
      }
      if (action === 'completed') {
        await query(`
          INSERT INTO pilot_finance (id,business_id,appointment_id,kind,label,amount)
          VALUES ($1,$2,$3,'sale',$4,$5) ON CONFLICT (appointment_id) DO NOTHING
        `, [randomUUID(), owner.id, appointment.id, appointment.service_name, appointment.price]);
      }
      await query('UPDATE pilot_appointments SET status = $1, proposed_start=null WHERE id = $2', [action, id]);
    });
  }
}
