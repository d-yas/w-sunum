/**
 * DOM → PNG without any library.
 *
 * The slide card (HTML + inline SVG) is cloned, every element's computed style
 * is inlined so CSS variables and Tailwind classes survive outside the
 * document, and the clone is wrapped in an SVG <foreignObject>. Chromium
 * rasterises that as an <img> which we draw to a canvas at the chosen scale.
 * Nothing is fetched — system fonts only — so it works from file://.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "CANVAS", "VIDEO", "AUDIO"]);

const defaultStyleCache = new Map<string, Map<string, string>>();
let sandbox: HTMLElement | null = null;

function getDefaultStyle(tag: string, isSvg: boolean): Map<string, string> {
  const key = `${isSvg ? "svg:" : ""}${tag}`;
  let m = defaultStyleCache.get(key);
  if (m) return m;
  if (!sandbox) {
    sandbox = document.createElement("div");
    sandbox.style.cssText = "position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden";
    document.body.appendChild(sandbox);
  }
  let el: Element;
  if (isSvg) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    svg.appendChild(el);
    sandbox.appendChild(svg);
  } else {
    el = document.createElement(tag);
    sandbox.appendChild(el);
  }
  const cs = getComputedStyle(el);
  m = new Map();
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    m.set(name, cs.getPropertyValue(name));
  }
  defaultStyleCache.set(key, m);
  sandbox.textContent = "";
  return m;
}

/** Properties that never matter for rasterisation, or break when inlined. */
const IGNORE = new Set([
  "cursor",
  "pointer-events",
  "user-select",
  "-webkit-user-select",
  "touch-action",
  "will-change",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "transition-behavior",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "animation-timing-function",
  "animation-composition",
  "animation-timeline",
  "animation-range-start",
  "animation-range-end",
  "inline-size",
  "block-size",
  "-webkit-locale",
  "scrollbar-color",
  "scrollbar-width",
  "scrollbar-gutter",
]);

/**
 * Inherited properties are always written: the sandbox defaults inherit the
 * page font too, so a diff alone would drop them and the foreignObject would
 * fall back to the UA serif.
 */
const ALWAYS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant-numeric",
  "line-height",
  "letter-spacing",
  "color",
  "fill",
  "stroke",
  "text-anchor",
  "dominant-baseline",
  "white-space",
  "text-align",
  "visibility",
  "opacity",
  "display",
  "text-overflow",
  "overflow",
]);

function inlineStyles(source: Element, target: Element) {
  const isSvg = source.namespaceURI === "http://www.w3.org/2000/svg";
  const cs = getComputedStyle(source);
  const defaults = getDefaultStyle(source.tagName.toLowerCase(), isSvg);
  const decl: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    if (IGNORE.has(name) || name.startsWith("--")) continue;
    const value = cs.getPropertyValue(name);
    if (!ALWAYS.has(name) && defaults.get(name) === value) continue;
    decl.push(`${name}:${value}`);
  }
  // Width/height are needed explicitly on the root and on flex children.
  if (!isSvg) {
    decl.push(`width:${cs.width}`, `height:${cs.height}`);
    // Box-sizing must match or the explicit size drifts.
    decl.push(`box-sizing:${cs.boxSizing}`);
  }
  (target as HTMLElement).setAttribute("style", decl.join(";"));
  target.removeAttribute("class");
}

function cloneTree(source: Element): Element | null {
  if (SKIP_TAGS.has(source.tagName)) return null;
  const target = source.cloneNode(false) as Element;
  // Strip attributes that would trigger fetches or scripts.
  for (const attr of Array.from(target.attributes)) {
    if (attr.name.startsWith("on") || attr.name === "href" && target.tagName === "A") target.removeAttribute(attr.name);
  }
  inlineStyles(source, target);
  if (source.tagName === "INPUT" || source.tagName === "TEXTAREA") {
    target.setAttribute("value", (source as HTMLInputElement).value);
  }
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(child.textContent ?? ""));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const c = cloneTree(child as Element);
      if (c) target.appendChild(c);
    }
  }
  return target;
}

export interface SnapshotOptions {
  scale: number;
  /** Fill colour painted behind the card; null keeps the PNG transparent. */
  background: string | null;
}

/** The intermediate SVG (foreignObject wrapper) — exposed for debugging. */
export function serializeElement(node: HTMLElement, scale: number): { svg: string; width: number; height: number } {
  const rect = node.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width === 0 || height === 0) throw new Error("Kart boyutu sıfır — dışa aktarılamaz.");

  const clone = cloneTree(node) as HTMLElement;
  clone.style.margin = "0";
  clone.style.position = "static";
  clone.style.transform = "none";
  clone.style.left = "auto";
  clone.style.top = "auto";

  const serializer = new XMLSerializer();
  let markup = serializer.serializeToString(clone);
  // XMLSerializer keeps HTML entities XML-safe, but stray non-breaking
  // spaces and ampersands in text nodes are already escaped. Nothing else to fix.
  markup = markup.replace(/<br>/g, "<br/>");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">${markup}</div>` +
    `</foreignObject></svg>`;
  return { svg, width, height };
}

export async function snapshotElement(node: HTMLElement, opts: SnapshotOptions): Promise<Blob> {
  const { svg, width, height } = serializeElement(node, opts.scale);

  // A data: URL, not a blob: URL — on file:// the page's origin is opaque, so a
  // blob image counts as cross-origin and taints the canvas. Data URLs do not.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * opts.scale;
    canvas.height = height * opts.scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas bağlamı alınamadı.");
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG üretilemedi."))), "image/png")
    );
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG görüntüsü yüklenemedi. Tarayıcı foreignObject desteklemiyor olabilir."));
    img.src = url;
  });
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!("clipboard" in navigator) || typeof ClipboardItem === "undefined") {
    throw new Error("Bu tarayıcıda panoya görüntü kopyalama desteklenmiyor.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
