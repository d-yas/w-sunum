/**
 * Textures — repeating fills that sit behind the chart.
 *
 * Each one is an SVG <pattern> (or, for the two noise textures, a
 * feTurbulence filter) plus a <rect> covering the card. The fade parameter is
 * a gradient <mask>: a flat wash of dots reads as wallpaper, a fading one
 * reads as design.
 */
import type { ReactNode } from "react";

import { alpha, num, rnd, round, str, type AssetCtx, type AssetDef } from "./types";

const DIRS = [
  { value: "sag", label: "Sağa" },
  { value: "sol", label: "Sola" },
  { value: "asagi", label: "Aşağı" },
  { value: "yukari", label: "Yukarı" },
  { value: "merkez", label: "Merkezden" },
];

const FADE_PARAMS = [
  { type: "sayi" as const, key: "solme", label: "Solma", min: 0, max: 1, step: 0.05, def: 0.6 },
  { type: "secim" as const, key: "yon", label: "Yön", options: DIRS, def: "sag" },
];

/** Gradient mask that thins the pattern toward one side. 0 = flat wash. */
function Fade({ uid, w, h, amount, dir }: { uid: string; w: number; h: number; amount: number; dir: string }) {
  if (amount <= 0) return null;
  const keep = round(1 - Math.min(1, amount), 3);
  const line = ({ sag: [0, 0, 1, 0], sol: [1, 0, 0, 0], asagi: [0, 0, 0, 1], yukari: [0, 1, 0, 0] } as Record<string, number[]>)[dir] ?? [0, 0, 1, 0];
  return (
    <defs>
      {dir === "merkez" ? (
        <radialGradient id={`${uid}-fade`} cx="0.5" cy="0.5" r="0.72">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={keep} />
        </radialGradient>
      ) : (
        <linearGradient id={`${uid}-fade`} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]}>
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={keep} />
        </linearGradient>
      )}
      <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
        <rect width={w} height={h} fill={`url(#${uid}-fade)`} />
      </mask>
    </defs>
  );
}

/** The shared shell: pattern in <defs>, one covering rect, optional fade. */
function Tiled({ ctx, tile, children, rotate = 0 }: { ctx: AssetCtx; tile: { w: number; h: number }; children: ReactNode; rotate?: number }) {
  const { uid, w, h, p } = ctx;
  const fade = num(p, "solme", 0);
  return (
    <>
      <defs>
        <pattern
          id={`${uid}-pat`}
          width={round(tile.w)}
          height={round(tile.h)}
          patternUnits="userSpaceOnUse"
          patternTransform={rotate ? `rotate(${round(rotate)})` : undefined}
        >
          {children}
        </pattern>
      </defs>
      <Fade uid={uid} w={w} h={h} amount={fade} dir={str(p, "yon", "sag")} />
      <rect width={w} height={h} fill={`url(#${uid}-pat)`} mask={fade > 0 ? `url(#${uid}-mask)` : undefined} />
    </>
  );
}

