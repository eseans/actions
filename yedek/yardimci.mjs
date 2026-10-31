// Saf yardimcilar: DOM/ag/disk yok, hepsi test/yardimci.test.mjs ile sinanir.
// Yedekte hata sessiz veri kaybi demek; bu yuzden donusumler burada tek
// yerde ve testli.

// Turkiye 2016'dan beri sabit UTC+3 (yaz saati yok). Sabit ofset, runner'in
// saat dilimi ayarina ve tzdata'ya bagimli kalmamak icin.
export const TR_OFSET_MS = 3 * 60 * 60 * 1000

const GUN_MS = 24 * 60 * 60 * 1000

// Excel hucresi en fazla 32767 karakter alir; fazlasi dosyayi bozar.
export const HUCRE_SINIRI = 32767

// Sifre ozeti, oturum anahtari, paylasim linki gibi kolonlar isletmeye
// gonderilecek Excel'e girmez: dosya e-postayla dolasacak, sizarsa hesap ele
// gecirilebilir. Ada gore yakalanir ki yeni eklenen gizli kolon da dussun.
const GIZLI_KALIP = /(hash|token|secret|password|passwd|api_?key|private_?key|otp|device_code)/i

export function gizliKolonMu(ad) {
  return GIZLI_KALIP.test(String(ad))
}

// Kurus cinsinden tamsayi tutan kolonlar (ad sonu _kurus / _minor):
// Excel'de TL gorunmeli, yoksa 150000 "yuz elli bin lira" diye okunur.
export function kurusMu(ad) {
  return /_(kurus|minor)$/i.test(String(ad))
}

export function kurusTL(deger) {
  if (deger === null || deger === undefined || deger === '') return null
  const n = Number(deger)
  if (!Number.isFinite(n)) return null
  // Kurus tamsayi; /100 sonrasi kayan nokta artigini 2 haneye yuvarla.
  return Math.round(n) / 100
}

