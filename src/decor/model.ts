/**
 * The saved shape of a card's decoration.
 *
 * Kept free of React and of the asset registry on purpose: `spec.ts` and
 * `storage.ts` import from here, the registry imports from here too, and
 * nothing imports back. Coordinates are in card pixels (0…width, 0…height),
 * so a placement survives zooming, and survives a card resize as a fixed
 * offset rather than drifting.
 */
import type { ParamValues } from "./types";

export interface DecorSlot {
  asset: string;
  /** "" means: take the asset's tone default (series colour, or ink). */
  renk: string;
  /** "" means: take the palette's second colour. Only two-tone assets read it. */
  renk2: string;
  opaklik: number;
  params: ParamValues;
}

export interface DecorItem extends DecorSlot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, about the item's own centre. */
  aci: number;
  aynala: boolean;
  katman: "arka" | "on";
  gizli: boolean;
  kilit: boolean;
}

export interface DecorState {
  zemin: {
    doku: DecorSlot | null;
    isik: DecorSlot | null;
    cerceve: DecorSlot | null;
  };
  nesneler: DecorItem[];
}

/* ------------------------------------------------------------------ */
/* Free layout — the card's own parts, moved by hand                    */
/* ------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The three movable parts of a card. Title and subtitle travel together. */
export type SlotKey = "baslik" | "grafik" | "dipnot";
export const SLOT_KEYS: SlotKey[] = ["baslik", "grafik", "dipnot"];
export const SLOT_LABELS: Record<SlotKey, string> = {
  baslik: "Başlık bloğu",
  grafik: "Grafik",
  dipnot: "Dipnot",
};

export interface CardLayout {
  /** Off means the card lays itself out, exactly as it always did. */
  serbest: boolean;
  /**
   * Card-space boxes, the same coordinates decoration uses: measured from the
   * card's outer edge, padding included. One coordinate system for everything
   * the stage can drag.
   */
  kutular: Partial<Record<SlotKey, Box>>;
}

export function emptyLayout(): CardLayout {
  return { serbest: false, kutular: {} };
}

export function normalizeLayout(input: unknown): CardLayout {
  if (!input || typeof input !== "object") return emptyLayout();
  const l = input as Partial<CardLayout>;
  const src = (l.kutular ?? {}) as Record<string, unknown>;
  const kutular: Partial<Record<SlotKey, Box>> = {};
  for (const key of SLOT_KEYS) {
    const b = src[key] as Partial<Box> | undefined;
    if (!b || typeof b !== "object") continue;
    kutular[key] = {
      x: clamp(b.x, -5000, 5000, 0),
      y: clamp(b.y, -5000, 5000, 0),
      w: clamp(b.w, 16, 5000, 100),
      h: clamp(b.h, 16, 5000, 100),
    };
  }
  return { serbest: l.serbest === true, kutular };
}

export function emptyDecor(): DecorState {
  return { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] };
}

function clamp(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

function normalizeParams(input: unknown): ParamValues {
  if (!input || typeof input !== "object") return {};
  const out: ParamValues = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 200);
  }
  return out;
}

function normalizeSlot(input: unknown): DecorSlot | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Partial<DecorSlot>;
  if (typeof s.asset !== "string" || !s.asset) return null;
  return {
    asset: s.asset,
    renk: typeof s.renk === "string" ? s.renk : "",
    renk2: typeof s.renk2 === "string" ? s.renk2 : "",
    opaklik: clamp(s.opaklik, 0, 1, 1),
    params: normalizeParams(s.params),
  };
}

/** Fill in anything a saved workspace is missing, and drop what makes no sense. */
export function normalizeDecor(input: unknown): DecorState {
  if (!input || typeof input !== "object") return emptyDecor();
  const d = input as Partial<DecorState>;
  const z = (d.zemin ?? {}) as Partial<DecorState["zemin"]>;
  const items = Array.isArray(d.nesneler) ? d.nesneler : [];
  return {
    zemin: {
      doku: normalizeSlot(z.doku),
      isik: normalizeSlot(z.isik),
      cerceve: normalizeSlot(z.cerceve),
    },
    nesneler: items
      .map((raw, i): DecorItem | null => {
        const slot = normalizeSlot(raw);
        if (!slot) return null;
        const it = raw as Partial<DecorItem>;
        return {
          ...slot,
          id: typeof it.id === "string" && it.id ? it.id : `d${i}-${Math.random().toString(36).slice(2, 8)}`,
          x: clamp(it.x, -5000, 5000, 0),
          y: clamp(it.y, -5000, 5000, 0),
          w: clamp(it.w, 4, 5000, 120),
          h: clamp(it.h, 4, 5000, 120),
          aci: clamp(it.aci, -360, 360, 0),
          aynala: it.aynala === true,
          katman: it.katman === "arka" ? "arka" : "on",
          gizli: it.gizli === true,
          kilit: it.kilit === true,
        };
      })
      .filter((x): x is DecorItem => x !== null),
  };
}

/** True when a card carries nothing — lets the panel and the layer skip work. */
export function isDecorEmpty(d: DecorState): boolean {
  return !d.zemin.doku && !d.zemin.isik && !d.zemin.cerceve && d.nesneler.length === 0;
}
