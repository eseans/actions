// Isletme basina tek Excel calisma kitabi: ilk sekme "Ozet", sonra her
// bolum (Randevular, Musteriler...) ayri sekme. Hedef: sistem coktugunde bu
// dosya isletmeye gonderildiginde Excel'de acip isine devam edebilmesi.
import ExcelJS from 'exceljs'
import { TABLO_ADLARI, ISLETMEYE_GITMEYEN, KOLON_ADLARI, BAGLANTILAR } from './etiketler.mjs'
import { sayfaAdi, gizliKolonMu, hucreDegeri, kolonBasligi, temizMetin, TR_OFSET_MS } from './yardimci.mjs'

// Bos olsa da her zaman sekmesi olan bolumler: isletme "randevu sekmesi
// yok" gorup verisi kayboldu sanmasin; bos sekme = gercekten kayit yok.
const CEKIRDEK = new Set(['appointments', 'customers', 'services', 'staff', 'finance_transactions', 'stock_items'])

const SIRA = new Map(TABLO_ADLARI.map(([t], i) => [t, i]))
const TURKCE_AD = new Map(TABLO_ADLARI)

// Isletmeye ait tablolar: business_id kolonu olan her public tablo
// (platform-ici olanlar haric). Dinamik: yeni tablo kendiliginden girer.
export function isletmeTablolari(veri) {
  return Object.keys(veri.tablolar)
    .filter((t) => t !== 'businesses' && !ISLETMEYE_GITMEYEN.has(t))
    .filter((t) => veri.tablolar[t].kolonlar.some((k) => k.ad === 'business_id'))
    .sort((a, b) => (SIRA.get(a) ?? 1e6) - (SIRA.get(b) ?? 1e6) || a.localeCompare(b))
}

// Tum satirlari bir kez isletmeye gore grupla: her isletme icin tum
// tablolari yeniden taramak isletme sayisiyla karesel buyurdu.
export function isletmeyeGoreGrupla(veri, tablolar) {
  const grup = new Map()
  for (const t of tablolar) {
    for (const satir of veri.tablolar[t].satirlar) {
      const bid = satir.business_id
      if (!bid) continue
      if (!grup.has(bid)) grup.set(bid, {})
      ;(grup.get(bid)[t] ||= []).push(satir)
    }
  }
  return grup
}

// id -> okunur ad sozlugu (musteri adi, hizmet adi, plan basligi...).
function adSozlukleri(kayitlar) {
  const s = {}
  for (const t of new Set(Object.values(BAGLANTILAR).map((b) => b.tablo))) {
    const m = new Map()
    for (const r of kayitlar[t] || []) m.set(String(r.id), r.name ?? r.title ?? '')
    s[t] = m
  }
  return s
}

function genislikAyarla(sayfa, ornekSatir = 200) {
  sayfa.columns.forEach((kolon, i) => {
    let en = 8
    sayfa.getColumn(i + 1).eachCell({ includeEmpty: false }, (hucre, satirNo) => {
      if (satirNo > ornekSatir) return
      const v = hucre.value
      const uz = v instanceof Date ? 16 : String(v ?? '').length
      if (uz > en) en = uz
    })
    kolon.width = Math.min(Math.max(en + 2, 10), 50)
  })
}

function basligiBicimle(sayfa, kolonSayisi) {
  const baslik = sayfa.getRow(1)
  baslik.font = { bold: true }
  baslik.alignment = { vertical: 'middle' }
  // Baslik satiri sabit + filtre: binlerce randevu arasinda kaydirirken
  // kolon adlari kaybolmasin, musteri/tarih ile hemen suzulebilsin.
  sayfa.views = [{ state: 'frozen', ySplit: 1 }]
  if (kolonSayisi > 0) sayfa.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolonSayisi } }
}

