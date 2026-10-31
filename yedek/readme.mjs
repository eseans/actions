// eseans/backups deposunun kokundeki README.md: her gun yeniden yazilir.
// Sistem coktugunde bunu okuyan kisi (belki teknik olmayan) neyin nerede
// oldugunu ve isletmeye hangi dosyayi gonderecegini hemen anlamali.

function mdKacis(s) {
  return String(s ?? '').replace(/[|\\`*_[\]<>]/g, (c) => `\\${c}`).replace(/\s+/g, ' ').trim()
}

export function readmeMetni({ bugun, gun, isletmeler, tabloSayisi, satirSayisi }) {
  const satirlar = isletmeler
    .slice()
    .sort((a, b) => a.klasor.localeCompare(b.klasor))
    .map((i) => `| \`isletmeler/${i.klasor}/\` | ${mdKacis(i.ad)} | ${i.kayit} |`)

  return `# eSeans günlük yedekleri

> Bu dosya her gün otomatik yazılır (eseans/actions → \`.github/workflows/yedek.yml\`). Elle düzenlemeyin.

Son yedek: **${bugun}** · ${isletmeler.length} işletme · ${tabloSayisi} tablo · ${satirSayisi} satır

## Klasör düzeni

\`\`\`
isletmeler/<isletme-adresi>/<YYYY-AA-GG>.xlsx   ← işletme başına günlük Excel
tam/<YYYY-AA-GG>.json.gz                         ← tüm veritabanının tam kopyası
README.md                                        ← bu dosya
\`\`\`

### \`isletmeler/\` — işletmeye gönderilecek Excel dosyaları

- Her işletmenin ayrı klasörü vardır; klasör adı işletmenin eSeans adresidir (slug).
- Her gün bir dosya: \`2026-10-31.xlsx\` gibi. Dosya, o günün sabahı (03:30 TR) alınan kopyadır.
- Excel'de ilk sekme **Özet**: işletme bilgileri, yedek zamanı ve her bölümün kayıt sayısı.
- Diğer sekmeler bölümlerdir: Randevular, Müşteriler, Hizmetler, Personel, Gelir Gider, Stok,
  Tedavi Planları / Kalemleri / Notları (klinikler), Mesajlar, Kuponlar, Abonelik, Faturalar …
- Kimlik kolonlarının ("Müşteri No" gibi) yanında okunur ad da vardır ("Müşteri").
- Tarihler Türkiye saatiyle, kuruş tutarları TL'ye çevrilmiş olarak yazılır.
- Şifre özeti, oturum anahtarı, paylaşım bağlantısı gibi **gizli alanlar Excel'e konmaz**.
- Demo/test işletmeleri (\`internal\`) burada yoktur; onlar yalnız tam kopyadadır.

**Sistem çökerse:** ilgili işletmenin klasöründeki en yeni \`.xlsx\` dosyasını işletmeye gönderin.
Excel, LibreOffice, Google E-Tablolar veya Numbers ile açılır; işletme randevularını, müşterilerini ve
kasasını oradan takip ederek çalışmaya devam edebilir.

### \`tam/\` — makineyle geri yükleme kopyası

- Tüm \`public\` tabloların **tüm satırları ve tüm kolonları** (gizli kolonlar dahil), gzip'li JSON.
- Biçim: \`{ "alinma": ISO-zaman, "tablolar": { "<tablo>": { "kolonlar": [{ "ad", "tip" }], "satirlar": [ … ] } } }\`
- Tarih/sayı değerleri Postgres'in metin biçimindedir (birebir geri yazılabilir).
- Bu dosya gizli alanlar içerir: **işletmelere gönderilmez**, depo dışına çıkarılmaz.
- Açmak için: \`gunzip -c tam/${bugun}.json.gz | jq '.tablolar | keys'\`

## Saklama süresi

Her klasörde son **${gun} gün** tutulur; daha eski günlük dosyalar her çalışmada silinir.
Depo geçmişi şişmesin diye her çalışma tek bir commit olarak yazılır (eski commit'ler tutulmaz);
yani geçmiş günlere dosya adından (tarih) ulaşılır, git geçmişinden değil.

## İşletmeler

| Klasör | İşletme | Toplam kayıt |
|---|---|---|
${satirlar.join('\n')}
`
}
