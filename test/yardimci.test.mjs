import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sayfaAdi, gizliKolonMu, kurusMu, kurusTL, klasorAdi, trTarihi, eskiDosyalar, hucreDegeri, kolonBasligi, temizMetin, HUCRE_SINIRI,
} from '../yedek/yardimci.mjs'
import { baglantiAyari } from '../yedek/kaynak.mjs'

test('sayfaAdi: yasak karakter, 31 sinir, benzersizlik', () => {
  const k = new Set()
  assert.equal(sayfaAdi('Gelir/Gider [2026]: *?', k), 'Gelir Gider 2026')
  assert.equal(sayfaAdi("'Tirnak'", k), 'Tirnak')
  assert.equal(sayfaAdi('', k), 'Sayfa')
  const uzun = 'a'.repeat(40)
  assert.equal(sayfaAdi(uzun, k).length, 31)
  const ikinci = sayfaAdi(uzun, k)
  assert.equal(ikinci.length, 31)
  assert.ok(ikinci.endsWith(' 2'))
  assert.equal(sayfaAdi('sayfa', k), 'sayfa 2') // buyuk-kucuk harf duyarsiz
})

test('gizliKolonMu: sifre/anahtar kolonlari duser, normaller kalir', () => {
  for (const ad of ['pin_hash', 'password_hash', 'share_token', 'google_calendar_refresh_token', 'client_secret', 'api_key', 'device_code_hash', 'otp_code'])
    assert.equal(gizliKolonMu(ad), true, ad)
  for (const ad of ['name', 'phone', 'email', 'pin_failed', 'key', 'status', 'customer_id'])
    assert.equal(gizliKolonMu(ad), false, ad)
})

test('kurus -> TL', () => {
  assert.equal(kurusMu('amount_kurus'), true)
  assert.equal(kurusMu('net_amount_minor'), true)
  assert.equal(kurusMu('amount'), false)
  assert.equal(kurusTL('149900'), 1499)
  assert.equal(kurusTL(12345), 123.45)
  assert.equal(kurusTL(-5), -0.05)
  assert.equal(kurusTL(null), null)
  assert.equal(kurusTL('abc'), null)
  assert.equal(kolonBasligi('amount_kurus', {}), 'amount (TL)')
  assert.equal(kolonBasligi('name', { name: 'Ad' }), 'Ad')
})

test('klasorAdi: yol disina cikamaz, bos ise id', () => {
  assert.equal(klasorAdi('guzel-sac', 'x'), 'guzel-sac')
  assert.equal(klasorAdi('../Kotu Slug!', 'x'), 'kotu-slug')
  assert.equal(klasorAdi('..', 'abc'), 'isletme-abc')
  assert.equal(klasorAdi(null, null), 'isletme-bilinmiyor')
})

test('trTarihi: UTC+3 gun sinirinda dogru gun', () => {
  assert.equal(trTarihi(new Date('2026-10-30T20:59:00Z')), '2026-10-30')
  assert.equal(trTarihi(new Date('2026-10-30T21:00:00Z')), '2026-10-31')
})

test('eskiDosyalar: son N gun kalir, tarihsiz dosyaya dokunulmaz', () => {
  const adlar = ['2026-10-31.xlsx', '2026-08-03.xlsx', '2026-08-02.xlsx', '2026-07-01.json.gz', 'README.md', 'not.xlsx', '2026-08-03.json.gz']
  // 90 gun: 2026-10-31 dahil geriye 90 gun -> en eski tutulan 2026-08-03.
  assert.deepEqual(eskiDosyalar(adlar, '2026-10-31', 90), ['2026-08-02.xlsx', '2026-07-01.json.gz'])
  assert.deepEqual(eskiDosyalar(adlar, '2026-10-31', 1).sort(), ['2026-07-01.json.gz', '2026-08-02.xlsx', '2026-08-03.json.gz', '2026-08-03.xlsx'])
  assert.throws(() => eskiDosyalar(adlar, 'dun', 90))
  assert.throws(() => eskiDosyalar(adlar, '2026-10-31', 0))
})

test('hucreDegeri: tiplere gore donusum', () => {
  const d = hucreDegeri('2026-11-02', 'appointment_date', 'date')
  assert.ok(d.deger instanceof Date)
  assert.equal(d.deger.toISOString(), '2026-11-02T00:00:00.000Z')
  assert.equal(d.bicim, 'dd.mm.yyyy')

  // timestamptz: Excel'de Turkiye saati gorunsun (+3).
  const z = hucreDegeri('2026-09-01 08:00:00+00', 'created_at', 'timestamp with time zone')
  assert.equal(z.deger.toISOString(), '2026-09-01T11:00:00.000Z')
  const z2 = hucreDegeri('2026-09-01T08:00:00.123+00:00', 'created_at', 'timestamp with time zone')
  assert.equal(z2.deger.toISOString(), '2026-09-01T11:00:00.123Z')

  assert.equal(hucreDegeri('14:30:00', 'start_time', 'time without time zone').deger, '14:30')
  assert.deepEqual(hucreDegeri('450.00', 'price', 'numeric'), { deger: 450, bicim: '#,##0.00' })
  assert.deepEqual(hucreDegeri('41.012345', 'lat', 'numeric'), { deger: 41.012345 })
  assert.deepEqual(hucreDegeri('149900', 'amount_kurus', 'bigint'), { deger: 1499, bicim: '#,##0.00' })
  assert.equal(hucreDegeri('9007199254740993', 'sayac', 'bigint').deger, '9007199254740993')
  assert.equal(hucreDegeri(true, 'active', 'boolean').deger, 'Evet')
  assert.equal(hucreDegeri(false, 'active', 'boolean').deger, 'Hayır')
  assert.equal(hucreDegeri([16, 17], 'teeth', 'ARRAY').deger, '16, 17')
  assert.equal(hucreDegeri({ a: 1 }, 'permissions', 'jsonb').deger, '{"a":1}')
  assert.equal(hucreDegeri(null, 'x', 'text').deger, null)
  assert.equal(hucreDegeri('kotu-tarih', 'd', 'date').deger, 'kotu-tarih')
})

test('temizMetin: kontrol karakteri ve hucre siniri', () => {
  assert.equal(temizMetin('a\u0007b\u0000c\td'), 'abc\td')
  assert.ok(temizMetin('x'.repeat(40000)).length <= HUCRE_SINIRI)
})

test('baglantiAyari: sslmode atilir, uzakta sifreli baglanti', () => {
  const a = baglantiAyari('postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x')
  assert.ok(!a.connectionString.includes('sslmode'))
  assert.ok(!a.connectionString.includes('supa='))
  assert.deepEqual(a.ssl, { rejectUnauthorized: false })
  assert.equal(baglantiAyari('postgres://u:p@localhost:5432/db').ssl, false)
})
