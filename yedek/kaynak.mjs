// Veritabanindan tum public tablolari okur (pg ile, dogrudan Postgres).
//
// Neden pg (supabase-js degil): tablo listesi information_schema'dan dinamik
// gelir, yeni tablo eklenince yedek kendiliginden kapsar; kolon tipleri
// bilinir (tarih/para dogru bicimlenir); ve tum okuma TEK bir REPEATABLE READ
// islemde yapilir, yani tablolar ayni anin goruntusudur (randevu var ama
// musterisi yok gibi tutarsizlik olmaz).
import pg from 'pg'

const PARCA = 5000

// Tarih/saat ve sayi tipleri suruculerin JS nesnesine cevirmesine birakilmaz:
// date -> JS Date yerel gece yarisi kaymasi yapar, numeric/bigint hassasiyet
// kaybeder. Ham metin alinir; JSON kopya birebir kalir, Excel donusumu
// yardimci.mjs'de tipe gore yapilir.
const HAM_TIPLER = new Set([1082, 1083, 1114, 1184, 1266])

function tipCozucu(oid, bicim) {
  if (HAM_TIPLER.has(oid)) return (x) => x
  return pg.types.getTypeParser(oid, bicim)
}

// Vercel/Supabase baglanti dizesi `sslmode=require` tasir; pg 8.x bunu
// "sertifikayi dogrula" diye yorumlar ve Supabase'in kendi CA'si yuzunden
// baglanti reddedilir. sslmode atilir, sifreleme ssl nesnesiyle acilir.
export function baglantiAyari(url) {
  const u = new URL(url)
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'supa']) u.searchParams.delete(k)
  const yerel = ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
  return {
    connectionString: u.toString(),
    ssl: yerel ? false : { rejectUnauthorized: false },
    types: { getTypeParser: tipCozucu },
    connectionTimeoutMillis: 30_000,
    application_name: 'eseans-gunluk-yedek',
  }
}

function tirnak(ad) {
  return `"${String(ad).replace(/"/g, '""')}"`
}

// Doner: { alinma, tablolar: { [ad]: { kolonlar: [{ad, tip}], satirlar: [] } } }
// Herhangi bir tablo okunamazsa hata firlatir: yarim yedek "tamam" gorunmesin.
export async function veritabaniniOku(url, gunluk = () => {}) {
  const istemci = new pg.Client(baglantiAyari(url))
  await istemci.connect()
  try {
    await istemci.query('begin isolation level repeatable read read only')
    // Uzun takilan sorgu isi sonsuza kadar asili birakmasin.
    await istemci.query("set local statement_timeout = '300s'")

    const { rows: tablolarHam } = await istemci.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    )
    const { rows: kolonlarHam } = await istemci.query(
      `select table_name, column_name, data_type
         from information_schema.columns
        where table_schema = 'public'
        order by table_name, ordinal_position`,
    )
    const kolonlar = {}
    for (const k of kolonlarHam) (kolonlar[k.table_name] ||= []).push({ ad: k.column_name, tip: k.data_type })

    const tablolar = {}
    for (const { table_name: ad } of tablolarHam) {
      const satirlar = []
      try {
        // ctid sirasi islem goruntusu icinde sabit: parca parca okumak
        // atlama/cift kayit uretmez, birincil anahtar olmayan tabloda da calisir.
        for (let ofset = 0; ; ofset += PARCA) {
          const { rows } = await istemci.query(
            `select * from public.${tirnak(ad)} order by ctid limit ${PARCA} offset ${ofset}`,
          )
          satirlar.push(...rows)
          if (rows.length < PARCA) break
        }
      } catch (e) {
        // Mesajda veri olabilir; yalniz tablo adi ve hata kodu.
        throw new Error(`Tablo okunamadi: ${ad} (kod ${e.code || 'bilinmiyor'})`)
      }
      tablolar[ad] = { kolonlar: kolonlar[ad] || [], satirlar }
      gunluk(`  ${ad}: ${satirlar.length} satir`)
    }
    await istemci.query('commit')
    return { alinma: new Date().toISOString(), tablolar }
  } finally {
    await istemci.end().catch(() => {})
  }
}
