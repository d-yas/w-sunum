/**
 * The asset registry — every texture, light, frame, arrow, icon, mark and
 * balloon in one lookup, plus the factories that turn an asset id into a
 * saved slot or a placed item.
 */
import { ARROWS } from "./arrows";
import { BALLOONS } from "./balloons";
import { FRAMES } from "./frames";
import { ICONS } from "./icons";
import { LIGHTS } from "./lights";
import { MARKS } from "./marks";
import { SHAPES } from "./shapes";
import { TEXT } from "./text";
import { TEXTURES } from "./textures";
import type { DecorItem, DecorSlot } from "./model";
import { defaults, type AssetDef, type DecorFamily, type ZeminSlot } from "./types";

export const ASSETS: AssetDef[] = [...TEXTURES, ...LIGHTS, ...FRAMES, ...SHAPES, ...ARROWS, ...ICONS, ...MARKS, ...BALLOONS, ...TEXT];

const BY_ID = new Map(ASSETS.map((a) => [a.id, a]));

export function getAsset(id: string): AssetDef | null {
  return BY_ID.get(id) ?? null;
}

export function assetsOf(family: DecorFamily): AssetDef[] {
  return ASSETS.filter((a) => a.family === family);
}

/** Families that live in a background slot, and which slot each one fills. */
export const ZEMIN_SLOTS: { slot: ZeminSlot; family: DecorFamily; label: string }[] = [
  { slot: "isik", family: "isik", label: "Işık" },
  { slot: "doku", family: "doku", label: "Doku" },
  { slot: "cerceve", family: "cerceve", label: "Çerçeve" },
];

/**
 * Families you place by hand, in the order the gallery shows them. Lights are
 * in both lists on purpose: as a background slot they wash the card, and as a
 * placed object they glow over one region.
 */
export const NESNE_FAMILIES: DecorFamily[] = ["metin", "sekil", "ok", "ikon", "isaret", "balon", "isik"];

/**
 * Yüksekliğini metnine bırakan varlıklarda `h`'yi yeniden hesaplar.
 *
 * Tek kapı: sahne her sürükleme karesinde, panel her ayar değişiminde
 * buradan geçiyor. Ayrı bir "yerleştir" adımı olsaydı metin yazarken kutu
 * büyümez, yalnız bırakınca zıplardı.
 */
export function otomatikBoy(item: DecorItem): DecorItem {
  const def = getAsset(item.asset);
  if (!def?.otomatikYukseklik) return item;
  const h = def.otomatikYukseklik({ ...defaults(def), ...item.params }, item.w);
  if (h == null || !Number.isFinite(h)) return item;
  const yeni = Math.max(8, Math.round(h));
  return yeni === item.h ? item : { ...item, h: yeni };
}

export function newSlot(assetId: string): DecorSlot | null {
  const def = getAsset(assetId);
  if (!def) return null;
  return { asset: def.id, renk: "", renk2: "", opaklik: def.opacity ?? 1, params: defaults(def), gizli: false };
}

let counter = 0;

/**
 * A new placed item, centred on the card. Icons and other square assets are
 * fitted to a square box so the first drag handle the user grabs does not
 * immediately squash them.
 */
export function newItem(assetId: string, cardW: number, cardH: number): DecorItem | null {
  const slot = newSlot(assetId);
  const def = getAsset(assetId);
  if (!slot || !def) return null;
  const want = def.size ?? { w: 120, h: 120 };
  // Never drop something bigger than half the card — it would cover the chart
  // and the user's first move would have to be a resize.
  const fit = Math.min(1, (cardW * 0.5) / want.w, (cardH * 0.5) / want.h);
  const w = Math.round(want.w * fit);
  const h = Math.round(def.square ? w : want.h * fit);
  counter += 1;
  return otomatikBoy({
    ...slot,
    // A placed light almost always belongs behind the chart; everything else
    // is an annotation and belongs in front.
    katman: def.family === "isik" ? "arka" : "on",
    id: `d${Date.now().toString(36)}${counter.toString(36)}`,
    ad: "",
    x: Math.round((cardW - w) / 2),
    y: Math.round((cardH - h) / 2),
    w,
    h,
    aci: 0,
    aynala: false,
    kilit: false,
    grup: "",
  });
}
