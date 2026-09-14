/**
 * Frames — edge treatments drawn over everything else on the card.
 *
 * These default to ink rather than a series colour: a frame is chrome, not
 * data, and a blue hairline around a blue chart reads as a mistake.
 */
import { num, round, str, type AssetDef } from "./types";

const SIDES = [
  { value: "ust", label: "Üst" },
  { value: "alt", label: "Alt" },
  { value: "sol", label: "Sol" },
  { value: "sag", label: "Sağ" },
];

export const FRAMES: AssetDef[] = [
  {
    id: "cerceve/kose",
    label: "Köşe parantezleri",
    family: "cerceve",
    kind: "zemin",
    tone: "murekkep",
    opacity: 0.55,
    params: [
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 60, step: 1, def: 14 },
      { type: "sayi", key: "uzunluk", label: "Kol uzunluğu", min: 8, max: 160, step: 2, def: 42 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 8, step: 0.5, def: 2 },
    ],
    render({ w, h, color, p }) {
      const m = num(p, "bosluk", 14);
      const L = num(p, "uzunluk", 42);
      const x0 = round(m);
      const y0 = round(m);
      const x1 = round(w - m);
      const y1 = round(h - m);
      const d = [
        `M${x0} ${round(m + L)}V${y0}H${round(m + L)}`,
        `M${round(w - m - L)} ${y0}H${x1}V${round(m + L)}`,
        `M${x1} ${round(h - m - L)}V${y1}H${round(w - m - L)}`,
        `M${round(m + L)} ${y1}H${x0}V${round(h - m - L)}`,
      ].join("");
      return <path d={d} fill="none" stroke={color} strokeWidth={num(p, "kalinlik", 2)} strokeLinecap="square" />;
    },
  },
  {
    id: "cerceve/ince",
    label: "Kıl payı çerçeve",
    family: "cerceve",
    kind: "zemin",
    tone: "murekkep",
    opacity: 0.3,
    params: [
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 60, step: 1, def: 12 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 6, step: 0.25, def: 1 },
      { type: "sayi", key: "yuvarlak", label: "Köşe yuvarlaklığı", min: 0, max: 40, step: 1, def: 0 },
    ],
    render({ w, h, color, p }) {
      const m = num(p, "bosluk", 12);
      const t = num(p, "kalinlik", 1);
      return (
        <rect
          x={round(m + t / 2)}
          y={round(m + t / 2)}
          width={round(w - 2 * m - t)}
          height={round(h - 2 * m - t)}
          rx={num(p, "yuvarlak", 0)}
          fill="none"
          stroke={color}
          strokeWidth={t}
        />
      );
    },
  },
  {
    id: "cerceve/kesik",
    label: "Kesik çerçeve",
    family: "cerceve",
    kind: "zemin",
    tone: "murekkep",
    opacity: 0.35,
    params: [
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 60, step: 1, def: 12 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 6, step: 0.25, def: 1.25 },
      { type: "sayi", key: "cizgi", label: "Çizgi boyu", min: 1, max: 30, step: 1, def: 6 },
      { type: "sayi", key: "bosuk", label: "Çizgi arası", min: 1, max: 30, step: 1, def: 6 },
    ],
    render({ w, h, color, p }) {
      const m = num(p, "bosluk", 12);
      const t = num(p, "kalinlik", 1.25);
      return (
        <rect
          x={round(m + t / 2)}
          y={round(m + t / 2)}
          width={round(w - 2 * m - t)}
          height={round(h - 2 * m - t)}
          fill="none"
          stroke={color}
          strokeWidth={t}
          strokeDasharray={`${num(p, "cizgi", 6)} ${num(p, "bosuk", 6)}`}
        />
      );
    },
  },
  {
    id: "cerceve/cift",
    label: "Çift çizgi",
    family: "cerceve",
    kind: "zemin",
    tone: "murekkep",
    opacity: 0.35,
    params: [
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 60, step: 1, def: 10 },
      { type: "sayi", key: "ara", label: "Çizgi arası", min: 1, max: 24, step: 1, def: 5 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 4, step: 0.25, def: 1 },
    ],
    render({ w, h, color, p }) {
      const m = num(p, "bosluk", 10);
      const gap = num(p, "ara", 5);
      const t = num(p, "kalinlik", 1);
      const box = (inset: number) => (
        <rect
          x={round(inset + t / 2)}
          y={round(inset + t / 2)}
          width={round(w - 2 * inset - t)}
          height={round(h - 2 * inset - t)}
          fill="none"
          stroke={color}
          strokeWidth={t}
        />
      );
      return (
        <>
          {box(m)}
          {box(m + gap)}
        </>
      );
    },
  },
  {
    id: "cerceve/serit",
    label: "Kenar şeridi",
    family: "cerceve",
    kind: "zemin",
    opacity: 1,
    params: [
      { type: "secim", key: "kenar", label: "Kenar", options: SIDES, def: "ust" },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 1, max: 40, step: 1, def: 6 },
      { type: "sayi", key: "boy", label: "Uzunluk", min: 5, max: 100, step: 1, def: 100 },
    ],
    render({ w, h, color, p }) {
      const t = num(p, "kalinlik", 6);
      const frac = num(p, "boy", 100) / 100;
      switch (str(p, "kenar", "ust")) {
        case "alt":
          return <rect x="0" y={round(h - t)} width={round(w * frac)} height={round(t)} fill={color} />;
        case "sol":
          return <rect x="0" y="0" width={round(t)} height={round(h * frac)} fill={color} />;
        case "sag":
          return <rect x={round(w - t)} y="0" width={round(t)} height={round(h * frac)} fill={color} />;
        default:
          return <rect x="0" y="0" width={round(w * frac)} height={round(t)} fill={color} />;
      }
    },
  },
  {
    id: "cerceve/vurgu",
    label: "Vurgu çizgisi",
    family: "cerceve",
    kind: "zemin",
    opacity: 1,
    params: [
      { type: "secim", key: "kenar", label: "Kenar", options: SIDES, def: "sol" },
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 80, step: 1, def: 20 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 1, max: 20, step: 0.5, def: 3 },
      { type: "sayi", key: "boy", label: "Uzunluk", min: 5, max: 100, step: 1, def: 55 },
    ],
    render({ w, h, color, p }) {
      const m = num(p, "bosluk", 20);
      const t = num(p, "kalinlik", 3);
      const frac = num(p, "boy", 55) / 100;
      const vert = round((h - 2 * m) * frac);
      const horiz = round((w - 2 * m) * frac);
      switch (str(p, "kenar", "sol")) {
        case "sag":
          return <rect x={round(w - m - t)} y={round(m)} width={round(t)} height={vert} rx={round(t / 2)} fill={color} />;
        case "ust":
          return <rect x={round(m)} y={round(m)} width={horiz} height={round(t)} rx={round(t / 2)} fill={color} />;
        case "alt":
          return <rect x={round(m)} y={round(h - m - t)} width={horiz} height={round(t)} rx={round(t / 2)} fill={color} />;
        default:
          return <rect x={round(m)} y={round(m)} width={round(t)} height={vert} rx={round(t / 2)} fill={color} />;
      }
    },
  },
];
