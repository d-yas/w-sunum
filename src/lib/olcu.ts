/**
 * Metin ölçümü — tek kaynak.
 *
 * Grafiklerin kenar boşluğu uzun süre "karakter sayısı × sabit" ile tahmin
 * edildi ve proje içinde beş ayrı sabit birikti (6.2 / 7 / 7.2 / 7.5 ve
 * fontSize×0.55), hiçbiri gerçek metrikle doğrulanmamış. Tahmin eksik
 * kalınca etiket kartın ya da kendi `<svg>`'sinin dışına taşıyor, fazla
 * kalınca grafiğe ayrılan yer boşuna daralıyordu.
 *
 * Gerçek ölçer zaten vardı ama yalnız `decor/text.tsx` kullanıyordu. Buraya
 * taşındı: metin kutusu da, eksen etiketi de, sankey'in düğüm adı da aynı
 * canvas'tan geçiyor.
 *
 * Ölçüm `canvas.measureText` ile ve kartın kendi `--font-sans`'ıyla yapılıyor.
 * Ekran dışı dışa aktarım kartı aynı belgede, aynı `:root` altında duruyor
 * (`App.tsx` onu `document.body`'ye ekliyor), yani ölçü ile çizim ayrılmıyor:
 * "ekranda sığan, PNG'de taşan satır" diye bir şey olmuyor. Rasterde ölçülen
 * son mürekkep pikseli ölçümün birkaç piksel altında kalıyor — ölçüm güvenli
 * bir üst sınır.
 */

/* ------------------------------------------------------------------ */
/* Font                                                                 */
/* ------------------------------------------------------------------ */

let fontAilesi: string | null = null;

/** Kartın yazı tipi. Bir kez okunuyor: her kelimede okumak ölçümü boğuyor. */
function kartFontu(): string {
  if (fontAilesi) return fontAilesi;
  if (typeof document === "undefined") return "system-ui, sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
  fontAilesi = v || "system-ui, sans-serif";
  return fontAilesi;
}

/**
 * Yazı tipi değiştiyse önbelleği geçersizleştirir.
 *
 * Bugün çağıran yok — `--font-sans` `:root`'ta sabit, koyu tema onu yeniden
 * yazmıyor ve kullanıcıya açık bir yazı tipi ayarı yok. Font bir gün ayara
 * dönerse tek satırlık kapı hazır olsun diye duruyor; `epoch` önbellek
 * anahtarında olduğu için eski ölçüler kendiliğinden düşüyor.
 */
export function fontuYenile(): void {
  fontAilesi = null;
  epoch += 1;
}

/* ------------------------------------------------------------------ */
/* Ölçüm                                                                */
/* ------------------------------------------------------------------ */

let epoch = 0;
let olcer: CanvasRenderingContext2D | null | undefined;
const onbellek = new Map<string, number>();

/** Canvas gerçekten ölçüyor mu — yoksa kaba tahmine mi düşüyoruz. */
export function olcuGercekMi(): boolean {
  if (olcer === undefined) olcer = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  return olcer != null;
}

/**
 * Punto 0,5'e yuvarlanıyor. Grafikler `11.5`, `10.5`, `outer * 0.42` gibi
 * sürekli değerler veriyor; yuvarlamasak önbellek hiç tutmazdı.
 */
const yuvarla = (p: number) => Math.round(p * 2) / 2;

/** Bir metnin piksel genişliği. */
export function olcMetin(metin: string, punto: number, kalinlik: string | number = "400"): number {
  if (!metin) return 0;
  const p = yuvarla(punto);
  const k = String(kalinlik);
  const anahtar = `${epoch}|${k}|${p}|${metin}`;
  const hazir = onbellek.get(anahtar);
  if (hazir !== undefined) return hazir;
  const kaba = metin.length * p * 0.55;
  if (!olcuGercekMi() || !olcer) return kaba;
  olcer.font = `${k} ${p}px ${kartFontu()}`;
  const w = olcer.measureText(metin).width;
  // `enGenis` çok sayıda kısa metinle çağrılıyor; sınır buna göre.
  if (onbellek.size > 8000) onbellek.clear();
  onbellek.set(anahtar, w);
  return w;
}

