// --kuru (deneme) calismasi icin uydurma veri. Gercek veritabanina
// baglanmadan tum yolu (Excel, JSON, README, saklama) sinamak icin; gercek
// musteri verisi hicbir zaman yerel makineye indirilmesin diye.
// Bilerek "zor" degerler icerir: kontrol karakteri, cok uzun metin, dizi,
// jsonb, gizli kolon, kurus kolonu, bilinmeyen tablo, platform-ici tablo.

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const DEMO = '33333333-3333-4333-8333-333333333333'

const k = (ad, tip) => ({ ad, tip })

export function ornekVeri() {
  const tablolar = {
    businesses: {
      kolonlar: [k('id', 'uuid'), k('slug', 'text'), k('name', 'text'), k('internal', 'boolean'), k('working_hours', 'jsonb'),
        k('google_calendar_refresh_token', 'text'), k('lat', 'numeric'), k('created_at', 'timestamp with time zone')],
      satirlar: [
        { id: A, slug: 'guzel-sac', name: 'Güzel Saç Salonu', internal: false, working_hours: { pzt: ['09:00', '18:00'] }, google_calendar_refresh_token: 'GIZLI-1', lat: '41.012345', created_at: '2026-09-01 08:00:00+00' },
        { id: B, slug: '../Kotu Slug!', name: 'Dr. Diş Kliniği', internal: false, working_hours: null, google_calendar_refresh_token: null, lat: null, created_at: '2026-10-01 10:30:00+00' },
        { id: DEMO, slug: 'demo', name: 'Demo', internal: true, working_hours: null, google_calendar_refresh_token: null, lat: null, created_at: '2026-01-01 00:00:00+00' },
      ],
    },
    customers: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('name', 'text'), k('phone', 'text'), k('birthday', 'date'), k('notes', 'text'), k('created_at', 'timestamp with time zone')],
      satirlar: [
        { id: 'c1', business_id: A, name: 'Ayşe Yılmaz', phone: '+905551112233', birthday: '1990-05-17', notes: 'Kontrol\u0007karakteri', created_at: '2026-09-02 09:00:00+00' },
        { id: 'c2', business_id: A, name: 'Mehmet Öz', phone: null, birthday: null, notes: 'x'.repeat(40000), created_at: '2026-09-03 09:00:00+00' },
        { id: 'c3', business_id: B, name: 'Zeynep Kaya', phone: '+905559998877', birthday: null, notes: null, created_at: '2026-10-02 09:00:00+00' },
        { id: 'c9', business_id: DEMO, name: 'Demo Müşteri', phone: null, birthday: null, notes: null, created_at: '2026-01-02 09:00:00+00' },
      ],
    },
    services: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('name', 'text'), k('duration_min', 'integer'), k('price', 'numeric'), k('active', 'boolean')],
      satirlar: [
        { id: 's1', business_id: A, name: 'Saç Kesimi', duration_min: 30, price: '450.00', active: true },
        { id: 's2', business_id: B, name: 'Dolgu', duration_min: 45, price: '2500.50', active: false },
      ],
    },
    staff: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('name', 'text'), k('role', 'text'), k('pin_hash', 'text'), k('permissions', 'jsonb')],
      satirlar: [
        { id: 'p1', business_id: A, name: 'Elif Usta', role: 'Kuaför', pin_hash: 'GIZLI-PIN', permissions: { randevu: 'yaz' } },
        { id: 'p2', business_id: B, name: 'Dt. Can', role: 'Hekim', pin_hash: null, permissions: {} },
      ],
    },
    appointments: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('customer_id', 'uuid'), k('service_id', 'uuid'), k('staff_id', 'uuid'),
        k('start_time', 'time without time zone'), k('appointment_date', 'date'), k('status', 'text'), k('payment_amount', 'numeric')],
      satirlar: [
        { id: 'a1', business_id: A, customer_id: 'c1', service_id: 's1', staff_id: 'p1', start_time: '14:30:00', appointment_date: '2026-11-02', status: 'Onaylandı', payment_amount: '450.00' },
        { id: 'a2', business_id: A, customer_id: 'silinmis', service_id: null, staff_id: null, start_time: '10:00:00', appointment_date: '2026-11-03', status: 'İptal', payment_amount: null },
        { id: 'a3', business_id: B, customer_id: 'c3', service_id: 's2', staff_id: 'p2', start_time: '09:15:00', appointment_date: '2026-11-04', status: 'Onaylandı', payment_amount: null },
      ],
    },
    finance_transactions: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('type', 'text'), k('amount', 'numeric'), k('transaction_date', 'date'), k('customer_id', 'uuid')],
      satirlar: [{ id: 'f1', business_id: A, type: 'gelir', amount: '450.00', transaction_date: '2026-10-30', customer_id: 'c1' }],
    },
    stock_items: { kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('name', 'text'), k('quantity', 'integer')], satirlar: [] },
    treatment_items: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('customer_id', 'uuid'), k('name', 'text'), k('teeth', 'ARRAY'), k('surfaces', 'ARRAY'), k('unit_price', 'numeric'), k('done_by', 'uuid')],
      satirlar: [{ id: 't1', business_id: B, customer_id: 'c3', name: 'Kompozit dolgu', teeth: [16, 17], surfaces: ['M', 'O'], unit_price: '2500.00', done_by: 'p2' }],
    },
    subscription: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('amount_kurus', 'bigint'), k('status', 'text'), k('created_at', 'timestamp with time zone')],
      satirlar: [{ id: 'sub1', business_id: A, amount_kurus: '149900', status: 'active', created_at: '2026-09-01T08:00:00.123+00:00' }],
    },
    risk_events: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('score', 'integer')],
      satirlar: [{ id: 'r1', business_id: A, score: 90 }],
    },
    yeni_bir_tablo_ki_adi_otuz_bir_karakterden_uzun: {
      kolonlar: [k('id', 'uuid'), k('business_id', 'uuid'), k('deger', 'text'), k('api_key', 'text')],
      satirlar: [{ id: 'y1', business_id: B, deger: 'bilinmeyen tablo da yedeklenir', api_key: 'GIZLI-KEY' }],
    },
    feature_flags: {
      kolonlar: [k('key', 'text'), k('enabled', 'boolean')],
      satirlar: [{ key: 'tedavi', enabled: true }],
    },
  }
  return { alinma: '2026-10-31T00:30:00.000Z', tablolar }
}
