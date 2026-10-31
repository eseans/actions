# eseans/actions

eSeans'in zamanlanmis isleri (GitHub Actions). Depo herkese acik oldugu icin
Actions dakikalari sinirsizdir; **hicbir cikti bu depoya yazilmaz**, ve is
gunluklerine yalniz sayilar yazilir (isletme adi, telefon, e-posta asla).

## Gunluk yedek (`.github/workflows/yedek.yml`)

Her gun 00:30 UTC (03:30 Turkiye) veritabaninin tamamini okur ve **ozel**
`eseans/backups` deposuna yazar:

```
isletmeler/<isletme-slug>/<YYYY-AA-GG>.xlsx   isletme basina gunluk Excel
tam/<YYYY-AA-GG>.json.gz                       tum tablolar, tum satirlar (geri yukleme)
README.md                                      duzen aciklamasi + isletme dizini
```

- **Excel**: ilk sekme "Ozet" (isletme bilgisi, bolum basina kayit sayisi),
  sonra her bolum ayri sekme (Randevular, Musteriler, Hizmetler, Personel,
  Gelir Gider, Stok, Tedavi..., Abonelik, Faturalar...). Baslik satiri sabit,
  filtreli; tarihler gercek tarih (Turkiye saati), `_kurus`/`_minor` kolonlari
  TL'ye cevrilir; musteri/hizmet/personel kimliklerinin yanina adlari eklenir.
  Gizli kolonlar (adinda hash/token/secret/password/api_key/otp gecen) Excel'e
  **girmez**. Platform-ici tablolar (risk, ortaklik komisyonu, e-posta kayitlari;
  bkz. `yedek/etiketler.mjs` -> `ISLETMEYE_GITMEYEN`) Excel'e girmez.
  `internal = true` (demo/test) isletmelere Excel uretilmez.
- **Tablolar dinamik**: `information_schema`'dan okunur; `business_id`
  kolonu olan her yeni tablo kendiliginden Excel'e (ham adiyla) girer.
  Turkce sekme/kolon adi icin `yedek/etiketler.mjs`'e ekleyin.
- **Tam kopya** (`tam/*.json.gz`): tum `public` tablolar, tum kolonlar
  (gizliler dahil), Postgres metin bicimiyle. Isletmeye gonderilmez.
- **Tutarlilik**: tum okuma tek `REPEATABLE READ READ ONLY` islemde yapilir.
- **Hata**: bir tablo bile okunamazsa is kirmizi biter ve hicbir sey
  gonderilmez (yarim yedek yok). GitHub, zamanlanmis is basarisiz olunca
  is akisini en son degistiren kisiye e-posta atar.
- **Saklama**: son 90 gun (`SAKLAMA_GUN`). Daha eski gunluk dosyalar silinir.
  Yedek deposu her calismada **tek commit** olarak force-push edilir; boylece
  git gecmisi birikmez, depo boyutu ~90 gunluk veriyle sinirli kalir.
  Emniyet: bir calismada mevcut Excel'lerin yarisindan fazlasi silinecekse
  gonderim durur.

### Gerekli gizli degiskenler (Settings -> Secrets -> Actions)

| Ad | Ne icin |
|---|---|
| `DATABASE_URL_POSTGRES` | Postgres baglanti dizesi. **IPv4 erisimli pooler adresi olmali** (`...pooler.supabase.com`); `db.<ref>.supabase.co` dogrudan adresi yalniz IPv6'dir ve GitHub runner'larindan baglanamaz. `sslmode` parametresi kod tarafinda atilir, baglanti yine sifrelidir. |
| `BACKUPS_REPO_GITHUB_TOKEN` | `eseans/backups` uzerinde Contents: read & write yetkili fine-grained token. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Su an kullanilmiyor (pg dogrudan baglanir). |

`eseans/backups` deposunun `main` dalinda force-push engelleyen bir dal
korumasi **olmamali** (yoksa gonderim reddedilir).

### Elle calistirma

GitHub -> Actions -> "Gunluk yedek" -> **Run workflow**.

### Yerelde deneme (gercek veri olmadan)

```sh
npm install
npm test                     # birim testleri + uydurma veriyle uctan uca
npm run yedek:kuru           # cikti-kuru/ altina ornek Excel/JSON/README uretir
```

`--kuru` veritabanina baglanmaz (`yedek/ornek-veri.mjs`). Gercek musteri
verisini yerel makineye indirmeyin; gercek yedek yalniz Actions'ta calisir.

### Geri yukleme (tam kopyadan)

```sh
gunzip -c tam/2026-10-31.json.gz | jq '.tablolar.customers.satirlar | length'
```

Her tablo `{ kolonlar: [{ad, tip}], satirlar: [...] }`. Degerler Postgres'in
metin bicimindedir; `insert ... select * from json_populate_recordset(null::<tablo>, $1)`
ile tabloya geri yazilabilir (yabanci anahtar sirasina dikkat: once
`businesses`, sonra `customers/services/staff`, sonra digerleri).