export const TEXTURES: AssetDef[] = [
  {
    id: "doku/nokta",
    label: "Nokta ızgarası",
    family: "doku",
    kind: "zemin",
    opacity: 0.5,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 6, max: 64, step: 1, def: 18 },
      { type: "sayi", key: "cap", label: "Nokta çapı", min: 0.5, max: 8, step: 0.25, def: 1.6 },
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 90, step: 1, def: 0 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 18);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }} rotate={num(ctx.p, "aci", 0)}>
          <circle cx={round(s / 2)} cy={round(s / 2)} r={round(num(ctx.p, "cap", 1.6))} fill={ctx.color} />
        </Tiled>
      );
    },
  },
  {
    id: "doku/izgara",
    label: "Çizgi ızgara",
    family: "doku",
    kind: "zemin",
    opacity: 0.45,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 6, max: 80, step: 1, def: 24 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 3, step: 0.25, def: 0.75 },
      { type: "sayi", key: "ana", label: "Kalın her N", min: 0, max: 10, step: 1, def: 5 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 24);
      const t = num(ctx.p, "kalinlik", 0.75);
      const major = Math.round(num(ctx.p, "ana", 5));
      const big = major > 1 ? s * major : 0;
      const fade = num(ctx.p, "solme", 0);
      return (
        <>
          <Tiled ctx={ctx} tile={{ w: s, h: s }}>
            <path d={`M0 0H${round(s)}M0 0V${round(s)}`} stroke={ctx.color} strokeWidth={t} fill="none" />
          </Tiled>
          {big > 0 && (
            <>
              <defs>
                <pattern id={`${ctx.uid}-maj`} width={round(big)} height={round(big)} patternUnits="userSpaceOnUse">
                  <path d={`M0 0H${round(big)}M0 0V${round(big)}`} stroke={ctx.color} strokeWidth={round(t * 2)} fill="none" />
                </pattern>
              </defs>
              <rect width={ctx.w} height={ctx.h} fill={`url(#${ctx.uid}-maj)`} mask={fade > 0 ? `url(#${ctx.uid}-mask)` : undefined} />
            </>
          )}
        </>
      );
    },
  },
  {
    id: "doku/tarama",
    label: "Eğik tarama",
    family: "doku",
    kind: "zemin",
    opacity: 0.35,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 3, max: 40, step: 1, def: 8 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 8, step: 0.25, def: 1.5 },
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 180, step: 5, def: 45 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 8);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }} rotate={num(ctx.p, "aci", 45)}>
          <path d={`M0 0V${round(s)}`} stroke={ctx.color} strokeWidth={num(ctx.p, "kalinlik", 1.5)} fill="none" />
        </Tiled>
      );
    },
  },
  {
    id: "doku/capraz",
    label: "Çapraz tarama",
    family: "doku",
    kind: "zemin",
    opacity: 0.3,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 4, max: 48, step: 1, def: 12 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 5, step: 0.25, def: 1 },
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 90, step: 5, def: 45 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 12);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }} rotate={num(ctx.p, "aci", 45)}>
          <path d={`M0 0V${round(s)}M0 0H${round(s)}`} stroke={ctx.color} strokeWidth={num(ctx.p, "kalinlik", 1)} fill="none" />
        </Tiled>
      );
    },
  },
  {
    id: "doku/halka",
    label: "Halka ızgarası",
    family: "doku",
    kind: "zemin",
    opacity: 0.35,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 10, max: 90, step: 1, def: 28 },
      { type: "sayi", key: "cap", label: "Yarıçap", min: 2, max: 40, step: 1, def: 9 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 6, step: 0.25, def: 1 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 28);
      const r = Math.min(num(ctx.p, "cap", 9), s / 2);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }}>
          <circle cx={round(s / 2)} cy={round(s / 2)} r={round(r)} fill="none" stroke={ctx.color} strokeWidth={num(ctx.p, "kalinlik", 1)} />
        </Tiled>
      );
    },
  },
  {
    id: "doku/dalga",
    label: "Dalga",
    family: "doku",
    kind: "zemin",
    opacity: 0.4,
    params: [
      { type: "sayi", key: "boy", label: "Dalga boyu", min: 12, max: 160, step: 2, def: 48 },
      { type: "sayi", key: "genlik", label: "Genlik", min: 1, max: 40, step: 1, def: 7 },
      { type: "sayi", key: "aralik", label: "Satır aralığı", min: 6, max: 80, step: 1, def: 20 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 5, step: 0.25, def: 1.25 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const L = num(ctx.p, "boy", 48);
      const A = num(ctx.p, "genlik", 7);
      const S = Math.max(num(ctx.p, "aralik", 20), A * 2 + 2);
      const m = round(S / 2);
      return (
        <Tiled ctx={ctx} tile={{ w: L, h: S }}>
          <path
            d={`M0 ${m}q${round(L / 4)} ${round(-A * 2)} ${round(L / 2)} 0t${round(L / 2)} 0`}
            fill="none"
            stroke={ctx.color}
            strokeWidth={num(ctx.p, "kalinlik", 1.25)}
          />
        </Tiled>
      );
    },
  },
  {
    id: "doku/izometrik",
    label: "İzometrik ızgara",
    family: "doku",
    kind: "zemin",
    opacity: 0.3,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 8, max: 90, step: 1, def: 28 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 4, step: 0.25, def: 0.85 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 28);
      const h = round(s * 0.8660254);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h }}>
          <path
            d={`M0 ${h}H${round(s)}M0 ${h}L${round(s / 2)} 0M${round(s / 2)} 0L${round(s)} ${h}`}
            fill="none"
            stroke={ctx.color}
            strokeWidth={num(ctx.p, "kalinlik", 0.85)}
          />
        </Tiled>
      );
    },
  },
  {
    id: "doku/arti",
    label: "Artı işaretleri",
    family: "doku",
    kind: "zemin",
    opacity: 0.4,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 10, max: 90, step: 1, def: 32 },
      { type: "sayi", key: "boy", label: "İşaret boyu", min: 2, max: 24, step: 1, def: 6 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 4, step: 0.25, def: 1 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 32);
      const a = Math.min(num(ctx.p, "boy", 6), s / 2) / 2;
      const c = s / 2;
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }}>
          <path
            d={`M${round(c - a)} ${round(c)}h${round(a * 2)}M${round(c)} ${round(c - a)}v${round(a * 2)}`}
            fill="none"
            stroke={ctx.color}
            strokeWidth={num(ctx.p, "kalinlik", 1)}
            strokeLinecap="round"
          />
        </Tiled>
      );
    },
  },
  {
    id: "doku/petek",
    label: "Petek",
    family: "doku",
    kind: "zemin",
    opacity: 0.3,
    params: [
      { type: "sayi", key: "aralik", label: "Kenar", min: 6, max: 60, step: 1, def: 18 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 4, step: 0.25, def: 0.9 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const a = num(ctx.p, "aralik", 18);
      const vh = a * 0.8660254;
      const hex = (cx: number, cy: number) =>
        `M${round(cx + a)} ${round(cy)}L${round(cx + a / 2)} ${round(cy + vh)}L${round(cx - a / 2)} ${round(cy + vh)}` +
        `L${round(cx - a)} ${round(cy)}L${round(cx - a / 2)} ${round(cy - vh)}L${round(cx + a / 2)} ${round(cy - vh)}Z`;
      const tw = a * 3;
      const th = vh * 2;
      return (
        <Tiled ctx={ctx} tile={{ w: tw, h: th }}>
          <path
            d={[hex(0, 0), hex(tw, 0), hex(0, th), hex(tw, th), hex(a * 1.5, vh)].join("")}
            fill="none"
            stroke={ctx.color}
            strokeWidth={num(ctx.p, "kalinlik", 0.9)}
          />
        </Tiled>
      );
    },
  },
  {
    id: "doku/satir",
    label: "Tarama çizgileri",
    family: "doku",
    kind: "zemin",
    opacity: 0.3,
    params: [
      { type: "sayi", key: "aralik", label: "Aralık", min: 2, max: 40, step: 1, def: 5 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 12, step: 0.25, def: 1.5 },
      ...FADE_PARAMS,
    ],
    render(ctx) {
      const s = num(ctx.p, "aralik", 5);
      const t = Math.min(num(ctx.p, "kalinlik", 1.5), s);
      return (
        <Tiled ctx={ctx} tile={{ w: s, h: s }}>
          <rect x="0" y="0" width={round(s)} height={round(t)} fill={ctx.color} />
        </Tiled>
      );
    },
  },
  {
    id: "doku/topografya",
    label: "Eşyükselti",
    family: "doku",
    kind: "zemin",
    opacity: 0.4,
    params: [
      { type: "sayi", key: "sayi", label: "Halka sayısı", min: 3, max: 26, step: 1, def: 12 },
      { type: "sayi", key: "girinti", label: "Girinti", min: 0, max: 1, step: 0.05, def: 0.35 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 4, step: 0.25, def: 1 },
      { type: "sayi", key: "tohum", label: "Tohum", min: 1, max: 40, step: 1, def: 7 },
    ],
    render({ w, h, color, p }) {
      const rings = Math.round(num(p, "sayi", 12));
      const wob = num(p, "girinti", 0.35);
      const cx = w * 0.42;
      const cy = h * 0.5;
      const base = Math.max(w, h) * 0.08;
      const grow = (Math.max(w, h) * 0.95 - base) / Math.max(1, rings - 1);
      // Four sine harmonics rather than per-angle white noise. Independent
      // random radii gave a star, not a contour: the whole point of a terrain
      // line is that it is smooth and closes on itself. Every ring shares the
      // harmonics and only drifts their phase, so the rings nest instead of
      // crossing.
      const rand = rnd(Math.round(num(p, "tohum", 7)));
      const harm = [2, 3, 5, 8].map((k) => ({ k, a: 0.35 + rand() * 0.65, ph: rand() * Math.PI * 2 }));
      const norm = harm.reduce((sum, hm) => sum + hm.a, 0) || 1;
      const steps = 84;
      const paths: string[] = [];
      for (let i = 0; i < rings; i++) {
        const r = base + i * grow;
        const drift = i * 0.22;
        const pts: string[] = [];
        for (let k = 0; k <= steps; k++) {
          const t = (k / steps) * Math.PI * 2;
          const off = harm.reduce((sum, hm) => sum + hm.a * Math.sin(hm.k * t + hm.ph + drift), 0) / norm;
          const rr = r * (1 + off * wob * 0.3);
          pts.push(`${round(cx + Math.cos(t) * rr * 1.25, 1)} ${round(cy + Math.sin(t) * rr, 1)}`);
        }
        paths.push(`M${pts.join("L")}Z`);
      }
      return (
        <g fill="none" stroke={color} strokeWidth={num(p, "kalinlik", 1)}>
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      );
    },
  },
  {
    id: "doku/gren",
    label: "Gren",
    family: "doku",
    kind: "zemin",
    opacity: 0.18,
    params: [
      { type: "sayi", key: "incelik", label: "İncelik", min: 0.2, max: 2.5, step: 0.05, def: 0.9 },
      { type: "sayi", key: "katman", label: "Katman", min: 1, max: 5, step: 1, def: 3 },
    ],
    render({ uid, w, h, p }) {
      return (
        <>
          <defs>
            <filter id={`${uid}-grain`} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={round(num(p, "incelik", 0.9), 3)}
                numOctaves={Math.round(num(p, "katman", 3))}
                seed="11"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width={w} height={h} fill="none" filter={`url(#${uid}-grain)`} />
        </>
      );
    },
  },
  {
    id: "doku/kagit",
    label: "Kağıt lifi",
    family: "doku",
    kind: "zemin",
    opacity: 0.22,
    params: [
      { type: "sayi", key: "incelik", label: "İncelik", min: 0.01, max: 0.4, step: 0.005, def: 0.06 },
      { type: "sayi", key: "uzama", label: "Uzama", min: 1, max: 20, step: 1, def: 9 },
    ],
    render({ uid, w, h, color, p }) {
      const f = num(p, "incelik", 0.06);
      const stretch = num(p, "uzama", 9);
      return (
        <>
          <defs>
            <filter id={`${uid}-fib`} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={`${round(f * stretch, 4)} ${round(f, 4)}`}
                numOctaves="4"
                seed="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width={w} height={h} fill={alpha(color, 0.06)} />
          <rect width={w} height={h} fill="none" filter={`url(#${uid}-fib)`} />
        </>
      );
    },
  },
];
