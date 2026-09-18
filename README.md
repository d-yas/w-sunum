# Veri Görsel — Bklit grafik stüdyosu (tek dosya, çevrimdışı)

Kurum içi slaytlar için grafik üreten, **tek HTML dosyasında** çalışan bir
araç. Çıktı `veri-gorsel.html` (derleme `dist/index.html` üretir ve kök
dizine bu adla kopyalar): React, Bklit grafikleri ve stiller dosyanın içine
gömülü; dış istek yapmaz, `file://` üzerinden açılır, internet gerekmez.
Paylaşmak için yalnız bu dosyayı gönderin.

## Kullanım (son kullanıcı)

Pencere üç sütun: **solda** katman listesi ve veri tablosu, **ortada** kart,
**sağda** seçili olan neyse onun ayarları. Kartın **altında** grafik şeridi,
**üstünde** yüzen araç çubuğu durur. Sağ panelde sekme yok: karttaki bir
parçaya tıklamak onu seçer ve panel o parçanın ayarlarını gösterir — başlığa
tıklayın, yalnız Metin görünür; grafiğe tıklayın, tür, eksen, gösterge ve
etiket ayarları gelir; boşluğa tıklayın (ya da `Esc`), slaytın kendi ayarları
kalır. Bir kategoriyi vurgulamak `Alt+tık`.

Kartın üstünde **yüzen araç çubuğu** durur: seçim ve el araçları, serbest
yerleşim modu, `+` ile süsleme galerisi, palet ve dışa aktarım. Eskiden sağ
panelin sekmeleriydi; artık hangi ayardaysanız orada duruyorlar.

