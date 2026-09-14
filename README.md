# Veri Görsel — Bklit grafik stüdyosu (tek dosya, çevrimdışı)

Kurum içi slaytlar için grafik üreten, **tek HTML dosyasında** çalışan bir
araç. Çıktı `veri-gorsel.html` (derleme `dist/index.html` üretir ve kök
dizine bu adla kopyalar): React, Bklit grafikleri ve stiller dosyanın içine
gömülü; dış istek yapmaz, `file://` üzerinden açılır, internet gerekmez.
Paylaşmak için yalnız bu dosyayı gönderin.

## Kullanım (son kullanıcı)

1. `veri-gorsel.html` dosyasını Chrome ya da Edge ile açın (çift tık yeter).
2. Sol üstten grafik türünü seçin: Sütun, Yatay çubuk, Çizgi, Alan, Halka,
   Isı takvimi, Akış (Sankey).
3. **Veri** sekmesinde tabloyu doldurun. Excel'den kopyalayıp doğrudan
   hücreye yapıştırabilirsiniz (çok satırlı yapıştırma tabloyu genişletir);
   `Yapıştır` düğmesi tüm tabloyu değiştirir; CSV/JSON yükleme ve indirme var.
4. **Görünüm**: başlık, alt başlık, dipnot, kart boyutu (16:9 hazır oranlar),
   eksenler, ızgara, gösterge konumu, sayı biçimi (1.250,5 / 1,250.5, ondalık,
   ön ek/son ek, kısaltma).
5. **Renkler**: dört palet (varsayılan palet renk körlüğü için doğrulanmış)
   ve seri başına özel renk.
6. **Süsle**: doku, ışık ve çerçeve zemin olarak seçilir (üçü aynı anda
   durabilir); ışık, ok, ikon, işaret ve balonlar galeriden tıklanıp karta düşer,
   sahnede sürüklenir, köşeden boyutlandırılır, üstteki tutamaçtan
   döndürülür. Renkleri varsayılan olarak grafiğin paletinden gelir.
   Kısayollar: `Shift` eksene/orana/15°'ye kilitler, ok tuşları 1 px
   (`Shift` ile 10 px) kaydırır, `Del` siler, `Ctrl+D` çoğaltır, `Esc`
   seçimi bırakır. Süslemeler PNG, PPTX ve SVG çıktılarına girer.

   Işıklar iki yerde birden: **Zemin**'den seçilince tüm kartı yıkar,
   **Galeri**'den eklenince yalnız kendi kutusunu aydınlatır ve diğer
   nesneler gibi taşınıp boyutlandırılır.

   Aynı sekmedeki **Serbest yerleşim** anahtarı kartın kendi parçalarını —
   başlık bloğu, grafik ve dipnot — da sürüklenebilir yapar. Açıldığı anda
   kutular öğelerin o anki yerlerinden ölçülür, yani görüntü değişmez;
   sonrasında kesik kırmızı çerçeveli kutulardan tutup taşır, köşeden
   boyutlandırırsınız. `Kutuları sıfırla` kartın kendi akışına geri döner.
   (Kart parçaları döndürülmez: dönmüş bir eksen etiketi okunmaz.)