// Excel sayfa adi: en fazla 31 karakter, []:*?/\ yasak, bos olamaz, ' ile
// baslayip bitemez, buyuk-kucuk harf duyarsiz benzersiz olmali.
export function sayfaAdi(ham, kullanilan = new Set()) {
  let ad = String(ham ?? '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .trim()
  if (!ad) ad = 'Sayfa'
  ad = ad.slice(0, 31).trim()
  let aday = ad
  let i = 2
  const varMi = (x) => [...kullanilan].some((k) => k.toLowerCase() === x.toLowerCase())
  while (varMi(aday)) {
    const ek = ` ${i++}`
    aday = ad.slice(0, 31 - ek.length).trim() + ek
  }
  kullanilan.add(aday)
  return aday
}

// Klasor adi: slug zaten url-guvenli ama yine de diske yazmadan once
// suzulur (../ gibi bir deger repo disina yazdirmasin). Bos kalirsa id.
export function klasorAdi(slug, id) {
  const temiz = String(slug ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return temiz || `isletme-${String(id ?? 'bilinmiyor').slice(0, 36)}`
}

// Calisma anindaki Turkiye takvim gunu: dosya adi (YYYY-MM-DD) bundan gelir.
export function trTarihi(an = new Date()) {
  return new Date(an.getTime() + TR_OFSET_MS).toISOString().slice(0, 10)
}

// Saklama: tarihli dosyalardan son `gun` gunun disinda kalanlari dondurur.
// Adi tarih kalibina uymayan dosyaya dokunulmaz (elle konmus not vb.).
export function eskiDosyalar(adlar, bugun, gun) {
  const bugunMs = Date.parse(`${bugun}T00:00:00Z`)
  if (!Number.isFinite(bugunMs) || !(gun > 0)) throw new Error('eskiDosyalar: gecersiz bugun/gun')
  const sinirMs = bugunMs - (gun - 1) * GUN_MS
  return adlar.filter((ad) => {
    const m = /^(\d{4}-\d{2}-\d{2})\.(xlsx|json\.gz)$/.exec(ad)
    if (!m) return false
    const ms = Date.parse(`${m[1]}T00:00:00Z`)
    return Number.isFinite(ms) && ms < sinirMs
  })
}

// XML'de gecersiz kontrol karakterleri xlsx'i acilamaz hale getirir.
// eslint-disable-next-line no-control-regex
const GECERSIZ_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function temizMetin(s) {
  let t = String(s).replace(GECERSIZ_XML, '')
  if (t.length > HUCRE_SINIRI) t = t.slice(0, HUCRE_SINIRI - 20) + ' …[kesildi]'
  return t
}

const TARIH_BICIMI = 'dd.mm.yyyy'
const ZAMAN_BICIMI = 'dd.mm.yyyy hh:mm'
const PARA_BICIMI = '#,##0.00'
const PARA_KOLONU = /(price|amount|discount|fee|total|balance|cost|tutar)/i

// Postgres degeri -> Excel hucresi. `tip` information_schema.columns.data_type.
// Ham degerler surucuden metin gelir (tarih/numeric/bigint), boylece JSON
// kopya birebir kalir; donusum yalniz Excel icin burada yapilir.
// Donus: { deger, bicim } (bicim = Excel numFmt ya da undefined).
export function hucreDegeri(deger, kolonAdi, tip) {
  if (deger === null || deger === undefined) return { deger: null }
  const t = String(tip || '').toLowerCase()

  if (kurusMu(kolonAdi)) return { deger: kurusTL(deger), bicim: PARA_BICIMI }

  if (t === 'boolean' || typeof deger === 'boolean') {
    const b = deger === true || deger === 't' || deger === 'true'
    return { deger: b ? 'Evet' : 'Hayır' }
  }

  if (t === 'date') {
    const ms = Date.parse(`${String(deger).slice(0, 10)}T00:00:00Z`)
    return Number.isFinite(ms) ? { deger: new Date(ms), bicim: TARIH_BICIMI } : { deger: temizMetin(deger) }
  }

  if (t.startsWith('timestamp')) {
    // timestamptz metni ofsetliyse Date.parse dogru UTC'yi verir; ofsetsiz
    // (timestamp without time zone) UTC kabul edilir. Excel saat dilimi
    // bilmez: Turkiye saatini gostermek icin +3 saat kaydirilir.
    // Postgres metni "+00" / "+0530" ofseti yazar; Date.parse "+00:00" ister.
    const s = String(deger)
      .replace(' ', 'T')
      .replace(/([+-]\d{2})$/, '$1:00')
      .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    const ofsetli = /([+-]\d{2}(:?\d{2})?|Z)$/.test(s)
    const ms = Date.parse(ofsetli ? s : `${s}Z`)
    if (!Number.isFinite(ms)) return { deger: temizMetin(deger) }
    const yerel = t.includes('with time zone') ? ms + TR_OFSET_MS : ms
    return { deger: new Date(yerel), bicim: ZAMAN_BICIMI }
  }

  if (t.startsWith('time')) return { deger: String(deger).slice(0, 5) }

  if (t === 'numeric' || t === 'bigint' || t === 'integer' || t === 'smallint' || t === 'real' || t === 'double precision') {
    const n = Number(deger)
    if (!Number.isFinite(n)) return { deger: temizMetin(deger) }
    // 2^53 ustu bigint sayi olarak yuvarlanir; metin kalsin ki deger bozulmasin.
    if (t === 'bigint' && !Number.isSafeInteger(n)) return { deger: String(deger) }
    // Para bicimi yalniz adi para olan kolona: lat/lng gibi numeric'ler
    // 2 haneye yuvarlanmis gorunmesin.
    return t === 'numeric' && PARA_KOLONU.test(kolonAdi) ? { deger: n, bicim: PARA_BICIMI } : { deger: n }
  }

  if (Array.isArray(deger)) return { deger: temizMetin(deger.map((x) => (x === null ? '' : typeof x === 'object' ? JSON.stringify(x) : x)).join(', ')) }
  if (typeof deger === 'object') return { deger: temizMetin(JSON.stringify(deger)) }
  return { deger: temizMetin(deger) }
}

// Kolon basligi: bilinen ad Turkce, kurus kolonuna "(TL)" eki.
export function kolonBasligi(ad, sozluk = {}) {
  const temel = sozluk[ad] || ad
  return kurusMu(ad) ? `${temel.replace(/_(kurus|minor)$/i, '')} (TL)` : temel
}
