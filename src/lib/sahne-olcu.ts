/**
 * Sahnedeki kartın öğelerini bulmak ve ölçmek — sıralama katmanı ve panel için.
 *
 * Öğeler DOM'da kendi anahtarlarını taşıyor: `data-oge` (kategori, aşama,
 * grup, düğüm), çubukta Bklit'in `data-category`'si, hiyerarşi yaprağında ek
 * olarak `data-alt`, eğim duraklarında `data-seri`, gösterge girdisinde
 * `data-anahtar` (göstergenin kendisi `data-boyut` ile hangi boyutu
 * listelediğini söylüyor). Öznitelikler dışa aktarımda zararsız; durum değil,
 * yalnız kimlik.
 *
 * Yalnız sahnedeki kart okunur (`.inspect .stage-card`) — ekran dışında aynı
 * anda bir dışa aktarım kartı yaşıyor olabilir.
 */
import { sankeySutunlari } from "@/ext/sankey-fit";

import { toSankey } from "./adapters";
import type { SiraBoyutu } from "./sira";
import type { ChartSpec } from "./spec";

/** `DecorStage`'te ön katman kutularının başladığı `z-index`; altı arka katman ve kart parçaları. */
export const ON_KATMAN_Z = 2000;

export interface Kutu {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface OgeIsabeti {
  boyut: SiraBoyutu;
  anahtar: string;
  /** Hiyerarşi yaprağında grup; yaprak isabetinde `boyut` "alt". */
  grup?: string;
  /** Göstergedeki bir girdi mi. */
  gosterge: boolean;
  /** Tıklanan DOM öğesi — fare olaylarını temizlemek için. */
  el: Element;
}

export function sahneKarti(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".inspect .stage-card");
}

const veri = (el: Element) => (el as HTMLElement | SVGElement).dataset ?? {};

/** Bir DOM öğesinin (ya da atasının) temsil ettiği sıra öğesi. */
export function ogeOku(baslangic: Element, kart: Element): OgeIsabeti | null {
  for (let el: Element | null = baslangic; el; el = el.parentElement) {
    const d = veri(el);
    if (d.anahtar != null) {
      const gosterge = el.closest<HTMLElement>('[data-part="legend"]');
      const boyut = gosterge?.dataset.boyut as SiraBoyutu | undefined;
      return boyut ? { boyut, anahtar: d.anahtar, gosterge: true, el: baslangic } : null;
    }
    if (d.alt != null && d.oge != null) return { boyut: "alt", anahtar: d.alt, grup: d.oge, gosterge: false, el: baslangic };
    if (d.seri != null) return { boyut: "seri", anahtar: d.seri, gosterge: false, el: baslangic };
    if (d.oge != null && d.oge !== "") return { boyut: "oge", anahtar: d.oge, gosterge: false, el: baslangic };
    if (d.category != null) return { boyut: "oge", anahtar: d.category, gosterge: false, el: baslangic };
    if (el === kart) break;
  }
  return null;
}

/**
 * Noktanın altındaki öğe — süsleme kutularının **arkasını** görerek.
 *
 * Süsleme katmanı kartın üstünde duruyor, yani isabet testi grafiğe hiç
 * ulaşmıyor olabilir. Serbest yerleşimin grafik kutusu ve arka katman
 * süslemeleri görselde grafiğin arkasında: onları delip geçiyoruz. Öndeki bir
 * süsleme ya da bir tutamak ise o noktanın sahibi — `null`.
 */
export function noktadakiOge(x: number, y: number, kart: Element): OgeIsabeti | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest(".decor-overlay")) {
      if (el.closest(".decor-handle, .decor-anchor, .decor-edit")) return null;
      const kutu = el.closest<HTMLElement>(".decor-box");
      if (!kutu || kutu.dataset.slot) continue;
      if ((Number(kutu.style.zIndex) || 0) >= ON_KATMAN_Z) return null;
      continue;
    }
    if (!kart.contains(el)) continue;
    return ogeOku(el, kart);
  }
  return null;
}

/** `DecorStage`'te kart parçalarının (serbest yerleşim kutuları) `z-index`'i; altı arka katman. */
const KART_Z = 1000;

/**
 * Noktadaki en üst kutu arka katmandan bir süsleme mi. Görselde grafiğin
 * arkasında duruyor ama isabet testinde üstte: grafiğin bir öğesine tıklayan
 * kullanıcı arkadaki süslemeyi değil grafiği seçmeli.
 */
export function arkaKutuUstte(x: number, y: number): boolean {
  for (const el of document.elementsFromPoint(x, y)) {
    const kutu = el.closest<HTMLElement>(".decor-box");
    if (!kutu) return false;
    return !kutu.dataset.slot && (Number(kutu.style.zIndex) || 0) < KART_Z;
  }
  return false;
}

/** Öndeki bir süsleme kutusu ya da tutamak noktanın sahibi mi. */
export function ondekiSusleme(x: number, y: number): boolean {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!el.closest(".decor-overlay")) return false;
    if (el.closest(".decor-handle, .decor-anchor, .decor-edit")) return true;
    const kutu = el.closest<HTMLElement>(".decor-box");
    if (kutu && !kutu.dataset.slot && (Number(kutu.style.zIndex) || 0) >= ON_KATMAN_Z) return true;
  }
  return false;
}