// Bir tabloyu sekmeye yazar; yazilan satir sayisini dondurur.
function bolumYaz(kitap, ad, tabloBilgisi, satirlar, sozlukler, kullanilan) {
  const sayfa = kitap.addWorksheet(sayfaAdi(ad, kullanilan))
  const kolonlar = tabloBilgisi.kolonlar.filter((k) => k.ad !== 'business_id' && !gizliKolonMu(k.ad))

  // Her kolon icin hucre ureticisi; baglanti kolonunun yanina ad kolonu
  // eklenir (yalniz en az bir satir cozulebiliyorsa, bos kolon gurultudur).
  const uretici = []
  for (const k of kolonlar) {
    uretici.push({ baslik: kolonBasligi(k.ad, KOLON_ADLARI), hucre: (r) => hucreDegeri(r[k.ad], k.ad, k.tip) })
    const bag = BAGLANTILAR[k.ad]
    const sozluk = bag && sozlukler[bag.tablo]
    if (sozluk && satirlar.some((r) => r[k.ad] != null && sozluk.has(String(r[k.ad])))) {
      uretici.push({
        baslik: bag.baslik,
        hucre: (r) => ({ deger: r[k.ad] == null ? null : temizMetin(sozluk.get(String(r[k.ad])) ?? '') || null }),
      })
    }
  }

  sayfa.addRow(uretici.map((u) => u.baslik))
  for (const r of satirlar) {
    const hucreler = uretici.map((u) => u.hucre(r))
    const satir = sayfa.addRow(hucreler.map((h) => h.deger))
    hucreler.forEach((h, i) => {
      if (h.bicim) satir.getCell(i + 1).numFmt = h.bicim
    })
  }
  basligiBicimle(sayfa, uretici.length)
  genislikAyarla(sayfa)
  return satirlar.length
}

function ozetYaz(sayfa, isletme, businessesKolonlari, bolumler, alinma) {
  sayfa.getColumn(1).width = 28
  sayfa.getColumn(2).width = 60
  const baslik = sayfa.addRow([`eSeans yedeği — ${temizMetin(isletme.name ?? '')}`])
  baslik.font = { bold: true, size: 16 }
  const zaman = sayfa.addRow(['Yedek alınma zamanı', new Date(Date.parse(alinma) + TR_OFSET_MS)])
  zaman.getCell(2).numFmt = 'dd.mm.yyyy hh:mm'
  zaman.getCell(2).alignment = { horizontal: 'left' }
  sayfa.addRow([
    'Bu dosya',
    'İşletmenizin tüm kayıtlarının günlük kopyasıdır. Her sekme bir bölümdür. ' +
      '"No" ile biten kolonlar kayıtları birbirine bağlar (ör. randevudaki Müşteri No = Müşteriler sekmesindeki Kayıt No).',
  ]).getCell(2).alignment = { wrapText: true, vertical: 'top' }

  sayfa.addRow([])
  sayfa.addRow(['Bölüm', 'Kayıt sayısı']).font = { bold: true }
  for (const [ad, sayi] of bolumler) sayfa.addRow([ad, sayi])

  sayfa.addRow([])
  sayfa.addRow(['İşletme bilgileri']).font = { bold: true }
  for (const k of businessesKolonlari) {
    if (gizliKolonMu(k.ad)) continue
    const h = hucreDegeri(isletme[k.ad], k.ad, k.tip)
    if (h.deger === null || h.deger === '') continue
    const satir = sayfa.addRow([kolonBasligi(k.ad, KOLON_ADLARI), h.deger])
    if (h.bicim) satir.getCell(2).numFmt = h.bicim
    satir.getCell(2).alignment = { horizontal: 'left', wrapText: true, vertical: 'top' }
  }
}

// Doner: { kitap, bolumler: [[sekmeAdi, satirSayisi]] }
export function isletmeKitabi(isletme, veri, tablolar, kayitlar) {
  const kitap = new ExcelJS.Workbook()
  kitap.creator = 'eSeans yedek'
  kitap.created = new Date(veri.alinma)
  const kullanilan = new Set()
  const ozet = kitap.addWorksheet(sayfaAdi('Özet', kullanilan))
  const sozlukler = adSozlukleri(kayitlar)

  const bolumler = []
  for (const t of tablolar) {
    const satirlar = kayitlar[t] || []
    if (!satirlar.length && !CEKIRDEK.has(t)) continue
    const ad = TURKCE_AD.get(t) || t
    const n = bolumYaz(kitap, ad, veri.tablolar[t], satirlar, sozlukler, kullanilan)
    bolumler.push([kitap.worksheets.at(-1).name, n])
  }
  ozetYaz(ozet, isletme, veri.tablolar.businesses?.kolonlar || [], bolumler, veri.alinma)
  return { kitap, bolumler }
}
