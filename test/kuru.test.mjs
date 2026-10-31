// Uctan uca kuru calisma: uydurma veriyle tum ciktiyi uretir, sonra
// dosyalari geri okuyup icerigi denetler. Gercek veritabani gerekmez.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { yedekle } from '../yedek/yedekle.mjs'
import { temizle } from '../yedek/temizle.mjs'
import { ornekVeri } from '../yedek/ornek-veri.mjs'

const BUGUN = '2026-10-31'

test('kuru yedek: Excel + tam kopya + README', async () => {
  const cikti = await mkdtemp(path.join(tmpdir(), 'yedek-'))
  try {
    const ozet = await yedekle({ veri: ornekVeri(), cikti, bugun: BUGUN, gun: 90 })
    assert.equal(ozet.isletme, 2)
    assert.equal(ozet.atlanan_internal, 1)

    // Demo (internal) isletmenin klasoru yok; kotu slug suzulmus.
    assert.deepEqual((await readdir(path.join(cikti, 'isletmeler'))).sort(), ['guzel-sac', 'kotu-slug'])

    const kitap = new ExcelJS.Workbook()
    await kitap.xlsx.readFile(path.join(cikti, 'isletmeler', 'guzel-sac', `${BUGUN}.xlsx`))
    const adlar = kitap.worksheets.map((s) => s.name)
    assert.equal(adlar[0], 'Özet')
    assert.deepEqual(adlar.slice(1, 3), ['Randevular', 'Müşteriler'])
    assert.ok(adlar.includes('Stok'), 'bos cekirdek bolum de sekme olarak var')
    assert.ok(adlar.includes('Abonelik'))
    assert.ok(!adlar.some((a) => /risk/i.test(a)), 'platform-ici tablo isletmeye gitmez')
    assert.ok(adlar.every((a) => a.length <= 31))

    // Randevu: musteri adi cozulmus, tarih gercek tarih, saat HH:MM.
    const r = kitap.getWorksheet('Randevular')
    const baslik = r.getRow(1).values.slice(1)
    assert.ok(!baslik.includes('business_id'))
    const kol = (ad) => baslik.indexOf(ad) + 1
    assert.equal(r.getRow(2).getCell(kol('Müşteri')).value, 'Ayşe Yılmaz')
    assert.equal(r.getRow(2).getCell(kol('Hizmet')).value, 'Saç Kesimi')
    assert.ok(r.getRow(2).getCell(kol('Randevu Tarihi')).value instanceof Date)
    assert.equal(r.getRow(2).getCell(kol('Saat')).value, '14:30')
    assert.equal(r.getRow(3).getCell(kol('Müşteri')).value, null, 'silinmis musteri bos kalir, cokmez')
    assert.equal(r.views[0].state, 'frozen')
    assert.ok(r.autoFilter)

    // Gizli kolon Excel'de yok; kurus TL'ye cevrilmis.
    const p = kitap.getWorksheet('Personel').getRow(1).values.slice(1)
    assert.ok(!p.some((x) => /pin|hash/i.test(String(x))))
    const ab = kitap.getWorksheet('Abonelik')
    const abBaslik = ab.getRow(1).values.slice(1)
    assert.equal(ab.getRow(2).getCell(abBaslik.indexOf('amount (TL)') + 1).value, 1499)

    // Ozet: isletme adi var, gizli token yok.
    const ozetMetni = JSON.stringify(kitap.getWorksheet('Özet').getSheetValues())
    assert.ok(ozetMetni.includes('Güzel Saç Salonu'))
    assert.ok(!ozetMetni.includes('GIZLI'))

    // Bilinmeyen tablo diger isletmede, kisaltilmis sekme adiyla; api_key yok.
    const k2 = new ExcelJS.Workbook()
    await k2.xlsx.readFile(path.join(cikti, 'isletmeler', 'kotu-slug', `${BUGUN}.xlsx`))
    const yeni = k2.worksheets.find((s) => s.name.startsWith('yeni_bir_tablo'))
    assert.ok(yeni)
    assert.ok(!JSON.stringify(yeni.getSheetValues()).includes('GIZLI'))
    const ti = k2.getWorksheet('Tedavi Kalemleri')
    assert.ok(JSON.stringify(ti.getSheetValues()).includes('16, 17'))

    // Tam kopya: tum tablolar, gizli kolonlar dahil, ham degerler.
    const tam = JSON.parse(gunzipSync(await readFile(path.join(cikti, 'tam', `${BUGUN}.json.gz`))).toString())
    assert.equal(Object.keys(tam.tablolar).length, Object.keys(ornekVeri().tablolar).length)
    assert.equal(tam.tablolar.businesses.satirlar.length, 3)
    assert.equal(tam.tablolar.staff.satirlar[0].pin_hash, 'GIZLI-PIN')
    assert.equal(tam.tablolar.appointments.satirlar[0].appointment_date, '2026-11-02')

    const readme = await readFile(path.join(cikti, 'README.md'), 'utf8')
    assert.ok(readme.includes('`isletmeler/guzel-sac/`'))
    assert.ok(!readme.includes('Demo |'))
  } finally {
    await rm(cikti, { recursive: true, force: true })
  }
})

test('temizle: eski gunler silinir, bos klasor kalkar, README kalir', async () => {
  const kok = await mkdtemp(path.join(tmpdir(), 'saklama-'))
  try {
    const yaz = async (yol) => {
      await mkdir(path.dirname(path.join(kok, yol)), { recursive: true })
      await writeFile(path.join(kok, yol), 'x')
    }
    await yaz('README.md')
    await yaz('isletmeler/a/2026-10-31.xlsx')
    await yaz('isletmeler/a/2026-01-01.xlsx')
    await yaz('isletmeler/kapanan/2026-02-01.xlsx')
    await yaz('tam/2026-10-31.json.gz')
    await yaz('tam/2026-03-01.json.gz')
    const s = await temizle({ dizin: kok, bugun: BUGUN, gun: 90 })
    assert.deepEqual(s, { silinen: 3, bosKlasor: 1 })
    assert.deepEqual(await readdir(path.join(kok, 'isletmeler')), ['a'])
    assert.deepEqual(await readdir(path.join(kok, 'isletmeler', 'a')), ['2026-10-31.xlsx'])
    assert.deepEqual(await readdir(path.join(kok, 'tam')), ['2026-10-31.json.gz'])
    assert.ok((await readdir(kok)).includes('README.md'))
  } finally {
    await rm(kok, { recursive: true, force: true })
  }
})
