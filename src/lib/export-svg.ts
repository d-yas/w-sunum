/**
 * Kartı tek bir SVG'ye çevir.
 *
 * Eski sürüm yalnız çizim alanının `<svg>`sini alıyordu; kartın başlığı,
 * göstergesi, dipnotu, yatay çubuğun kategori etiketleri, ısı takviminin
 * eksenleri ve halkanın merkez sayısı HTML olduğu için dışarıda kalıyordu
 * (piktogram tümüyle HTML olduğu için hiç dışa aktarılamıyordu).
 *
 * Buradaki yürüyücü **özel durum tutmuyor.** Üç kural var:
 *
 *  1. Bir `<svg>` görürsen klonla, hesaplanmış stilini göm, kart uzayına
 *     taşı, içine inme.
 *  2. Yalnız metin içeren bir eleman görürsen her görünür satırını bir
 *     `<text>` olarak yaz.
 *  3. Metni olmayan, arka planı olan küçük bir kutu görürsen `<rect>` yaz.
 *
 * Bu üç kural başlığı, alt başlığı, dipnotu, gösterge etiketlerini ve
 * işaretlerini, portal eksen etiketlerini, halka merkezini ve piktogram
 * satırlarını **aynı yolla** kapsıyor. Özel durum listesi tutmanın maliyeti
 * şuydu: kart her yeni parça kazandığında dışa aktarım sessizce eksik
 * kalıyordu ve bunu yalnız çıktıya bakan biri görebiliyordu.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

/** Klonlanan SVG'ye taşınan sunum özellikleri. */
const SVG_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "fill-opacity",
  "fill-rule",
  "stroke-opacity",
  "paint-order",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "transform",
  "clip-path",
  "mask",
  "filter",
  "visibility",
  "color",
];

export interface CardSvgOptions {
  width: number;
  height: number;
  /** Arka plan dikdörtgeni çizilmesin. */
  transparent?: boolean;
}

export function buildCardSvg(card: HTMLElement, { width, height, transparent = false }: CardSvgOptions): SVGSVGElement {
  const cs = getComputedStyle(card);
  const out = document.createElementNS(SVG_NS, "svg");
  out.setAttribute("xmlns", SVG_NS);
  out.setAttribute("width", String(width));
  out.setAttribute("height", String(height));
  out.setAttribute("viewBox", `0 0 ${width} ${height}`);
  out.setAttribute("font-family", cs.fontFamily);

  if (!transparent) {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("width", String(width));
    bg.setAttribute("height", String(height));
    bg.setAttribute("fill", cs.backgroundColor);
    out.appendChild(bg);
  }

  const origin = card.getBoundingClientRect();
  const decor = (phase: string) => Array.from(card.querySelectorAll<SVGSVGElement>(`svg[data-decor="${phase}"]`));
  for (const layer of decor("arka")) out.appendChild(layer.cloneNode(true));

  walk(card, out, origin);

  for (const layer of decor("on")) out.appendChild(layer.cloneNode(true));
  return out;
}

function walk(el: Element, out: SVGSVGElement, origin: DOMRect) {
  for (const child of Array.from(el.children)) {
    if (child.hasAttribute("data-decor")) continue;

    const style = getComputedStyle(child);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;

    if (child instanceof SVGSVGElement) {
      const box = child.getBoundingClientRect();
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("transform", `translate(${round(box.left - origin.left)} ${round(box.top - origin.top)})`);
      const clone = child.cloneNode(true) as SVGSVGElement;
      inlineSvgStyles(child, clone);
      g.appendChild(clone);
      out.appendChild(g);
      continue;
    }

    if (isTextOnly(child)) {
      for (const node of textLines(child, style, origin)) out.appendChild(node);
      continue;
    }

    const box = box2(child, origin);
    // Gösterge işaretleri, başlık vurgu çubuğu, ısı lejant kareleri: küçük,
    // metinsiz, dolgulu kutular. Boyut sınırı kasıtlı — kartın kendi zemini
    // ya da bir panel kabı buraya düşmesin.
    if (!child.firstElementChild && hasPaint(style) && box.w <= 48 && box.h <= 48 && box.w > 0 && box.h > 0) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(round(box.x)));
      rect.setAttribute("y", String(round(box.y)));
      rect.setAttribute("width", String(round(box.w)));
      rect.setAttribute("height", String(round(box.h)));
      const r = radius(style, box);
      if (r > 0) {
        rect.setAttribute("rx", String(round(r)));
        rect.setAttribute("ry", String(round(r)));
      }
      rect.setAttribute("fill", style.backgroundColor);
      out.appendChild(rect);
      continue;
    }

    walk(child, out, origin);
  }
}

