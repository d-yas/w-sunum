/**
 * Balloons — the four assets that carry words.
 *
 * Text is a real <text> node rather than an HTML overlay, because the SVG
 * layer is what gets cloned into the export. Lines are split on the literal
 * "|" so a two-line callout needs no textarea in the panel.
 */
import { num, round, str, type AssetDef } from "./types";

/** Satır ayracı: gerçek satır sonu ya da eski `|`. */
const AYRAC = /[\r\n|]+/;

/**
 * Split on "|" or a real newline, drop empties, cap at four lines — past that
 * nothing fits. Sahnede yerinde düzenleme gerçek satır sonu üretiyor; `|` eski
 * kayıtlar ve panelin tek satırlık kutusu için duruyor.
 */
function lines(text: string): string[] {
  const out = text
    .split(AYRAC)
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length > 0 ? out.slice(0, 4) : [""];
}

function Label({
  text,
  cx,
  cy,
  size,
  color,
  weight = 600,
  anchor = "middle",
}: {
  text: string;
  cx: number;
  cy: number;
  size: number;
  color: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
}) {
  const rows = lines(text);
  const step = size * 1.25;
  const top = cy - ((rows.length - 1) * step) / 2;
  return (
    <text
      x={round(cx)}
      y={round(top)}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={color}
      fontSize={round(size)}
      fontWeight={weight}
      fontFamily="inherit"
    >
      {rows.map((r, i) => (
        <tspan key={i} x={round(cx)} dy={i === 0 ? 0 : round(step)}>
          {r}
        </tspan>
      ))}
    </text>
  );
}

const TEXT_PARAMS = [
  { type: "metin" as const, key: "yazi", label: "Yazı (| = alt satır)", def: "Buraya dikkat", maxLength: 120 },
  { type: "sayi" as const, key: "punto", label: "Punto", min: 6, max: 64, step: 1, def: 16 },
];