const kutuOf = (r: DOMRect): Kutu => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });

export function birlesim(kutular: readonly Kutu[]): Kutu | null {
  if (kutular.length === 0) return null;
  return kutular.reduce((a, k) => ({ l: Math.min(a.l, k.l), t: Math.min(a.t, k.t), r: Math.max(a.r, k.r), b: Math.max(a.b, k.b) }));
}

export interface OlcumSecenegi {
  /** `alt` boyutunda grup. */
  grup?: string;
  /** Grafik yerine göstergedeki girdiler. */
  gosterge?: boolean;
}

/**
 * Bir boyutun sahnedeki öğeleri: anahtar → o öğeyi oluşturan DOM öğeleri
 * (çubuk, değer etiketi, eksen etiketi…). Göstergedeki girdiler yalnız
 * istenince sayılır — sahnedeki iki ayrı sürükleme yüzeyi.
 */
export function ogeOgeleri(kart: Element, boyut: SiraBoyutu, sec: OlcumSecenegi = {}): Map<string, Element[]> {
  const out = new Map<string, Element[]>();
  const ekle = (k: string | undefined, el: Element) => {
    if (k == null || k === "") return;
    const l = out.get(k);
    if (l) l.push(el);
    else out.set(k, [el]);
  };
  if (sec.gosterge) {
    const g = kart.querySelector(`[data-part="legend"][data-boyut="${boyut}"]`);
    g?.querySelectorAll("[data-anahtar]").forEach((el) => ekle(veri(el).anahtar, el));
    return out;
  }
  if (boyut === "seri") {
    kart.querySelectorAll("[data-seri]").forEach((el) => ekle(veri(el).seri, el));
  } else if (boyut === "alt") {
    kart.querySelectorAll("[data-alt]").forEach((el) => {
      if (veri(el).oge === sec.grup) ekle(veri(el).alt, el);
    });
  } else {
    kart.querySelectorAll("[data-oge], [data-category]").forEach((el) => ekle(veri(el).oge ?? veri(el).category, el));
  }
  return out;
}

/** Anahtar → ekran kutularının birleşimi. Boyutsuz (sıfır alanlı) öğeler sayılmaz. */
export function ogeKutulari(kart: Element, boyut: SiraBoyutu, sec: OlcumSecenegi = {}): Map<string, Kutu> {
  const out = new Map<string, Kutu>();
  for (const [k, els] of ogeOgeleri(kart, boyut, sec)) {
    const b = birlesim(els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map(kutuOf));
    if (b) out.set(k, b);
  }
  return out;
}

/** Anahtar başına ayrı ayrı kutular — dağılımdaki noktalar gibi dağınık öğelerin çerçevesi için. */
export function ayriKutular(kart: Element, boyut: SiraBoyutu, anahtar: string, sec: OlcumSecenegi = {}): Kutu[] {
  return (ogeOgeleri(kart, boyut, sec).get(anahtar) ?? [])
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 || r.height > 0)
    .map(kutuOf);
}

/** Bir öğenin `data-aci` değeri (radyan, saat 12'den saat yönünde) — açısal türlerde. */
export function ogeAcisi(kart: Element, boyut: SiraBoyutu, anahtar: string, sec: OlcumSecenegi = {}): number | null {
  for (const el of ogeOgeleri(kart, boyut, sec).get(anahtar) ?? []) {
    const a = Number(veri(el).aci);
    if (veri(el).aci != null && Number.isFinite(a)) return a;
  }
  return null;
}

/**
 * Sahnede çizilen düğüm sırası: soldan sağa sütunlar, her sütunda yukarıdan
 * aşağı. Sankey "Otomatik"te d3'ün kurduğu sırayı dondurmanın tek güvenilir
 * yolu bu — gevşetme çizim kutusunun ölçüsüne bağlı.
 */
export function sahnedekiSira(sutunOf?: (anahtar: string) => number): string[] {
  const kart = sahneKarti();
  if (!kart) return [];
  // Sütunu kâğıt üstündeki yerleşimden al: düğüm kutusuna etiketi de giriyor
  // ve etiket sütunun soluna ya da sağına taşıyor, sol kenar sütunu söylemiyor.
  // Dikeyde merkez yeterli — etiket düğümün ortasına hizalı.
  const sutun = (k: string, b: Kutu) => (sutunOf ? sutunOf(k) : Math.round((b.l + b.r) / 2));
  return [...ogeKutulari(kart, "oge")]
    .sort(([ka, a], [kb, b]) => sutun(ka, a) - sutun(kb, b) || (a.t + a.b) / 2 - (b.t + b.b) / 2)
    .map(([k]) => k);
}

/**
 * Sankey "Otomatik"te çizilen sıra (`gorunenSira`'nın `olculen`'i); diğer her
 * durumda `undefined` — sıra modelden hesaplanabiliyor.
 */
export function olculenSira(spec: ChartSpec): string[] | undefined {
  if (spec.kind !== "sankey" || spec.options.sort !== "none") return undefined;
  const sutun = sankeySutunlari(toSankey(spec).data);
  const sira = sahnedekiSira((k) => sutun.get(k) ?? 0);
  return sira.length > 0 ? sira : undefined;
}