1. `veri-gorsel.html` dosyasını Chrome ya da Edge ile açın (çift tık yeter).
2. Sağ panelin başındaki **Değiştir** ile grafik türünü seçin. Türler beş
   grupta toplanır:
   - **Karşılaştırma** — Sütun, Yatay çubuk, Marimekko, Şelale, Huni
   - **Zaman ve eğilim** — Çizgi, Alan, Eğim, Isı takvimi
   - **Pay ve bileşim** — Halka, Gösterge, Ağaç haritası, Güneş patlaması,
     Daire yığını, Piktogram
   - **İlişki ve dağılım** — Dağılım, Balon, Radar, Akış (Sankey), Akor, Ağ, Yay
   - **Coğrafya** — Harita (boyalı ya da kabarcık; dünya / kıta / Türkiye ve
     çevresi / **Türkiye'nin 81 ili**)

   Tür düğmesinin üstünde durmak o türün **örnek çizimini** gösterir; hangi
   ikonun neye karşılık geldiğini aramak gerekmez.

   Aynı tablo biçimini paylaşan türler arasında geçerken veriniz korunur
   (örneğin Sankey → Akor → Ağ → Yay, ya da Sütun → Radar → Marimekko);
   biçim değişince örnek veri gelir.
3. **Sol alttaki tabloyu** doldurun. Excel'den kopyalayıp doğrudan hücreye
   yapıştırabilirsiniz (çok satırlı yapıştırma tabloyu genişletir); `Yapıştır`
   düğmesi tüm tabloyu değiştirir; CSV/JSON yükleme ve indirme var. Katman
   listesi ile tablo arasındaki çizgiyi sürükleyerek ikisinin payını
   değiştirebilirsiniz.

   **Kartın altındaki şeritte** her grafiğin küçük resmi duruyor — resim
   gerçek dışa aktarım çıktısı, yani şeritte gördüğünüz şey indireceğiniz şey.
   Ada çift tıklayarak yeniden adlandırın, kartın üzerindeki düğmelerle
   kopyalayın, silin ya da `←`/`→` düğmeleriyle sırasını değiştirin.

   Şerit sunum araçlarının slayt şeridi gibi davranır:

   - **Sürükleyin**, sıra değişir; aradaki kartlar yer açar, bırakma yeri dikey
     bir çizgiyle gösterilir. Şeridin kenarına geldiğinizde şerit kendiliğinden
     kayar, yani onuncu slaydı başa taşımak için önce kaydırmak gerekmez.
   - **Tekerlek** şeridi yatay kaydırır.
   - **Ok tuşları** kartlar arasında gezer (`Home`/`End` uçlara gider), seçilen
     kart görünür alana kendiliğinden gelir.
   - **İki kartın arasına** gelince çıkan `+` yeni grafiği tam oraya ekler;
     sona eklemek için şeridin sonundaki düğme duruyor. İkisi de aynı tür
     kutusunu yukarı açar: 23 türün hepsi tek bakışta görünür.
4. **Grafik seçiliyken**: başlık, alt başlık, dipnot, kart boyutu (16:9 hazır oranlar),
   gösterge konumu, sayı biçimi (1.250,5 / 1,250.5, ondalık, ön ek/son ek,
   kısaltma). Tür-özel bölümler de burada:

   - **Biçim** — çubuk köşe yarıçapı 0–24 px (0 = keskin). Sütun, yatay
     çubuk, şelale, marimekko ve ağaç haritası aynı ayarı okur.
   - **Eksenler** — ızgara, eksen açık/kapalı, değer adımı, **değer aralığı**
     (alt–üst; boş bırakılan uç otomatik), **eksen adları**, **etiket açısı**
     (oto/0°/45°/90°; "oto" sığmayınca kendisi eğer).
   - **Değer etiketleri** — sütun, çizgi, alan, halka ve ısı takviminde
     sayıyı markın üstüne yazar. `Oto` her türün kendi geleneği: şelale ve
     piktogram yazar, diğerleri yazmaz. `Dışta`/`İçte` yerleşimi seçer;
     içteki etiket zemine göre koyu ya da açık olur ve sığmıyorsa hiç
     yazılmaz. Çizgide "yalnız son nokta" seçeneği var.
   - **Sıralama ve vurgu** — kategorileri değere göre dizer; vurgulanan
     kategoriler tam opak kalır, gerisi soluklaşır. Vurguyu panelden değil
     **grafikte çubuğa tıklayarak** seçmek daha kolay (`Shift` ekler/çıkarır).
   - **Referans çizgileri** — hedef, eşik ya da ortalama; değer, etiket, renk
     ve kesikli/düz. Dekor okundan farkı: bunlar veri uzayında durur, tabloyu
     değiştirince yerini korur.
   - **Çizgi / Alan** — eğri türü, kalınlık, işaretçiler, dolgu gradyanı ve
     **tahmin kesiği** (şu satırdan sonrası kesikli; 1 yazarsanız tüm çizgi).
5. **Renkler** (araç çubuğundaki palet düğmesi): dört hazır palet (varsayılan palet renk körlüğü için
   doğrulanmış) ve seri başına özel renk. `+ Palet ekle` seçili paletin
   kopyasından **kendi paletinizi** açar: adını yazın, renkleri tek tek
   değiştirin, `+`/`−` ile renk sayısını ayarlayın. Özel palet çalışma
   alanıyla birlikte kaydedilir ve açık/koyu temada aynı kalır — kurumsal
   renk bir marka kararıdır, bakımı gereken ikinci bir set değil. Sıra
   önemlidir: seriler bu sırayla boyanır ve süsleme ilk rengi kullanır.
5a. **Stili kopyala / yapıştır** (slayt ayarlarında **Stil**): bir kartın
   görünümünü alıp başkasına geçirir. `Ctrl+Alt+C` kopyalar, `Ctrl+Alt+V`
   yapıştırır, `Tümüne uygula` aktif kartın görünümünü diğer bütün grafiklere
   verir — "şunu şablon yap" tek düğme.

   Taşınan: palet ve seri renkleri, kart ölçüsü ve kenar boşlukları, eksen /
   ızgara / gösterge anahtarları, değer etiketleri, sayı biçimi, köşe
   yarıçapı, kart dekoru, süsleme ve serbest yerleşim. **Taşınmayan:** veri,
   tür, başlık, alt başlık, dipnot ve *bu karta ait olan* ayarlar — vurgulanan
   kategori, eksen adları, değer aralığı (`yMin`/`yMax`), referans çizgileri,
   tahmin başlangıcı. Sınır tek cümleyle: yazdığınız metin, bu kartın
   verisinden gelen bir ad, bir satır numarası ya da bir değer aralığı biçem
   değildir. Liste `src/lib/bicem.ts` içinde `ICERIK_ALANLARI` — **dışlama**
   listesi, yani sonradan eklenen bir ayar varsayılan olarak biçeme dâhil.

   Pano oturumluk: iş dosyasına yazılmıyor, geri al yığınına girmiyor.

5b. **Metin kutusu ve bağlantı** — araç çubuğunun iki jesti:

   - **`T`** (Metin kutusu): karta tıklayın, kutu oraya düşer ve **yazma
     doğrudan açılır**. Çok satırlı; satırlara bölmeyi uygulama yapıyor, yani
     kutuyu daraltınca metin sarar. Yüksekliği metne bağlı — kenardan
     genişletirsiniz, boy kendiliğinden ayarlanır; sabit bir boy istiyorsanız
     **Yükseklik: Sabit**. Punto, kalınlık, hiza, satır aralığı, iç boşluk,
     dolgu/kenar kutusu ve köşe yarıçapı seçilir. Yazı tipi kartın kendi yazı
     tipidir; kart genelinde tek bir tipografi olması bilinçli.
   - **`L`** (Bağlantı): kartta sürükleyin. Çıkan şey **iki uçlu** bir çizgi,
     kutu içinde döndürülen bir ok değil: her ucun kendi tutamağı var, birini
     çekince öteki yerinde kalır. Kalınlık, düz/kesik/noktalı, iki uca ayrı
     ayrı ok/nokta/çizgi başı ve büküm. "Şu çubuktan şu yazıya" demenin yolu bu.

   Yerleştirilmiş her metni **çift tıklayarak** sahnede düzenlersiniz — balon
   ve rozet yazıları da dâhil. `Ctrl+Enter` ya da başka bir yere tıklamak
   bitirir, `Esc` yazmadan önceki hâle döner. Katman listesinde metin katmanları
   yazılarının ilk satırıyla adlanır.

6. **Süsleme**: doku, ışık ve çerçeve slayt ayarlarından zemin olarak seçilir
   (üçü aynı anda durabilir); metin, şekil, ok ve ikonlar araç
   çubuğundaki `+` galerisinden tıklanıp karta düşer,
   sahnede sürüklenir, köşeden boyutlandırılır, üstteki tutamaçtan
   döndürülür. Renkleri varsayılan olarak grafiğin paletinden gelir.
   **Şekiller** — dikdörtgen, kare, hap, daire, elips, üçgen, baklava,
   çokgen (3–12 kenar), yıldız, artı, çizgi — anlamı olmayan tek aile:
   bir alanı boyamak, bir bloğun arkasına renk koymak için. Hepsi aynı
   biçem anahtarını paylaşır (dolu / yalnız kenar / ikisi), kenar rengi
   ikinci renkten gelir, yani "gri dolgu + koyu kenar" tek nesneyle kurulur.

   **Gruplama**: `Shift`+tık seçime ekler (sahnede ya da katman listesinde),
   `Ctrl+G` gruplar, `Ctrl+Shift+G` çözer. Gruplanmış nesneler birlikte
   taşınır ve birine tıklamak hepsini seçer; yığında da yan yana toplanırlar,
   yoksa "grubu bir üste taşı" diye bir şey olamazdı. Boyutlandırma ve
   döndürme tek nesneye özeldir.

   Kısayollar: `V` seç, `H` kaydır, `T` metin kutusu, `L` bağlantı; `Shift`
   eksene/orana/15°'ye kilitler, ok tuşları 1 px (`Shift` ile 10 px) kaydırır,
   `Del` siler, `Ctrl+D` çoğaltır, `Esc` seçimi bırakır. Süslemeler PNG, PPTX
   ve SVG çıktılarına girer — metin kutusu gerçek bir SVG `<text>`, bağlantı
   gerçek bir `<path>`.

   Işıklar iki yerde birden: **Zemin**'den seçilince tüm kartı yıkar,
   **Galeri**'den eklenince yalnız kendi kutusunu aydınlatır ve diğer
   nesneler gibi taşınıp boyutlandırılır.

6a. **Katmanlar** (sol sütunun ortası) kartın içindeki her şeyin tek
   listesidir — Figma'nın katman paneli gibi çalışır. Liste slaytla aynı
   sırada durur: **üstteki en önde.**

   - **Kart parçaları şeridi** — Başlık bloğu, Grafik ve Dipnot listenin
     ortasında sabit durur. Üstündeki her şey grafiğin önünde, altındaki her
     şey arkasındadır; bir satırı şeridin öte yanına sürüklemek katmanını da
     değiştirir. Kısayol olarak `[` ve `]` seçiliyi bir basamak oynatır,
     `Shift` ile uca gönderir.
   - **Zemin yuvaları** listenin dibinde kendi satırlarını alır (Çerçeve,
     Doku, Işık); gözleri zemini kapatır. Bunlar tanımı gereği kartın
     arkasındadır, o yüzden satırları sürüklenmez — bir zemini **öne almak**
     için sağ tık → *Nesneye dönüştür*: kart boyunda, grafiğin önünde,
     taşınıp boyutlandırılabilir bir katmana döner ve görüntü birebir aynı
     kalır. (Aynı ışığı doğrudan **Galeri → Işık**'tan da ekleyebilirsiniz;
     o zaman kendi kutusu kadar yer kaplar ve varsayılan olarak arkaya
     düşer — listede şeridin üstüne sürükleyerek öne alın.)
   - **Gruplar** açılıp kapanan düğümlerdir: başlığa tıklamak grubun tamamını
     seçer, çocuğa tıklamak yalnız onu. Bir satırı grubun üyeleri arasına
     bırakmak onu gruba katar; çıkarmak için sağ tık → *Gruptan çıkar*.
   - **Göz ve kilit** satırın üstüne gelince çıkar, ama **kapalı** olan hep
     görünür: bir katmanın neden görünmediğini aramak gerekmesin. Gizli
     katman soluk, kilitli katman eğik yazılır.
   - **Ad**: çift tık (ya da `F2`) satırı yeniden adlandırır; verilmemişse
     varlığın kendi etiketi görünür. Üstteki kutu adlarda arar.
   - **Seçim**: tık seçer, `Shift`+tık aralık alır, `Ctrl`/`Cmd`+tık ekler ya
     da çıkarır. `↑`/`↓` satır gezer, `←`/`→` grup açıp kapatır.
   - **Sağ tık** menüsü: yeniden adlandır, çoğalt, grupla / grubu çöz,
     gruptan çıkar, en öne / en arkaya, gizle, kilitle, sil.

   Araç çubuğundaki **serbest yerleşim** düğmesi kartın kendi parçalarını —
   başlık bloğu, grafik ve dipnot — da sürüklenebilir yapar. Bir mod: açıkken
   parçalar tutamaç kutularının altında kaldığı için grafiğin fare ipuçları
   susar. Durum her grafiğe özeldir ve kaydedilir. Açıldığı anda
   kutular öğelerin o anki yerlerinden ölçülür, yani görüntü değişmez;
   sonrasında kesik kırmızı çerçeveli kutulardan tutup taşır, köşeden
   boyutlandırırsınız. `Kutuları sıfırla` kartın kendi akışına geri döner.
   Seçili bir kart parçasına `Del` basmak onu karttan kaldırır — metni
   silmez, gizler; Katmanlar listesindeki göz geri getirir (göz akış
   yerleşiminde de çalışır, serbest kip gerekmez). (Kart parçaları
   döndürülmez: dönmüş bir eksen etiketi okunmaz.)

   Zemin ışıklarının merkezi de sürüklenebilir: kartı tamamen kapladıkları
   için tutulacak bir kutuları yok, onun yerine sahnede bir nişan noktası
   çıkar (Yumuşak küre, Radyal gradyan, Halka dalgaları, Spot konisi).
6b. **Kart dekoru** (slayt ayarlarında): kart arka planına doku
   (nokta, ızgara, yarım ton, çapraz, dalga, ASCII), gradyan yıkama, bloom
   ışıması ve başlık vurgu çubuğu. Galeriden gelen yerleştirilebilir
   nesnelerden ayrı bir katman: bunlar kartın SVG'sine gömülür, elle
   taşınmaz. Renkler grafiğin kendi paletinden gelir; hepsi PNG ve
   PowerPoint çıktısına da geçer.
7. **Dışa aktar** (araç çubuğundaki indirme düğmesi) dört kat:
   - **PNG** — 1×–4×, tema ya da şeffaf arka plan; indir, panoya kopyala
     (PowerPoint'e doğrudan Ctrl+V) ya da tüm grafikleri tek zip olarak indir.
   - **SVG** — kartın tamamı vektör: başlık, gösterge, eksen ve değer
     etiketleri, süsleme dâhil. İndirin, panoya kopyalayıp Illustrator ya da
     Figma'ya yapıştırın, veya hepsini zip olarak alın.
   - **PowerPoint** — tek slayt ya da her grafik bir slayt. Başlık, alt
     başlık, dipnot ve yerleştirdiğiniz bütün metinler (metin kutuları, balon
     ve rozet yazıları) **gerçek metin kutusu** olarak gider: PowerPoint'te
     tıklayıp düzenlersiniz, sununun aramasına ve anahat görünümüne girer.
     Grafik ve süsleme resim olarak, kart oranı korunarak slayta ortalanır —
     ve o resimde yazı **yoktur**, yani hiçbir şey iki kez çizilmez.
     *Slayt boyutu* 16:9, 4:3 ya da **karta göre** (kartın oranını alır ama
     geniş ekran kutusunu aşmaz: 800×600 bir kart tam olarak standart 4:3
     slayt olur). *Çözünürlük* PNG indirmeden ayrı ve varsayılanı 3×: bir
     slayt 13 inç genişliğinde yansıtılıyor, 2× bile yaklaşık 144 DPI.
   - **Çalışma alanı** — bütün grafikler, veriler ve paletler tek JSON'da.

Çalışma alanı tarayıcının yerel deposunda kendiliğinden saklanır. Başka bir
makineye taşımak için `Kaydet (JSON)` / `Yükle` kullanın.

### Kısayollar

| Tuş | İş |
|---|---|
| `Ctrl+Z` | Geri al |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Yinele |
| `Ctrl+S` | Çalışma alanını JSON olarak kaydet |
| `Ctrl+Shift+S` | PNG indir |
| `Esc` | Seçimi bırak |

Geri al yalnız **işi** kapsar: grafikler ve paletler. Tema, yakınlaştırma ve
seçim pencerenin hâli, geri almaya girmez. Yazmak tek adım sayılır —
başlığı harf harf geri almanız gerekmez. Metin kutularının içinde de
uygulamanın geri alması çalışır; tek istisna `Yapıştır` kutusu, orada çok
satırlı metni elle düzenlemek tarayıcının kendi davranışını gerektiriyor.

Süslemelerin kendi kısayolları var (`[`, `]`, `Del`, `Ctrl+D`, ok tuşları);
yukarıdaki listeyle çakışmazlar. `V` seçim aracına, `H` el aracına geçer.

Açık/koyu tema sağ üstte. `index.html?kind=ring&theme=dark` gibi bir adres o
türde yeni bir grafikle açar.

## Geliştirme

```
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/index.html + veri-gorsel.html — tek dosya
pnpm typecheck
pnpm test:parse   # sayı / tarih / CSV ayrıştırma birim testleri (Node, bağımlılık yok)
pnpm kontrol      # node scripts/cdp-check.mjs [kind] [theme] [araç] — headless Chrome duman testi
pnpm test:susle   # süslemeler dışa aktarımda hayatta kalıyor mu — piksel ölçer
pnpm test:yerlesim # serbest yerleşim ve hover anahtarı — gerçek fare olaylarıyla
pnpm test:arayuz  # Del ile kaldırma, katman kısayolu ve sürüklemesi, müfettiş, özel palet, ışık tutamacı
pnpm test:katman  # katman ağacı, ad değiştirme, göz, gruba sürükleme, arama, sağ tık menüsü
pnpm test:metin   # T/L araçları, yerinde yazma, otomatik yükseklik, uç sürükleme
pnpm test:stil    # stili kopyala/yapıştır: neyin taşındığı ve neyin taşınmadığı
pnpm test:sunu    # .pptx paketi: metin kutuları, resimde yazı yokluğu, slayt ölçüsü
pnpm test:kabuk   # üç sütun, küçük resimler, liste eylemleri, geri al, tıkla-seç, tür kutusu, liste sürükleme
pnpm test:secenek # ayarlar çizime ulaşıyor mu — köşe, vurgu, aralık, etiket, referans
pnpm test:svg     # kart SVG'si eksiksiz mi — başlık, gösterge, portal eksenleri
node scripts/gen-country-codes.mjs   # src/lib/country-codes.ts üretir (world-atlas + Node ICU)
```

`pnpm test:susle` her varlık ailesinden bir örneği boş bir kartın köşesine
koyar, PNG'ye aktarır ve o köşedeki pikseli geri okur — `mask`, `feTurbulence`
ve `pattern` `<foreignObject>` hattında sessizce düşebildiği için tek güvenilir
kontrol bu. SVG indirmeyi de gerçek düğmesinden sürer. Bir varlık kaybolursa
betik 1 ile çıkar.

`pnpm test:yerlesim` serbest yerleşimi açıp kartı piksel piksel karşılaştırır
(açmak görüntüyü değiştirmemeli), grafik kutusunu gerçek fare olaylarıyla
sürükleyip boyutlandırır ve hover anahtarının ipucunu gerçekten kaldırdığını
doğrular. `pnpm test:arayuz` panelin dört davranışını gerçek tıklamalarla sürer.
`pnpm test:sunu` üretilen .pptx'i indirme akışından yakalayıp ZIP'ini çözüyor
ve slayt XML'ini okuyor — bir sununun doğruluğu PowerPoint açılana kadar belli
olmuyor. Yalnız metin kutularının varlığına değil, başlığın durduğu şeridin
**resimde boş** olduğuna da bakıyor: XML'de metin kutusu olması, aynı yazının
resimde olmadığı anlamına gelmez.

`pnpm test:stil` iki yönlü bakıyor: taşınması gerekenler taşındı mı,
**taşınmaması** gerekenler yerinde kaldı mı. Sınır yanlış çizilirse kimse fark
etmez — yalnızca bir gün bir kart başka bir kartın eksen adını taşımaya başlar.

`pnpm test:metin` metin kutusunu ve bağlantıyı gerçek fare ve klavyeyle sürer:
`T` ile kutu koyma, yerinde yazma, `Esc` ile iptal, kutuyu genişletince
yüksekliğin düşmesi (sarma satırı azalıyor), `L` ile çizme ve bir ucu çekince
ötekinin yerinde kalması.

`pnpm test:katman` Katmanlar panelini sürer: grubun açılıp kapanması, çift tıkla
ad değiştirme, gözün karttan gerçekten bir şey kaldırması, bir satırı sürükleyip
gruba katmak, arama ve sağ tık menüsü. Hepsi `scripts/cdp.mjs` içindeki ortak
sürücüyü kullanır.

> Özel palet testi boşuna değil: ilk sürümde palet ekrana geçiyor ama dışa
> aktarıma geçmiyordu. `renderStatic`'in memo bağımlılık listesinde
> `ws.palettes` yoktu, yani ekran dışı kart kapanışın kurulduğu andaki
> paletle donuyordu.

`pnpm test:secenek` ve `pnpm test:svg` çizim katmanını **dışa aktarımın ara
SVG'sinden** okur, ekran görüntüsünden değil: kullanıcıya giden şey o. İkisi de
sınıf değil öznitelik arar (`data-part="bar"`, `data-part="value"`) — dışa
aktarım hesaplanmış stili gömerken `class`ı siliyor.

`pnpm test:kabuk` üç sütunun genişliklerini ölçer, küçük resimlerin
üretildiğini bekler, listedeki yeniden adlandırma / kopyala / sırala
düğmelerini tıklar, `Ctrl+Z` ile bir grafiği geri alıp `Ctrl+Y` ile geri
getirir, karttaki başlığa tıklayınca sağ panelin yalnız Metin bölümünü
gösterdiğini, çubuğa `Alt+tık`'ın vurguladığını, araç çubuğundaki üç kutunun
içeriğini ve serbest yerleşim düğmesini doğrular.

`pnpm kontrol` derlenmiş dosyayı headless Chrome'da açar, konsol hatalarını
yazar, ekran görüntüsü alır ve PNG dışa aktarımını çalıştırır
(`scripts/out/`). İsteğe bağlı üçüncü argüman araç çubuğundaki bir kutuyu
açar — adıyla (`ekle`, `renk`, `disa`) ya da sırasıyla (1–3). Betikler bu
düğmeleri indeksle değil `data-tool` özniteliğiyle buluyor: sağ panelin sekme
kümesi geçmişte bir kez değişti ve indeksle yazılmış dört betik birden
kırıldı. `DUMP_MARKUP=1` dışa
aktarımın ara SVG'sini,
`EVAL_FILE=dosya.js` ise o dosyadaki ifadeyi sayfada çalıştırıp sonucunu
yazar. pnpm 11'de esbuild'in kurulum betiği `pnpm-workspace.yaml` içindeki
`allowBuilds` ile onaylıdır; `pnpm approve-builds` gerekmez.

## Mimari

- `src/charts/` — **Bklit** kaynağı, coretex-hub'daki kopyadan alındı
  (üç hata düzeltmesi dâhil: yatay yığılı bar genişliği, giriş animasyonu,
  Sankey kaynak düğüm etiketi). Elden geldiğince dokunulmaz; bugüne kadarki
  dört ek şunlar:
  - `bar.tsx` — `highlightCategories` ve `fillFor` propları, `isFaded`e bir OR
    terimi, ve dört rect biçiminin hepsine `data-part="bar" data-category`
    (tıkla-seç bunu okuyor).
  - `bar-chart.tsx` — `valueDomain` prop'u. Alt sınır 0'a kilitli: `Bar`
    çubuğu `innerHeight`tan büyütüyor, negatif tabanın karşılığı yok.
  - `area-chart.tsx` + `time-series-chart-shell.tsx` — `yDomain` /
    `yDomainOverride`. `nice`tan **sonra** uygulanıyor, yoksa kullanıcının
    yazdığı 95 sessizce 100 olurdu.
- `src/viz/` — Bklit'te karşılığı olmayan, **Flourish şablonlarına denk gelen**
  grafikler; visx ilkelleri üzerine ayrıca yazıldı, `src/charts/` hiç
  değişmedi. Kart, palet, sayı biçimi ve dışa aktarım yolu ortaktır.
  `with-legend.tsx` gösterge yerleşimi ikisi tarafından da kullanılır
  (ChartCard ↔ viz döngüsel importunu önlemek için ayrı modülde).
  Kullanılan paketler: `@visx/hierarchy` (ağaç haritası, güneş patlaması,
  daire yığını), `@visx/chord`, `@visx/network` + `d3-force`, `@visx/geo` +
  `topojson-client` + `world-atlas`, `@visx/glyph`. Radar, eğim, gösterge,
  şelale, huni, marimekko ve piktogramın hazır paketi yok — `@visx/shape` ve
  `@visx/scale` üstünde yazıldı.
- `src/decor/CardDecor.tsx` + `bloom/gradients/patterns/ascii` — **karta
  gömülü dekor katmanı.** Bloom şekilleri, palete bağlı gradyan hazır
  ayarları, doku desenleri, ASCII glif setleri ve
  `asciiBar`/`asciiSparkline` yardımcıları. `CardDecor.tsx` hepsini kartın
  arkasına tek bir `<svg data-decor>` olarak çizer; yerleştirilebilir dekor
  nesnelerinden (aşağıdaki varlık kaydı) ayrı bir sistemdir.
- `src/lib/chart-icons.ts` — tür seçicideki simgeler ve piktogram ikon
  kataloğu. **Lucide**'dan (ISC) gelir; dosya yalnız kullanılan ikonları
  adlandırır, kalan 1.500 ikon ağaç sarsmayla düşer.
- `src/lib/geo.ts` — harita sınırları ve ad çözümleyiciler. İki kaynak var,
  ikisi de ham metin olarak gömülü: dünya için `world-atlas` 110m TopoJSON,
  "Türkiye (iller)" kapsamı için `src/lib/tr-il.json` (81 il, ≈62 KB,
  Natural Earth 10m admin-1'den `scripts/gen-tr-il.mjs` ile üretilir; kimlik
  plaka kodu, ad Türkçe yazımıyla tablodan). Hangi kaynağın okunacağını
  `regionSource(scope)` söyler. Türkçe/İngilizce ülke adları tarayıcının kendi
  `Intl.DisplayNames`'inden gelir, tabloya gömülü değildir;
  `src/lib/country-codes.ts` yalnız ISO numeric → alpha-2 eşlemesini tutar ve
  `scripts/gen-country-codes.mjs` ile üretilir.
- `src/ext/` — **Bklit'e eklenen çizim katmanları.** Hepsi aynı kalıp: Bklit'in
  chart context'ini okuyup `<text>`/`<line>` çizerler, Bklit'in kendisine
  dokunmazlar.
  - `axes.tsx` — sayı etiketleri, eksen adları, eğik etiketler. `displayName`
    değerleri Bklit'in clip-dışı listesindeki adlardır (`XAxis`, `YAxis`,
    `BarXAxis`).
  - `value-labels.tsx`, `ring-value-labels.tsx` — mark üstündeki sayılar.
  - `reference-lines.tsx` — hedef/eşik çizgileri.

  Yeni katmanlar `displayName` numarası yerine **`__isPostOverlay = true`**
  kullanıyor: Bklit'in çocuk sınıflandırıcısı (`chart-child-passthrough.ts`)
  bunu gören bileşeni en son ve açılış klipinin dışında çiziyor. Klibin içinde
  kalsalar etiketler çubukla birlikte aşağıdan süzülür, animasyon bitene kadar
  yarısı görünmez olurdu.
- `src/lib/export-svg.ts` — kartı tek SVG'ye çeviren yürüyücü. Özel durum
  tutmaz, üç kural uygular: bir `<svg>`yi klonlayıp kart uzayına taşır; yalnız
  metin içeren bir elemanın her görsel satırını bir `<text>` yapar
  (`Range.getClientRects` ile — tek `<text>` iki satırlık başlığı tek satıra
  indiriyordu); metinsiz, dolgulu küçük bir kutuyu `<rect>` yazar. Bu üçü
  başlığı, göstergeyi, yatay çubuğun portal etiketlerini, ısı takviminin
  eksenlerini, halka merkezini ve piktogram satırlarını aynı yolla kapsıyor.
  Özel durum listesi tutmanın maliyeti şuydu: kart her yeni parça
  kazandığında dışa aktarım sessizce eksik kalıyordu.
- `src/lib/history.ts` — geri al/yinele. Saf bir yığın; React durumu değil, o
  yüzden düğmelerin etkin/etkisiz hâli bir sayaçla yenileniyor. Yalnız grafik
  ve paletleri kapsar.
- `src/lib/thumbnails.ts` — sol listedeki küçük resimler, gerçek dışa aktarım
  hattından geçmiş 0,25× PNG'ler. Canlı `ChartCard` değil, çünkü
  `area-chart.tsx` klip yolu kimliğini sabit yazıyor
  (`chart-area-grow-clip`): sayfada ikinci bir canlı AreaChart olsa `url(#…)`
  ilk eşleşmeye bağlanır ve sahnedeki grafik küçük resmin genişliğinde
  kırpılırdı.
- `src/lib/ui-prefs.ts` — panel bölümlerinin açık/kapalı hâli ile sol
  sütundaki grafik ve katman listelerinin yükseklikleri. Çalışma alanı JSON'unun **dışında**: bunlar işin parçası değil, o
  makinedeki pencere hâli, taşınmaları anlamsız.
- `src/lib/adapters.ts` — tablo → her grafiğin veri biçimi. Çizgi/alan
  grafikte kategorik x, içeride eşit aralıklı sanal tarihe eşlenir; etiketler
  kullanıcının yazdığı gibi kalır.
- `src/lib/zip.ts`, `src/lib/pptx.ts` — kütüphanesiz .pptx: STORE yöntemli ZIP
  yazıcı + en küçük OOXML paketi (presentation, master, boş layout, tema, slayt
  başına bir PNG **ve metin kutuları**). Metin kutusu `wrap="none"` ile
  yazılıyor: satır sonlarını kart üzerinde biz koyduk, PowerPoint'in yeniden
  bölmesini istemiyoruz. İç kenar boşlukları sıfır, yoksa varsayılan 0,05
  inçlik pay ölçtüğümüz kutuyu kaydırırdı. `pnpm test:pptx` örnek dosya
  üretir; PowerPoint COM ile doğrulandı.
- `src/lib/pptx-metin.ts` — slayda gidecek yazıları **çizilmiş karttan
  ölçüyor**, modelden hesaplamıyor. Yazının nerede durduğunu, hangi puntoda ve
  hangi renkte olduğunu bilen tek yer tarayıcının yaptığı yerleşim; modelden
  gitseydik serbest yerleşimi, sarma satırlarını, balonun kendi hizasını ve
  temanın çözdüğü rengi ikinci kez — ve bir gün yanlış — hesaplamamız
  gerekirdi. Ölçümden sonra aynı öğeler `visibility: hidden` oluyor ve PNG o
  karttan alınıyor: **tek geçiş**, ölçülen kart ile resme giden kart aynı
  kart. Yeni bir yazan varlık eklendiğinde bu dosyaya dokunmak gerekmiyor.
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
  varlık dosya değil, hepsi koddan üretilir. `shapes.tsx` anlamı olmayan
  aile: kenar şeklin *içine* çizilir (kutu küçültülerek), yoksa tutamaçla
  çizim birbirini tutmaz. Gruplar `DecorItem.grup` etiketiyle tutulur — ayrı
  bir grup **ağacı** değil: üyeler yığında yan yana durur, silinen bir üyenin
  ardından temizlenecek düğüm kalmaz ve sıralama tek yığın üzerinden yürür.
  `DecorState.gruplar` yalnızca grubun **adını** tutar; görünürlük ve kilit
  üyelerden okunur, yoksa "grup açık ama üyesi kapalı" gibi hangisinin
  kazandığı belirsiz bir hâl doğardı. Üyesi kalmamış kayıtları
  `normalizeDecor` süpürür.
- `src/lib/bicem.ts` — "biçem" ile "içerik" arasındaki sınır, tek yerde.
  `bicemAl`/`bicemUygula` stili kopyala-yapıştırın tamamı; `ICERIK_ALANLARI`
  dışlama listesi. İzin listesi değil dışlama listesi, çünkü sonradan eklenen
  ayarların hemen hepsi görünümle ilgili ve "yeni ayar biçeme girmemiş"
  sessizce yanlış olurdu.
- `src/decor/text.tsx` — metin kutusu. Satırlara bölmeyi **uygulama** yapıyor:
  SVG `<text>` sarmaz, `foreignObject` ise SVG çıktısını Illustrator'da ve
  PowerPoint'te açılmaz hâle getirirdi. Ölçüm gizli bir canvas ile, kartın
  kendi `--font-sans`'ıyla; ekran dışı dışa aktarım kartı da aynı fontu miras
  aldığı için "ekranda sığan, PNG'de taşan satır" diye bir şey olmuyor.
  Yükseklik `AssetDef.otomatikYukseklik` ile metne bağlı — panel ve sahne tek
  bir `otomatikBoy()` kapısından geçiyor, o yüzden kutu yazarken büyüyor,
  bırakınca zıplamıyor.
- `ok/baglanti` (`src/decor/arrows.tsx`) — iki uçlu çizgi. Uçlar kutunun
  yüzdesi olarak parametrede (`AssetDef.uclar`); sahne köşe tutamakları yerine
  iki nokta gösteriyor ve uç çekilince kutuyu iki noktanın sınırlayıcı
  dikdörtgeni olarak yeniden yazıyor. `aci`/`aynala` bu varlıklarda yok
  sayılıyor: yön zaten uçların yerinden geliyor, bir de kutuyu çevirmek aynı
  şeyi iki kez söylemek olurdu.
- `src/decor/katmanlar.ts` — katman **ağacı**: iki yığınlı depoyu panelin
  gördüğü tek listeye (ve geri) çevirir. Panel depolama biçimini, model de
  panelin ağacını hiç bilmez. Kart parçaları listenin ortasında sabit bir
  şerit; bir satırı şeridin öte yanına bırakmak `katman` alanını değiştirir,
  yani katman ayrı bir düğme değil listedeki yerdir.
- `src/components/LayersPanel.tsx` — o ağacın arayüzü: ağaç satırları,
  sürükleyerek sıralama ve gruba katma, yerinde ad değiştirme, göz/kilit,
  arama, sağ tık menüsü, klavye gezinmesi. Grup satırının açık/kapalı hâli
  bilerek kaydedilmez ve geri alınmaz — bir grubu kapatmak işin değil bakışın
  değişmesidir.
- Serbest yerleşim `ChartSpec.yerlesim` içinde: üç kutu (`baslik`, `grafik`,
  `dipnot`) kart uzayında, süslemeyle **aynı koordinat sisteminde**. Kutu
  varsa o öğe mutlak konumlanır, yoksa kart eskisi gibi kendi akışını kurar.
  Kutular hesaplanmaz, canlı karttan ölçülür — başlığın yüksekliği yazı
  tipine, grafiğinki gösterge konumuna bağlı, tahmin etmek zıplamaya yol açar.
- `src/components/DecorStage.tsx` — sahnedeki tutamaç katmanı. Süsleme
  nesneleri ve kart parçaları tek bir tutamaç listesinde birleşir; kart
  parçalarının kimliği `slot:` önekiyle ayrılır. Katman **her zaman** çizilir
  ve fareyi geçirir (`pointer-events: none`, yalnız tutamaçlarda `auto`):
  aksi hâlde kartın kendi ipuçları ve tıkla-seç çalışmıyor.
- `src/lib/selection.ts` — sahnede ne seçili. Tek bir durum: eskiden karta
  tıklama, süsleme seçimi ve panelde kaydırma ayrı ayrı yaşıyordu ve hangi
  sekmede olduğunuza göre tıklamanın anlamı değişiyordu. Serbest yerleşim
  kutuları ayrı bir tür değil, aynı parçaların kutusu — yoksa başlığın moda
  göre iki kimliği olurdu. Hangi seçimde hangi panel bölümünün görüneceği de
  burada.
- `src/components/Inspector.tsx` — sağ panel. Sekme yok; `OptionsPanel` ve
  `DecorPanel` olduğu gibi çiziliyor, hangi bölümlerinin görüneceğini
  `SectionScope` bağlamı söylüyor. Paneller yeniden yazılmadı: bölümler zaten
  `<Section id>` olarak ayrılmıştı.
- `src/components/Toolbar.tsx` — sahnenin üst kenarında yüzen çubuk: seçim/el
  araçları, serbest yerleşim modu, galeri, palet ve dışa aktarım. Son üçü
  eskiden sağ panelin sekmeleriydi. Açılır kutuları aşağı açılır.
- `src/components/ChartStrip.tsx` — sahnenin altındaki grafik şeridi. Küçük
  resimler gerçek dışa aktarım çıktısıdır (`src/lib/thumbnails.ts`); sıralama
  `useDragOrder`'ın yatay kipiyle yapılır. Kaydırma kutusu ile sürükleme
  listesi aynı öğedir — kenarda kendiliğinden kaydırma görünür alanın kenarını
  okuyor. Kartlar arasındaki ekleme noktaları sürüklerken kaldırılmaz, yalnız
  görünmez olur: kaldırılsalardı ölçülmüş hedef hesabı sürüklemenin ortasında
  zıplardı.
- `src/lib/kind-previews.ts` — tür seçicideki örnek çizimler. Küçük resimlerle
  aynı hattan geçer (örnek veriyle kurulmuş kart → PNG); üretim tür ızgarası
  ilk kez göründüğünde başlar ve fareyle üstünde durulan tür sıranın başına
  alınır.
- `src/lib/free-layout.ts` — serbest yerleşimin ölçümü ve aç/kapa mantığı.
  Hem araç çubuğu hem slayt müfettişi kullanıyor.
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
- Bklit çubuklarında değer ekseni 0'ın altına inemez (`yMin` en az 0), yani
  negatif değerli sütun grafiği çizilemez: `Bar` çubuğu çizim alanının
  tabanından yukarı büyütüyor, negatif bir tabanın karşılığı yok. Şelale
  grafiği azalan kalemleri gösterebilir, çünkü kendi ölçeğini kuruyor.
- Geri al metin kutularının içinde de uygulama düzeyinde çalışır ve
  tarayıcının kendi geri almasını bastırır; tek istisna `Yapıştır` kutusu
  (`textarea`). Gerekçe: buradaki inputlar kontrollü, React değeri her tuşta
  yeniden yazdığı için tarayıcı yığını zaten güvenilmez.
- Küçük resimler grafik başına bir ekran dışı çizim demek; on grafikli bir
  çalışma alanında ilk açılışta hepsi sırayla üretilirken liste birkaç saniye
  ikonla durur.
- Süsleme katmanları `z-index` ile sıralanır ve kartın kendi içeriği
  `z-index: 1`'e sabitlenmiştir. Bu şart: sahnedeki kartta `scale()` dönüşümü
  sessizce bir yığın bağlamı kurar, ekran dışı dışa aktarım kartında kurmaz —
  negatif `z-index` kullanan ilk sürüm ekranda doğru görünüp her PNG'de
  kayboluyordu.
- Dünya haritası 110m çözünürlüktedir (ülke sınırları; il/eyalet yalnız
  Türkiye için, ayrı bir tablodan) ve kapsam bir coğrafi pencereye sığdırılıp
  kırpılır. `d3-geo` küresel çokgeni sarım yönüne
  göre yorumlar: `scopeExtent` halkası saat yönünde sarılmazsa pencere
  "kürenin geri kalanı" olarak okunur ve yakınlaştırma hiç uygulanmaz.
- Ağ grafiğinin kuvvet yerleşimi bir kez, senkron çözülür (sabit başlangıç +
  sabit adım). Canlı simülasyon PNG'yi belirsiz kılardı; buna karşılık düğüm
  yerleşimi elle sürüklenemez.
- Piktogram simgeleri satır başına sabit sayıdadır ve boyut bütün satırlarda
  ortaktır; en kalabalık satır boyutu belirler.