/**
 * Listedeki en uzun metnin genişliği.
 *
 * Grafiklerin neredeyse tamamı "en uzun etiket kaç piksel" diye soruyor;
 * ayrı bir işlev olmasa on dört yerde aynı `reduce(Math.max)` yazılırdı.
 */
export function enGenis(metinler: readonly string[], punto: number, kalinlik: string | number = "400"): number {
  let en = 0;
  for (const m of metinler) {
    const w = olcMetin(m, punto, kalinlik);
    if (w > en) en = w;
  }
  return en;
}

/**
 * Bir satırın taban çizgisinin üstünde ve altında kapladığı yer.
 *
 * Dikey boşluk için gerekiyor ve tahmin edilemez: sankey'in değer etiketi
 * düğüm merkezinden aşağı yazılıyor, alttaki düğümde kesilip kesilmediği
 * tam olarak bu iki sayıya bağlı. `fontBoundingBox*` yoksa puntodan makul
 * bir orana düşüyoruz (çoğu Latin yüzünde çıkıntı ~0.9em, iniş ~0.22em).
 */
export function olcSatir(punto: number, kalinlik: string | number = "400"): { cik: number; in: number } {
  const p = yuvarla(punto);
  if (!olcuGercekMi() || !olcer) return { cik: p * 0.9, in: p * 0.22 };
  olcer.font = `${String(kalinlik)} ${p}px ${kartFontu()}`;
  const m = olcer.measureText("Hgÿ");
  const cik = m.fontBoundingBoxAscent;
  const inn = m.fontBoundingBoxDescent;
  return {
    cik: typeof cik === "number" && cik > 0 ? cik : p * 0.9,
    in: typeof inn === "number" && inn > 0 ? inn : p * 0.22,
  };
}

/** Bir satırın toplam yüksekliği. */
export function satirYuksekligi(punto: number, kalinlik: string | number = "400"): number {
  const s = olcSatir(punto, kalinlik);
  return s.cik + s.in;
}

/**
 * Verilen genişliğe sığmıyorsa üç noktayla kısaltır.
 *
 * Eski `ellipsize` kaç karakter kalacağını `maxWidth / (fontSize * 0.55)` ile
 * hesaplıyordu; dar harfli bir etiket boşuna kesiliyor, geniş harfli bir
 * etiket kesildikten sonra bile taşıyordu. Burada kalan karakter sayısı
 * ölçülen genişlikte ikili aramayla bulunuyor.
 */
export function kisalt(metin: string, punto: number, enCokPx: number, kalinlik: string | number = "400"): string {
  if (!metin || enCokPx <= 0) return "";
  if (olcMetin(metin, punto, kalinlik) <= enCokPx) return metin;
  const nokta = olcMetin("…", punto, kalinlik);
  const yer = enCokPx - nokta;
  if (yer <= 0) return "…";
  const harfler = [...metin];
  let lo = 0;
  let hi = harfler.length;
  while (lo < hi) {
    const orta = Math.ceil((lo + hi) / 2);
    if (olcMetin(harfler.slice(0, orta).join(""), punto, kalinlik) <= yer) lo = orta;
    else hi = orta - 1;
  }
  return lo <= 0 ? "…" : harfler.slice(0, lo).join("") + "…";
}

/**
 * Eğik bir etiketin kapladığı kutu.
 *
 * `aci` derece, saat yönünün tersine okunan eksen etiketi açısı (0 = düz).
 * Dönen bir metnin kapladığı yer iki bileşenin toplamı: metnin kendi
 * uzunluğunun izdüşümü artı satır yüksekliğinin izdüşümü.
 */
export function egikYer(punto: number, aci: number, genislikPx: number, kalinlik: string | number = "400"): { yatay: number; dikey: number } {
  const h = satirYuksekligi(punto, kalinlik);
  if (!aci) return { yatay: genislikPx, dikey: h };
  const r = (Math.abs(aci) * Math.PI) / 180;
  const sin = Math.sin(r);
  const cos = Math.cos(r);
  return {
    yatay: genislikPx * cos + h * sin,
    dikey: genislikPx * sin + h * cos,
  };
}
