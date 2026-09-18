/**
 * Decoration assets — the SVG pack that rides along with a chart card.
 *
 * Two cinses, one contract. A *zemin* asset paints the whole card (texture,
 * light, frame); a *nesne* asset is placed, sized and rotated by the user.
 * Both render into a viewBox measured in the card's own pixels, so nothing is
 * ever scaled non-uniformly — an arrow stretched to 400×80 draws its path at
 * 400×80 rather than distorting a 100×100 original.
 *
 * Everything here is generated in code. No file is fetched, which is what
 * keeps the single-file offline build honest.
 */
import type { ReactNode } from "react";

export type DecorFamily = "doku" | "isik" | "cerceve" | "sekil" | "ok" | "ikon" | "isaret" | "balon" | "metin";
export type DecorKind = "zemin" | "nesne";
/** Behind the chart, or over it. */
export type DecorZ = "arka" | "on";

export const FAMILY_LABELS: Record<DecorFamily, string> = {
  doku: "Doku",
  isik: "Işık",
  cerceve: "Çerçeve",
  sekil: "Şekil",
  ok: "Ok",
  ikon: "İkon",
  isaret: "İşaret",
  balon: "Balon",
  metin: "Metin",
};

/** Which background slot a zemin family occupies — one asset per slot. */
export type ZeminSlot = "doku" | "isik" | "cerceve";

interface ParamBase {
  key: string;
  label: string;
  /**
   * Panelde çizilmez. Sahnede başka bir tutamakla düzenlenen parametreler
   * için: bir bağlantının uç noktalarını kaydırıcıyla ayarlamak kimsenin
   * aklından geçmiyor, ama değerin kayıtlı bir parametre olması şart.
   */
  gizli?: boolean;
}

export interface NumParam extends ParamBase {
  type: "sayi";
  min: number;
  max: number;
  step: number;
  def: number;
}
export interface TextParam extends ParamBase {
  type: "metin";
  def: string;
  maxLength?: number;
  /** Panelde tek satırlık kutu yerine çok satırlı alan. */
  multiline?: boolean;
}
export interface ChoiceParam extends ParamBase {
  type: "secim";
  options: { value: string; label: string }[];
  def: string;
}
export type ParamDef = NumParam | TextParam | ChoiceParam;

export type ParamValues = Record<string, number | string>;

export interface AssetCtx {
  /**
   * Unique prefix for any `id` this asset mints. One per card instance per
   * item — the stage card and the offscreen export card render at the same
   * time, and `url(#x)` resolves per *document*, not per `<svg>`.
   */
  uid: string;
  /** Width and height of the box to draw into, in card pixels. */
  w: number;
  h: number;
  /** Primary colour, already resolved to a concrete value (never a CSS var). */
  color: string;
  /** Secondary colour, for two-tone assets. */
  color2: string;
  /** Text colour that reads against the card, for labels inside balloons. */
  ink: string;
  /** Card background, for knock-out fills. */
  paper: string;
  /** Parameter values, defaults already merged in. */
  p: ParamValues;
}

export interface AssetDef {
  id: string;
  label: string;
  family: DecorFamily;
  kind: DecorKind;
  /**
   * Galeride listelenmez ama yüklenmeye devam eder. Kaydedilmiş işler bu
   * varlıkları hâlâ çiziyor; yalnız yeni eklemek için sunulmuyorlar.
   */
  gizli?: boolean;
  params?: ParamDef[];
  /** Default placed size in card px — nesne only. */
  size?: { w: number; h: number };
  /** Default opacity, 0–1. */
  opacity?: number;
  /** Keep the placed box square (icons, marks that must not squash). */
  square?: boolean;
  /**
   * What an empty colour means. "seri" takes the chart's first series colour —
   * the default, and why decoration matches the chart for free. "murekkep"
   * takes the card's text colour, which is what a vignette or a hairline
   * frame wants: a blue vignette is nobody's idea of a vignette.
   */
  tone?: "seri" | "murekkep";
  /** Asset reads ctx.color2 as a real second colour, so the panel offers one. */
  twoTone?: boolean;
  /**
   * İkinci rengin boş bırakıldığında ne olacağı. Yazılmazsa `tone` ile aynı
   * mantık yürür ve bu çoğu varlık için doğru; ama mürekkep tonlu bir metin
   * kutusunun **dolgusu** mürekkep olursa yazı kendi zemininde kaybolur.
   */
  tone2?: "seri" | "murekkep" | "kagit";
  /**
   * Sahnede çift tıklayınca yerinde düzenlenecek metin parametresinin adı.
   * Varlık kendi metnini nasıl çizdiğini bilir; sahne yalnız hangi anahtarı
   * yazacağını bilir.
   */
  duzenle?: string;
  /**
   * Yüksekliği metne bırakan varlıklar. Genişlik ya da metin değişince sahne
   * ve panel bunu çağırıp `h`'yi yeniden yazıyor. `null` dönmek "kullanıcı
   * yüksekliği kendi sabitledi, karışma" demek.
   */
  otomatikYukseklik?: (p: ParamValues, w: number) => number | null;
  /**
   * İki uçlu varlıklar (bağlantı çizgisi). Uçlar kutunun yüzdesi olarak
   * parametrede durur; sahne köşe tutamakları yerine iki nokta gösterir ve
   * uç sürüklenince kutuyu iki noktanın sınırlayıcı dikdörtgeni olarak
   * yeniden yazar. Döndürme ve aynalama bu varlıklarda anlamsız.
   */
  uclar?: {
    x1: string;
    y1: string;
    x2: string;
    y2: string;
    /** Uçların kutudan taşma payı (kalınlık, ok başı) — px. */
    pay?: (p: ParamValues) => number;
  };
  /**
   * Names the 0–100 parameters that hold this asset's position, which lets the
   * stage offer a draggable dot for them. A background light covers the whole
   * card, so it has no box to grab — this is how you move its centre.
   */
  anchor?: { x?: string; y?: string };
  render(ctx: AssetCtx): ReactNode;
}

/* ------------------------------------------------------------------ */
/* Param helpers — assets read through these so a corrupt saved value   */
/* can never throw or produce NaN geometry.                             */
/* ------------------------------------------------------------------ */

export function num(p: ParamValues, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function str(p: ParamValues, key: string, fallback: string): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

export function defaults(def: AssetDef): ParamValues {
  const out: ParamValues = {};
  for (const par of def.params ?? []) out[par.key] = par.def;
  return out;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers shared by the asset modules                         */
/* ------------------------------------------------------------------ */

/** A circle as path data — icons are a flat table of `d` strings. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}a${r} ${r} 0 1 0 0.01 0Z`;
}

/** Deterministic 0–1 noise, so "random" scatter is identical on every render. */
export function rnd(seed: number): () => number {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Mix a hex colour toward transparency — assets fade with alpha, never blur. */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${round(Math.max(0, Math.min(1, a)) * 100, 1)}%, transparent)`;
}