/** Yalnız metin düğümü içeren, gerçekten yazı taşıyan bir eleman mı? */
function isTextOnly(el: Element): boolean {
  if (el.firstElementChild) return false;
  const text = (el.textContent ?? "").trim();
  return text.length > 0;
}

/**
 * Bir metin elemanını satır satır `<text>`e çevir.
 *
 * `Range.getClientRects()` sarılmış metnin her görsel satırı için bir
 * dikdörtgen veriyor; tek `<text>` yazmak iki satırlık bir başlığı tek satıra
 * indiriyordu. Satır sınırlarını bulmak için karakter karakter ilerlenip
 * dikdörtgen sayısının arttığı yer aranıyor — sarma kurallarını yeniden
 * uygulamaktan ucuz ve tarayıcının kendi kararını kullanıyor.
 */
function textLines(el: Element, style: CSSStyleDeclaration, origin: DOMRect): SVGTextElement[] {
  const node = el.firstChild;
  const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!node || node.nodeType !== Node.TEXT_NODE || raw === "") return [];

  const anchor = style.textAlign === "center" ? "middle" : style.textAlign === "right" || style.textAlign === "end" ? "end" : "start";
  const make = (text: string, rect: DOMRect): SVGTextElement => {
    const t = document.createElementNS(SVG_NS, "text");
    const x = anchor === "middle" ? rect.left + rect.width / 2 : anchor === "end" ? rect.right : rect.left;
    t.setAttribute("x", String(round(x - origin.left)));
    t.setAttribute("y", String(round(rect.top + rect.height / 2 - origin.top)));
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("fill", style.color);
    t.setAttribute("font-family", style.fontFamily);
    t.setAttribute("font-size", style.fontSize);
    t.setAttribute("font-weight", style.fontWeight);
    if (style.fontStyle !== "normal") t.setAttribute("font-style", style.fontStyle);
    if (style.letterSpacing && style.letterSpacing !== "normal") t.setAttribute("letter-spacing", style.letterSpacing);
    t.textContent = text;
    return t;
  };

  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length <= 1) {
    const rect = rects[0] ?? el.getBoundingClientRect();
    return [make(raw, rect as DOMRect)];
  }

  // Çok satırlı: her satırın hangi karakterde bittiğini tarayıcıya sor.
  const full = node.textContent ?? "";
  const out: SVGTextElement[] = [];
  let start = 0;
  let line = 0;
  for (let i = 1; i <= full.length && line < rects.length; i++) {
    range.setStart(node, start);
    range.setEnd(node, i);
    const count = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0).length;
    const atEnd = i === full.length;
    if (count > 1 || atEnd) {
      const end = atEnd ? i : i - 1;
      const text = full.slice(start, end).trim();
      if (text) out.push(make(text, rects[line] as DOMRect));
      start = end;
      line += 1;
      if (atEnd) break;
    }
  }
  return out.length > 0 ? out : [make(raw, rects[0] as DOMRect)];
}

function box2(el: Element, origin: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
}

function hasPaint(style: CSSStyleDeclaration): boolean {
  const bg = style.backgroundColor;
  if (!bg || bg === "transparent") return false;
  const m = bg.match(/rgba?\([^)]*?([\d.]+)\s*\)$/);
  return !(m && Number(m[1]) === 0);
}

/** `border-radius`ı px'e çevir; yarıçap yarım genişliği geçiyorsa daire. */
function radius(style: CSSStyleDeclaration, box: { w: number; h: number }): number {
  const v = parseFloat(style.borderTopLeftRadius);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, box.w / 2, box.h / 2);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Hesaplanmış sunum stilini kopuk bir SVG klonuna geçir. */
export function inlineSvgStyles(source: Element, target: Element) {
  const cs = getComputedStyle(source);
  target.setAttribute("style", SVG_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
  target.removeAttribute("class");
  const sc = source.children;
  const tc = target.children;
  for (let i = 0; i < sc.length; i++) if (tc[i]) inlineSvgStyles(sc[i], tc[i]);
}
