/**
 * Bir kartın **biçemi** — veriden ve yazdığınız metinden arta kalan her şey.
 *
 * "Aynı görünümü öteki grafiğe de ver" işini tek yerde tanımlıyor: palet,
 * seri renkleri, kart ölçüleri, eksen/gösterge anahtarları, süsleme, serbest
 * yerleşim. Kopyalanan şey bir görüntü değil bir **ayar kümesi**, o yüzden
 * yapıştırılan kart kendi verisini çizmeye devam ediyor.
 *
 * Sınır bir **dışlama listesiyle** çiziliyor, izin listesiyle değil: yeni bir
 * ayar eklendiğinde varsayılan olarak biçeme dâhil olsun isteniyor, çünkü
 * eklenen ayarların hemen hepsi görünümle ilgili. Listeye girenler yalnızca
 * şunlar: yazdığınız metin, bu kartın verisinden gelen bir kategori adı, bir
 * satır numarası ya da bir değer aralığı.
 */
import { emptyDecor, emptyLayout, type CardLayout, type DecorState } from "@/decor/model";

import type { ChartOptions, ChartSpec } from "./spec";

/**
 * Biçeme **girmeyen** ayarlar. Gerekçe her satırda: hepsi bu kartın kendi
 * verisine ya da kullanıcının bu kart için yazdığı metne bağlı.
 */
export const ICERIK_ALANLARI: (keyof ChartOptions)[] = [
  // Bu kartın kategori adları / satır numaraları
  "highlight",
  "refLines",
  "forecastFrom",
  // Yazılan metin
  "xTitle",
  "yTitle",
  "ringCenterLabel",
  "sankeyUnit",
  "waterfallTotalLabel",
  // Bu kartın değer aralığı
  "yMin",
  "yMax",
  "gaugeMin",
  "gaugeMax",
  "pictoUnit",
  // Verinin biçiminden okunan ayarlar
  "xMode",
  "dateGranularity",
  "mapScope",
];

export interface Bicem {
  /** Kaynağın adı — panelde "hangi kartın biçemi" diye görünüyor. */
  kaynak: string;
  paletteId: string;
  colors: string[];
  decor: DecorState;
  yerlesim: CardLayout;
  options: Partial<ChartOptions>;
}

/** Bir karttan biçemi söker. Dönen nesne kaynaktan bağımsız: derin kopya. */
export function bicemAl(spec: ChartSpec): Bicem {
  const options: Partial<ChartOptions> = {};
  for (const [k, v] of Object.entries(spec.options)) {
    if (ICERIK_ALANLARI.includes(k as keyof ChartOptions)) continue;
    (options as Record<string, unknown>)[k] = klon(v);
  }
  return {
    kaynak: spec.name,
    paletteId: spec.paletteId,
    colors: [...spec.colors],
    decor: klon(spec.decor) ?? emptyDecor(),
    yerlesim: klon(spec.yerlesim) ?? emptyLayout(),
    options,
  };
}

/**
 * Biçemi bir karta uygular.
 *
 * Veri, tür, başlık, alt başlık ve dipnot yerinde kalıyor — kopyalanan şey
 * "nasıl göründüğü", "ne anlattığı" değil.
 */
export function bicemUygula(spec: ChartSpec, b: Bicem): ChartSpec {
  return {
    ...spec,
    paletteId: b.paletteId,
    colors: [...b.colors],
    decor: klon(b.decor) ?? emptyDecor(),
    yerlesim: klon(b.yerlesim) ?? emptyLayout(),
    options: { ...spec.options, ...klon(b.options) },
  };
}

/**
 * Derin kopya. Aynı süsleme nesnesi iki kartta paylaşılırsa birini taşımak
 * ötekini de taşırdı — ve bu, ancak iş kaydedilip geri yüklendikten sonra
 * fark edilirdi.
 */
function klon<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}
