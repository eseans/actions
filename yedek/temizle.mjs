#!/usr/bin/env node
// Saklama: yedek deposunda son N gunden eski gunluk dosyalari siler.
//   node yedek/temizle.mjs --dizin <backups-klonu> --bugun YYYY-AA-GG [--gun 90]
// Yalniz isletmeler/*/ ve tam/ altindaki TARIH.xlsx / TARIH.json.gz
// dosyalarina dokunur; baska her sey (README, elle konmus not) kalir.
import { readdir, rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { eskiDosyalar, trTarihi } from './yardimci.mjs'

async function klasorler(kok) {
  try {
    return (await readdir(kok, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => path.join(kok, d.name))
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

async function dosyalar(dizin) {
  try {
    return (await readdir(dizin, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name)
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

export async function temizle({ dizin, bugun, gun }) {
  const hedefler = [...(await klasorler(path.join(dizin, 'isletmeler'))), path.join(dizin, 'tam')]
  let silinen = 0
  let bosKlasor = 0
  for (const d of hedefler) {
    const adlar = await dosyalar(d)
    for (const ad of eskiDosyalar(adlar, bugun, gun)) {
      await rm(path.join(d, ad))
      silinen++
    }
    // Kapanmis isletmenin klasoru son dosyasi da dusunce kaldirilir.
    if (adlar.length && (await readdir(d)).length === 0) {
      await rmdir(d)
      bosKlasor++
    }
  }
  return { silinen, bosKlasor }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { values } = parseArgs({
    options: { dizin: { type: 'string' }, bugun: { type: 'string' }, gun: { type: 'string', default: '90' } },
  })
  if (!values.dizin) {
    console.error('--dizin gerekli')
    process.exit(1)
  }
  temizle({ dizin: values.dizin, bugun: values.bugun || trTarihi(), gun: Number(values.gun) })
    .then(({ silinen, bosKlasor }) => console.log(`Saklama: ${silinen} eski dosya, ${bosKlasor} bos klasor silindi.`))
    .catch((e) => {
      console.error(`TEMIZLIK BASARISIZ: ${e.message}`)
      process.exit(1)
    })
}
