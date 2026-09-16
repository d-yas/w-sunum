/**
 * The decoration layer as it appears *inside* the slide card.
 *
 * This is the only place decoration is drawn — the stage and the offscreen
 * export render the same ChartCard, so anything added here lands in the PNG
 * and in the PPTX without touching the export code at all.
 *
 * Two phases, stacked by explicit z-index. The card's own content (title,
 * chart, legend, note) is pinned to z-index 1, so "arka" at 0 lands between
 * the card background and the chart, and "on" at 2 lands above both.
 *
 * An earlier version used z-index -1 for "arka" and no z-index on the content.
 * It looked right on the stage and vanished from every PNG: the stage card
 * carries a scale() transform, which quietly creates a stacking context, while
 * the offscreen export card has no transform — so there the negative layer
 * slid behind the card's own background. Hence the explicit pinning.
 */
import type { Theme } from "@/lib/spec";

import type { DecorItem, DecorSlot, DecorState } from "./model";
import { getAsset } from "./registry";
import { defaults, round, type AssetDef, type AssetCtx } from "./types";

export interface DecorLayerProps {
  decor: DecorState;
  phase: "arka" | "on";
  /** Card size in px — the layer's coordinate system. */
  w: number;
  h: number;
  /** Unique per rendered card instance; see AssetCtx.uid. */
  uid: string;
  /** Resolved series colours, already palette- and theme-corrected. */
  colors: string[];
  theme: Theme;
}

/** Concrete values, not CSS variables — the export inlines computed styles
 *  and drops custom properties, so anything var()-shaped is a risk. */
function tones(theme: Theme) {
  return theme === "dark" ? { ink: "#ffffff", paper: "#1a1a19" } : { ink: "#0b0b0b", paper: "#ffffff" };
}

function ctxFor(slot: DecorSlot, def: AssetDef, uid: string, w: number, h: number, colors: string[], theme: Theme): AssetCtx {
  const { ink, paper } = tones(theme);
  const fallback = def.tone === "murekkep" ? ink : colors[0] ?? ink;
  // İkinci renk kendi tonunu taşıyabiliyor: mürekkep tonlu bir metin kutusunun
  // yazısı mürekkep ama dolgusu seri rengi olmalı, yoksa kutu kendi yazısını
  // yutuyor.
  const tone2 = def.tone2 ?? def.tone;
  const fallback2 = tone2 === "murekkep" ? ink : tone2 === "kagit" ? paper : colors[1] ?? colors[0] ?? ink;
  return {
    uid,
    w,
    h,
    color: slot.renk || fallback,
    color2: slot.renk2 || fallback2,
    ink,
    paper,
    p: { ...defaults(def), ...slot.params },
  };
}

function Zemin({ slot, uid, w, h, colors, theme }: { slot: DecorSlot | null } & Omit<DecorLayerProps, "decor" | "phase">) {
  if (!slot || slot.gizli) return null;
  const def = getAsset(slot.asset);
  if (!def) return null;
  return <g opacity={round(slot.opaklik, 3)}>{def.render(ctxFor(slot, def, uid, w, h, colors, theme))}</g>;
}

function Nesne({ item, uid, colors, theme }: { item: DecorItem; uid: string; colors: string[]; theme: Theme }) {
  const def = getAsset(item.asset);
  if (!def || item.gizli) return null;
  // Rotate and mirror about the item's own centre, then hand the asset a
  // plain 0,0–w,h box to draw in. Assets never see the transform.
  //
  // İki uçlu varlıklarda dönüş yok: yön zaten uçların yerinden geliyor, bir de
  // kutuyu çevirmek aynı şeyi iki kez söylemek olurdu.
  const t = def.uclar
    ? `translate(${round(item.x)} ${round(item.y)})`
    : `translate(${round(item.x + item.w / 2)} ${round(item.y + item.h / 2)})` +
      (item.aci ? ` rotate(${round(item.aci, 2)})` : "") +
      (item.aynala ? " scale(-1 1)" : "") +
      ` translate(${round(-item.w / 2)} ${round(-item.h / 2)})`;
  return (
    <g transform={t} opacity={round(item.opaklik, 3)}>
      {def.render(ctxFor(item, def, uid, item.w, item.h, colors, theme))}
    </g>
  );
}

export function DecorLayer({ decor, phase, w, h, uid, colors, theme }: DecorLayerProps) {
  const items = decor.nesneler.filter((n) => n.katman === phase && !n.gizli);
  const back = phase === "arka";
  const gorunur = (s: DecorSlot | null) => (s && !s.gizli ? s : null);
  const hasZemin = back ? gorunur(decor.zemin.isik) || gorunur(decor.zemin.doku) : gorunur(decor.zemin.cerceve);
  if (items.length === 0 && !hasZemin) return null;
  const shared = { uid, w, h, colors, theme };
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      // The SVG download picks the chart out of the card by this attribute.
      data-decor={back ? "arka" : "on"}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        zIndex: back ? 0 : 2,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {back && (
        <>
          <Zemin slot={decor.zemin.isik} {...shared} uid={`${uid}-zi`} />
          <Zemin slot={decor.zemin.doku} {...shared} uid={`${uid}-zd`} />
        </>
      )}
      {items.map((it) => (
        <Nesne key={it.id} item={it} uid={`${uid}-n${it.id}`} colors={colors} theme={theme} />
      ))}
      {!back && <Zemin slot={decor.zemin.cerceve} {...shared} uid={`${uid}-zc`} />}
    </svg>
  );
}