7. **Dışa aktar**: `PNG indir` (1×–4×), `Panoya kopyala` (PowerPoint'e Ctrl+V),
   `SVG indir`, tema ya da şeffaf arka plan. **PowerPoint**: `Slayt olarak indir`
   tek grafiği, `Tüm grafikler` çalışma alanındaki her grafiği birer 16:9 slayt
   olarak .pptx dosyasına yazar; açıp slaytları kendi sununuza sürükleyin.

Çalışma alanı tarayıcının yerel deposunda kendiliğinden saklanır. Başka bir
makineye taşımak için `Kaydet (JSON)` / `Yükle` kullanın.

Açık/koyu tema sağ üstte. `index.html?kind=ring&theme=dark` gibi bir adres o
türde yeni bir grafikle açar.

## Geliştirme

```
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/index.html + veri-gorsel.html — tek dosya
pnpm typecheck
pnpm test:parse   # sayı / tarih / CSV ayrıştırma birim testleri (Node, bağımlılık yok)
pnpm kontrol      # node scripts/cdp-check.mjs [kind] [theme] [sekme] — headless Chrome duman testi
pnpm test:susle   # süslemeler dışa aktarımda hayatta kalıyor mu — piksel ölçer
pnpm test:yerlesim # serbest yerleşim ve hover anahtarı — gerçek fare olaylarıyla
```

`pnpm test:susle` her varlık ailesinden bir örneği boş bir kartın köşesine
koyar, PNG'ye aktarır ve o köşedeki pikseli geri okur — `mask`, `feTurbulence`
ve `pattern` `<foreignObject>` hattında sessizce düşebildiği için tek güvenilir
kontrol bu. SVG indirmeyi de gerçek düğmesinden sürer. Bir varlık kaybolursa
betik 1 ile çıkar.

`pnpm test:yerlesim` serbest yerleşimi açıp kartı piksel piksel karşılaştırır
(açmak görüntüyü değiştirmemeli), grafik kutusunu gerçek fare olaylarıyla
sürükleyip boyutlandırır ve hover anahtarının ipucunu gerçekten kaldırdığını
doğrular. İkisi de `scripts/cdp.mjs` içindeki ortak sürücüyü kullanır.

`pnpm kontrol` derlenmiş dosyayı headless Chrome'da açar, konsol hatalarını
yazar, ekran görüntüsü alır ve PNG dışa aktarımını çalıştırır
(`scripts/out/`). İsteğe bağlı üçüncü argüman sol paneldeki sekmeyi açar
(1 Veri, 2 Görünüm, 3 Renkler, 4 Süsle, 5 Dışa aktar). `DUMP_MARKUP=1` dışa aktarımın ara SVG'sini,
`EVAL_FILE=dosya.js` ise o dosyadaki ifadeyi sayfada çalıştırıp sonucunu
yazar. pnpm 11'de esbuild'in kurulum betiği `pnpm-workspace.yaml` içindeki
`allowBuilds` ile onaylıdır; `pnpm approve-builds` gerekmez.

## Mimari

- `src/charts/` — **Bklit** kaynağı, coretex-hub'daki kopyadan alındı
  (üç hata düzeltmesi dâhil: yatay yığılı bar genişliği, giriş animasyonu,
  Sankey kaynak düğüm etiketi). Elden geldiğince dokunulmaz.
- `src/ext/axes.tsx` — Bklit eksen sayı etiketi çizmez; bu katman aynı chart
  context'ini okuyarak `<text>` ekler. `displayName` değerleri Bklit'in
  clip-dışı listesindeki adlardır (`XAxis`, `YAxis`, `BarXAxis`).
- `src/lib/adapters.ts` — tablo → her grafiğin veri biçimi. Çizgi/alan
  grafikte kategorik x, içeride eşit aralıklı sanal tarihe eşlenir; etiketler
  kullanıcının yazdığı gibi kalır.
- `src/lib/zip.ts`, `src/lib/pptx.ts` — kütüphanesiz .pptx: STORE yöntemli ZIP
  yazıcı + en küçük OOXML paketi (presentation, master, boş layout, tema, slayt
  başına bir PNG). `pnpm test:pptx` örnek dosya üretir; PowerPoint COM ile
  doğrulandı.
- `src/lib/export-png.ts` — DOM klonu + hesaplanmış stil gömme +
  `<foreignObject>` → canvas → PNG. Kütüphane yok. `data:` URL kullanılır;
  `file://` üzerinde `blob:` URL canvas'ı kirletir (opak origin).
- `src/decor/` — SVG süsleme paketi. `types.ts` sözleşme ve geometri
  yardımcıları; `textures/lights/frames/arrows/icons/marks/balloons` varlık
  aileleri; `registry.ts` tek arama noktası; `model.ts` kaydedilen biçim
  (React'ten ve kayıttan bağımsız, bu yüzden `spec.ts` onu döngüsüz
  import edebiliyor); `DecorLayer.tsx` kartın içinde çizer. Her varlık
  kutusunun **gerçek piksel boyutunda** çizer — sabit bir viewBox'ı esnetmez,
  bu yüzden 400×60 bir ok ile 90×90 bir ikon aynı kalitede çıkar. Hiçbir
  varlık dosya değil, hepsi koddan üretilir.
- Serbest yerleşim `ChartSpec.yerlesim` içinde: üç kutu (`baslik`, `grafik`,
  `dipnot`) kart uzayında, süslemeyle **aynı koordinat sisteminde**. Kutu
  varsa o öğe mutlak konumlanır, yoksa kart eskisi gibi kendi akışını kurar.
  Kutular hesaplanmaz, canlı karttan ölçülür — başlığın yüksekliği yazı
  tipine, grafiğinki gösterge konumuna bağlı, tahmin etmek zıplamaya yol açar.
- `src/components/DecorStage.tsx` — sahnedeki tutamaç katmanı. Süsleme
  nesneleri ve kart parçaları tek bir tutamaç listesinde birleşir; kart
  parçalarının kimliği `slot:` önekiyle ayrılır.
- `src/components/ChartCard.tsx` — slayt kartı. Sahnede ve ekran dışı dışa
  aktarımda aynı bileşen, aynı piksel boyutu.
- Token'lar `src/index.css` içinde: açık palet `:root`, koyu palet
  `:root[data-theme="dark"]`; Bklit'in `--chart-*`/`--legend-*` adları
  Tailwind `@theme inline` ile utility'lere bağlanır.

### Bilinen sınırlar

- Yazı tipi sistem yığını (Segoe UI / system-ui); PNG ekrandakiyle aynı çıkar
  ama makineler arasında yazı tipi farkı olabilir.
- Halka merkezi düz metin çizer (Bklit'in NumberFlow'u shadow DOM kullanır,
  serileştirmeye girmez).
- Dışa aktarım statik bir kopya çizer: giriş animasyonu sıfır süreli
  (`enterTransition`), ayrıca karttaki tüm WAAPI animasyonları bitene kadar
  (en çok 3 s) beklenir. Sankey dâhil her tür bitmiş hâliyle alınır.
- SVG indirme çizim alanını ve süslemeyi içerir; başlık ve gösterge HTML
  olduğu için dışarıda kalır. PNG ve PPTX ise kartın tamamını verir.
- Süsleme katmanları `z-index` ile sıralanır ve kartın kendi içeriği
  `z-index: 1`'e sabitlenmiştir. Bu şart: sahnedeki kartta `scale()` dönüşümü
  sessizce bir yığın bağlamı kurar, ekran dışı dışa aktarım kartında kurmaz —
  negatif `z-index` kullanan ilk sürüm ekranda doğru görünüp her PNG'de
  kayboluyordu.
