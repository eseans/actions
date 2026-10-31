#!/usr/bin/env node
// Gunluk yedek: veritabanini okur, cikti klasorune yazar.
//   isletmeler/<klasor>/<gun>.xlsx  (internal olmayan her isletme)
//   tam/<gun>.json.gz               (tum tablolar, tum satirlar)
//   README.md                       (duzen + isletme dizini)
//
// Kullanim:
//   node yedek/yedekle.mjs --cikti <klasor>          (DATABASE_URL_POSTGRES gerekir)
//   node yedek/yedekle.mjs --cikti <klasor> --kuru   (uydurma veri, ag yok)
//   [--bugun YYYY-AA-GG] [--gun 90]
//
// Depo herkese acik, Actions gunlugu da acik: buraya yalniz SAYI yazilir;
// isletme adi, telefon, e-posta, hata mesajindaki veri asla yazilmaz.
import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { isletmeTablolari, isletmeyeGoreGrupla, isletmeKitabi } from './excel.mjs'
import { klasorAdi, trTarihi } from './yardimci.mjs'
import { readmeMetni } from './readme.mjs'

const gunluk = (s) => console.log(s)

// Tam kopyayi parca parca uretir: tek dev JSON.stringify bellegi ikiye
// katlar; satir satir akitmak buyuk tablolarda da sabit ek bellekle calisir.
function* tamKopyaParcalari(veri) {
  yield `{"alinma":${JSON.stringify(veri.alinma)},"tablolar":{`
  let ilkTablo = true
  for (const [ad, t] of Object.entries(veri.tablolar)) {
    yield `${ilkTablo ? '' : ','}${JSON.stringify(ad)}:{"kolonlar":${JSON.stringify(t.kolonlar)},"satirlar":[`
    ilkTablo = false
    for (let i = 0; i < t.satirlar.length; i++) yield (i ? ',' : '') + JSON.stringify(t.satirlar[i])
    yield ']}'
  }
  yield '}}\n'
}

async function tamKopyaYaz(veri, dosya) {
  await mkdir(path.dirname(dosya), { recursive: true })
  await pipeline(Readable.from(tamKopyaParcalari(veri)), createGzip({ level: 9 }), createWriteStream(dosya))
}

export async function yedekle({ veri, cikti, bugun, gun = 90 }) {
  if (!veri?.tablolar?.businesses) throw new Error('businesses tablosu yok: yanlis veritabani ya da sema?')

  const tabloSayisi = Object.keys(veri.tablolar).length
  const satirSayisi = Object.values(veri.tablolar).reduce((n, t) => n + t.satirlar.length, 0)

  await tamKopyaYaz(veri, path.join(cikti, 'tam', `${bugun}.json.gz`))

  const tablolar = isletmeTablolari(veri)
  const grup = isletmeyeGoreGrupla(veri, tablolar)
  const isletmeler = veri.tablolar.businesses.satirlar.filter((b) => b.internal !== true && b.internal !== 't')

  const kullanilanKlasor = new Set()
  const dizin = []
  for (const b of isletmeler) {
    let klasor = klasorAdi(b.slug, b.id)
    // Suzme sonrasi iki slug ayni klasore dusmesin: biri digerinin
    // dosyasini ezerse o isletmenin yedegi sessizce kaybolur.
    if (kullanilanKlasor.has(klasor)) klasor = `${klasor}-${String(b.id).slice(0, 8)}`
    kullanilanKlasor.add(klasor)

    const kayitlar = grup.get(b.id) || {}
    const { kitap, bolumler } = isletmeKitabi(b, veri, tablolar, kayitlar)
    const dosya = path.join(cikti, 'isletmeler', klasor, `${bugun}.xlsx`)
    await mkdir(path.dirname(dosya), { recursive: true })
    await kitap.xlsx.writeFile(dosya)
    dizin.push({ klasor, ad: b.name, kayit: bolumler.reduce((n, [, s]) => n + s, 0) })
  }

  await writeFile(path.join(cikti, 'README.md'), readmeMetni({ bugun, gun, isletmeler: dizin, tabloSayisi, satirSayisi }))

  const ozet = {
    tablo: tabloSayisi,
    satir: satirSayisi,
    isletme: isletmeler.length,
    atlanan_internal: veri.tablolar.businesses.satirlar.length - isletmeler.length,
    excel_tablo: tablolar.length,
  }
  return ozet
}

async function ana() {
  const { values } = parseArgs({
    options: {
      cikti: { type: 'string' },
      kuru: { type: 'boolean', default: false },
      bugun: { type: 'string' },
      gun: { type: 'string', default: '90' },
    },
  })
  if (!values.cikti) throw new Error('--cikti <klasor> gerekli')
  const bugun = values.bugun || trTarihi()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bugun)) throw new Error('--bugun YYYY-AA-GG olmali')
  const gun = Number(values.gun)

  let veri
  if (values.kuru) {
    gunluk('Kuru calisma: uydurma veri, veritabanina baglanilmiyor.')
    veri = (await import('./ornek-veri.mjs')).ornekVeri()
  } else {
    const url = process.env.DATABASE_URL_POSTGRES
    if (!url) throw new Error('DATABASE_URL_POSTGRES tanimli degil')
    gunluk('Veritabani okunuyor (tek tutarli goruntu)...')
    veri = await (await import('./kaynak.mjs')).veritabaniniOku(url, gunluk)
  }

  const ozet = await yedekle({ veri, cikti: path.resolve(values.cikti), bugun, gun })
  gunluk(`Yedek hazir (${bugun}): ${ozet.tablo} tablo, ${ozet.satir} satir, ${ozet.isletme} isletme Excel'i ` +
    `(${ozet.excel_tablo} bolum turu), ${ozet.atlanan_internal} demo/ic isletme atlandi.`)
}

// Test dosyasi yedekle() fonksiyonunu ice aktarabilsin diye ana() yalniz
// dogrudan calistirildiginda kosar.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  ana().catch((e) => {
    // Yalniz mesaj: yigin izi ve hata nesnesi baglanti dizesi/veri tasiyabilir.
    const mesaj = String(e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, '<baglanti-dizesi>')
    console.error(`YEDEK BASARISIZ: ${mesaj}${e?.code ? ` (kod ${e.code})` : ''}`)
    process.exit(1)
  })
}
