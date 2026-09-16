/**
 * PPTX'e **gerçek metin kutusu** olarak gidecek yazıları karttan toplar.
 *
 * Kaynak model değil, çizilmiş kartın kendisi. Sebebi şu: yazının nerede
 * durduğunu, hangi puntoda ve hangi renkte olduğunu bilen tek yer tarayıcının
 * yaptığı yerleşim. Modelden hesaplamaya kalksaydık serbest yerleşimi, sarma
 * satırlarını, balonun kendi hizasını ve temanın çözdüğü rengi ikinci kez —
 * ve bir gün yanlış — hesaplamamız gerekirdi. Burada ölçüyoruz; yeni bir
 * yazan varlık eklendiğinde bu dosyaya dokunmak gerekmiyor.
 *
 * Toplandıktan sonra `gizle()` çağrılıyor ve aynı öğeler `visibility: hidden`
 * oluyor. Tek geçiş: **ölçülen kart ile PNG'ye giden kart aynı kart.** Yazı
 * PNG'de yok, slaytta düzenlenebilir bir kutu olarak var; ikisi üst üste
 * binmiyor.
 */

export interface PptxYazi {
  /** Kart pikselinde kutu — kartın sol üst köşesine göre. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Satırlar; her biri PPTX'te ayrı bir paragraf. */
  satirlar: string[];
  /** Punto, kart pikselinde. EMU'ya çeviren taraf slaytın ölçeğini biliyor. */
  punto: number;
  /** 100–900. */
  kalinlik: number;
  /** RRGGBB. */
  renk: string;
  hiza: "sol" | "orta" | "sag";
  /** Satır yüksekliğinin puntoya oranı. */
  satirAraligi: number;
  /**
   * Kutu, yazının mürekkep sınırından mı yoksa düzen kutusundan mı geliyor.
   * Mürekkep sınırı dikeyde ortalanmalı; düzen kutusu üstten hizalanmalı.
   */
  kaynak: "duzen" | "murekkep";
  /** Derece; döndürülmüş süslemedeki yazı için. */
  aci: number;
}

export interface Toplama {
  yazilar: PptxYazi[];
  /** Toplanan öğeleri karttan görünmez kılar — PNG'de yer almasınlar diye. */
  gizle: () => void;
}

/** Kartın kendi metin parçaları. Süsleme yazıları SVG tarafında toplanıyor. */
const PARCALAR = ["title", "subtitle", "note"];

/** "rgb(11, 11, 11)" → "0B0B0B". Çözülemezse siyah. */
export function renkHex(css: string): string {
  const m = css.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (!m) return "0B0B0B";
  return [m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function sayi(v: string, varsayilan: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : varsayilan;
}

function hizaCevir(v: string, varsayilan: PptxYazi["hiza"]): PptxYazi["hiza"] {
  if (v === "center" || v === "middle") return "orta";
  if (v === "right" || v === "end") return "sag";
  if (v === "left" || v === "start") return "sol";
  return varsayilan;
}

/**
 * Bir kart DOM'undan metinleri toplar.
 *
 * `kart` ekran dışı, ölçeksiz çizilmiş olmalı: koordinatlar doğrudan kart
 * pikseli sayılıyor. Sahnedeki kart `scale()` taşıdığı için buraya verilmez.
 */
export function yazilariTopla(kart: HTMLElement): Toplama {
  const kartR = kart.getBoundingClientRect();
  const yazilar: PptxYazi[] = [];
  const ogeler: HTMLElement[] = [];

  /* ---- kartın kendi metinleri ---- */
  for (const parca of PARCALAR) {
    const el = kart.querySelector<HTMLElement>(`[data-part="${parca}"]`);
    const metin = el?.textContent?.trim();
    if (!el || !metin) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    const punto = sayi(cs.fontSize, 16);
    yazilar.push({
      x: r.left - kartR.left,
      y: r.top - kartR.top,
      // Düzen kutusu satır yüksekliğini de kapsıyor; kutuyu olduğu gibi
      // veriyoruz ki PowerPoint aynı yerde aynı genişlikte sarsın.
      w: r.width,
      h: r.height,
      satirlar: [metin],
      punto,
      kalinlik: sayi(cs.fontWeight, 400),
      renk: renkHex(cs.color),
      hiza: hizaCevir(cs.textAlign, "sol"),
      satirAraligi: sayi(cs.lineHeight, punto * 1.25) / punto,
      kaynak: "duzen",
      aci: 0,
    });
    ogeler.push(el);
  }

  /* ---- süsleme yazıları ---- */
  // `[data-decor]` iki faz SVG'si; içindeki her <text> bir yazı. Balon, rozet
  // ve metin kutusu aynı yoldan geçiyor, çünkü hepsi gerçek <text> çiziyor.
  for (const el of kart.querySelectorAll<SVGTextElement>('[data-decor] text')) {
    const tspanlar = [...el.querySelectorAll("tspan")];
    const satirlar = (tspanlar.length ? tspanlar.map((t) => t.textContent ?? "") : [el.textContent ?? ""])
      .map((t) => t.replace(/ /g, " ").trimEnd())
      .filter((t, i, a) => t.trim() !== "" || (i > 0 && i < a.length - 1));
    if (satirlar.length === 0 || satirlar.every((t) => !t.trim())) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    const punto = sayi(cs.fontSize, 16);
    // `<text>` kutusu mürekkebin sınırı: yalnız harflerin kapladığı yer.
    // Satır aralığını tspan'lerin arasındaki mesafeden okuyoruz — asıl
    // kaynak o, CSS `line-height` bir SVG metninde çoğu zaman "normal".
    const adim =
      tspanlar.length > 1
        ? Math.abs(tspanlar[1].getBoundingClientRect().top - tspanlar[0].getBoundingClientRect().top) || punto * 1.25
        : punto * 1.25;
    yazilar.push({
      x: r.left - kartR.left,
      y: r.top - kartR.top,
      w: r.width,
      h: r.height,
      satirlar,
      punto,
      kalinlik: sayi(cs.fontWeight, 400),
      renk: renkHex(cs.fill || cs.color),
      hiza: hizaCevir(el.getAttribute("text-anchor") ?? "", "sol"),
      satirAraligi: adim / punto,
      kaynak: "murekkep",
      // Döndürme öğenin üstündeki <g transform> üzerinde; ekran kutusu zaten
      // dönmüş hâlin sınırı, o yüzden açıyı ayrıca uygulamıyoruz. Dönmüş bir
      // yazı slaytta dik durur — kabul edilen ödün, bkz. README.
      aci: 0,
    });
    ogeler.push(el as unknown as HTMLElement);
  }

  return {
    yazilar,
    gizle: () => {
      // `display:none` değil: düzen kaymasın, grafik yerinde kalsın.
      for (const el of ogeler) el.style.visibility = "hidden";
    },
  };
}