export const BALLOONS: AssetDef[] = [
  {
    id: "balon/konusma",
    duzenle: "yazi",
    label: "Konuşma balonu",
    family: "balon",
    kind: "nesne",
    gizli: true,
    size: { w: 200, h: 86 },
    params: [
      ...TEXT_PARAMS,
      { type: "sayi", key: "yuvarlak", label: "Yuvarlaklık", min: 0, max: 40, step: 1, def: 12 },
      { type: "sayi", key: "kuyruk", label: "Kuyruk boyu", min: 0, max: 40, step: 1, def: 16 },
      { type: "sayi", key: "kuyrukX", label: "Kuyruk konumu", min: 5, max: 95, step: 1, def: 28 },
      { type: "sayi", key: "dolgu", label: "Dolgu", min: 0, max: 1, step: 0.05, def: 1 },
    ],
    render({ w, h, color, paper, ink, p }) {
      const tail = num(p, "kuyruk", 16);
      const bodyH = Math.max(8, h - tail);
      const r = Math.min(num(p, "yuvarlak", 12), bodyH / 2, w / 2);
      const tx = (num(p, "kuyrukX", 28) / 100) * w;
      const fill = num(p, "dolgu", 1);
      const solid = fill > 0.5;
      const d =
        `M${round(r)} 0H${round(w - r)}A${round(r)} ${round(r)} 0 0 1 ${round(w)} ${round(r)}` +
        `V${round(bodyH - r)}A${round(r)} ${round(r)} 0 0 1 ${round(w - r)} ${round(bodyH)}` +
        `H${round(Math.min(w - r, tx + tail * 0.55))}` +
        (tail > 0 ? `L${round(tx)} ${round(h)}L${round(Math.max(r, tx - tail * 0.15))} ${round(bodyH)}` : "") +
        `H${round(r)}A${round(r)} ${round(r)} 0 0 1 0 ${round(bodyH - r)}` +
        `V${round(r)}A${round(r)} ${round(r)} 0 0 1 ${round(r)} 0Z`;
      return (
        <g>
          <path d={d} fill={solid ? color : paper} fillOpacity={solid ? 1 : fill} stroke={color} strokeWidth={solid ? 0 : 2} strokeLinejoin="round" />
          <Label text={str(p, "yazi", "")} cx={w / 2} cy={bodyH / 2} size={num(p, "punto", 16)} color={solid ? paper : ink} />
        </g>
      );
    },
  },
  {
    id: "balon/aciklama",
    duzenle: "yazi",
    label: "Açıklama kutusu",
    family: "metin",
    kind: "nesne",
    size: { w: 220, h: 120 },
    params: [
      ...TEXT_PARAMS,
      { type: "sayi", key: "cizgi", label: "Kılavuz boyu", min: 0, max: 100, step: 1, def: 46 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 6, step: 0.5, def: 1.5 },
      { type: "sayi", key: "nokta", label: "Uç noktası", min: 0, max: 12, step: 0.5, def: 4 },
    ],
    render({ w, h, color, ink, p }) {
      const leader = num(p, "cizgi", 46);
      const t = num(p, "kalinlik", 1.5);
      const dot = num(p, "nokta", 4);
      const boxH = Math.max(10, h - leader);
      // The box sits on top, the leader drops from its lower-left corner to a
      // point — so the placed box's bottom-left *is* the thing being labelled.
      return (
        <g>
          <rect x={round(t / 2)} y={round(t / 2)} width={round(w - t)} height={round(boxH - t)} rx={round(Math.min(8, boxH / 4))} fill="none" stroke={color} strokeWidth={t} />
          <Label text={str(p, "yazi", "")} cx={w / 2} cy={boxH / 2} size={num(p, "punto", 16)} color={ink} weight={500} />
          {leader > 0 && (
            <>
              <path d={`M${round(w * 0.18)} ${round(boxH)}L${round(dot)} ${round(h - dot)}`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" />
              {dot > 0 && <circle cx={round(dot)} cy={round(h - dot)} r={round(dot)} fill={color} />}
            </>
          )}
        </g>
      );
    },
  },
  {
    id: "balon/etiket",
    duzenle: "yazi",
    label: "Etiket bayrağı",
    family: "metin",
    kind: "nesne",
    size: { w: 170, h: 40 },
    params: [
      ...TEXT_PARAMS,
      { type: "sayi", key: "sivri", label: "Sivrilik", min: 0, max: 60, step: 1, def: 16 },
      { type: "secim", key: "yon", label: "Yön", options: [
        { value: "sag", label: "Sağa" },
        { value: "sol", label: "Sola" },
      ], def: "sag" },
    ],
    render({ w, h, color, paper, p }) {
      const tip = num(p, "sivri", 16);
      const right = str(p, "yon", "sag") === "sag";
      const d = right
        ? `M0 0H${round(w - tip)}L${round(w)} ${round(h / 2)}L${round(w - tip)} ${round(h)}H0Z`
        : `M${round(w)} 0H${round(tip)}L0 ${round(h / 2)}L${round(tip)} ${round(h)}H${round(w)}Z`;
      return (
        <g>
          <path d={d} fill={color} />
          <Label
            text={str(p, "yazi", "")}
            cx={right ? (w - tip) / 2 : tip + (w - tip) / 2}
            cy={h / 2}
            size={num(p, "punto", 16)}
            color={paper}
          />
        </g>
      );
    },
  },
  {
    id: "balon/kurdele",
    duzenle: "yazi",
    label: "Kurdele",
    family: "balon",
    kind: "nesne",
    gizli: true,
    size: { w: 240, h: 44 },
    params: [
      ...TEXT_PARAMS,
      { type: "sayi", key: "katlama", label: "Katlanma", min: 0, max: 40, step: 1, def: 18 },
      { type: "sayi", key: "derinlik", label: "Gölge payı", min: 0, max: 24, step: 1, def: 9 },
    ],
    render({ w, h, color, paper, p }) {
      const fold = num(p, "katlama", 18);
      const drop = num(p, "derinlik", 9);
      const bodyH = Math.max(8, h - drop);
      const x0 = fold;
      const x1 = w - fold;
      return (
        <g>
          {fold > 0 &&
            [
              `M0 ${round(drop)}H${round(x0)}V${round(drop + bodyH)}H0L${round(fold * 0.55)} ${round(drop + bodyH / 2)}Z`,
              `M${round(w)} ${round(drop)}H${round(x1)}V${round(drop + bodyH)}H${round(w)}L${round(w - fold * 0.55)} ${round(drop + bodyH / 2)}Z`,
            ].map((d, i) => (
              // The folded ends read as shadow, so they are the ribbon colour
              // with black over it — not the ribbon colour at low opacity,
              // which on a light card makes the fold *lighter* than the body
              // and turns the ribbon inside out.
              <g key={i}>
                <path d={d} fill={color} />
                <path d={d} fill="#000000" opacity={0.28} />
              </g>
            ))}
          <path d={`M${round(x0)} 0H${round(x1)}V${round(bodyH)}H${round(x0)}Z`} fill={color} />
          <Label text={str(p, "yazi", "")} cx={w / 2} cy={bodyH / 2} size={num(p, "punto", 16)} color={paper} weight={700} />
        </g>
      );
    },
  },
];
