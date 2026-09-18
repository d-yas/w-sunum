/**
 * Marks — the small things you drop on a chart to say "look here".
 *
 * Unlike icons these are not pictograms; they are annotation furniture, and
 * several of them are deliberately imperfect. The hand-drawn ring and the
 * confetti scatter both run off a seeded generator, so "random" is identical
 * on every render — the stage, the PNG and the PPTX must agree.
 */
import { num, rnd, round, str, type AssetDef } from "./types";

export const MARKS: AssetDef[] = [
  {
    id: "isaret/nabiz",
    label: "Nabız noktası",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 56, h: 56 },
    square: true,
    params: [
      { type: "sayi", key: "cekirdek", label: "Çekirdek", min: 0.05, max: 0.6, step: 0.05, def: 0.22 },
      { type: "sayi", key: "halka", label: "Halka sayısı", min: 1, max: 4, step: 1, def: 2 },
      { type: "sayi", key: "kalinlik", label: "Halka kalınlığı", min: 0.5, max: 8, step: 0.5, def: 1.5 },
    ],
    render({ w, h, color, p }) {
      const R = Math.min(w, h) / 2;
      const core = R * num(p, "cekirdek", 0.22) * 2;
      const rings = Math.round(num(p, "halka", 2));
      return (
        <g>
          {Array.from({ length: rings }, (_, i) => {
            const r = core + ((R - core) * (i + 1)) / rings;
            return (
              <circle
                key={i}
                cx={round(w / 2)}
                cy={round(h / 2)}
                r={round(r - num(p, "kalinlik", 1.5) / 2)}
                fill="none"
                stroke={color}
                strokeWidth={num(p, "kalinlik", 1.5)}
                opacity={round(0.5 - i * 0.15, 3)}
              />
            );
          })}
          <circle cx={round(w / 2)} cy={round(h / 2)} r={round(core)} fill={color} />
        </g>
      );
    },
  },
  {
    id: "isaret/halka",
    label: "Halka nokta",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 40, h: 40 },
    square: true,
    params: [
      { type: "sayi", key: "cekirdek", label: "Çekirdek", min: 0, max: 0.7, step: 0.05, def: 0.3 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 12, step: 0.5, def: 3 },
    ],
    render({ w, h, color, p }) {
      const R = Math.min(w, h) / 2;
      const t = num(p, "kalinlik", 3);
      const core = R * num(p, "cekirdek", 0.3);
      return (
        <g>
          <circle cx={round(w / 2)} cy={round(h / 2)} r={round(R - t / 2)} fill="none" stroke={color} strokeWidth={t} />
          {core > 0 && <circle cx={round(w / 2)} cy={round(h / 2)} r={round(core)} fill={color} />}
        </g>
      );
    },
  },
  {
    id: "isaret/nisangah",
    label: "Nişangâh",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 64, h: 64 },
    square: true,
    params: [
      { type: "sayi", key: "cap", label: "Halka çapı", min: 0.2, max: 0.9, step: 0.05, def: 0.5 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 8, step: 0.5, def: 1.75 },
      { type: "sayi", key: "bosluk", label: "Boşluk", min: 0, max: 0.5, step: 0.05, def: 0.12 },
    ],
    render({ w, h, color, p }) {
      const R = Math.min(w, h) / 2;
      const t = num(p, "kalinlik", 1.75);
      const r = R * num(p, "cap", 0.5);
      const gap = R * num(p, "bosluk", 0.12);
      const cx = w / 2;
      const cy = h / 2;
      const tick = (dx: number, dy: number) =>
        `M${round(cx + dx * (r + gap))} ${round(cy + dy * (r + gap))}L${round(cx + dx * R)} ${round(cy + dy * R)}`;
      return (
        <g fill="none" stroke={color} strokeWidth={t} strokeLinecap="round">
          <circle cx={round(cx)} cy={round(cy)} r={round(r)} />
          <path d={[tick(1, 0), tick(-1, 0), tick(0, 1), tick(0, -1)].join("")} />
        </g>
      );
    },
  },
  {
    id: "isaret/parantez",
    label: "Kucaklayan parantez",
    family: "sekil",
    kind: "nesne",
    size: { w: 200, h: 40 },
    params: [
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 8, step: 0.5, def: 2 },
      { type: "sayi", key: "tirnak", label: "Tırnak boyu", min: 0, max: 40, step: 1, def: 10 },
      { type: "sayi", key: "gosterge", label: "Orta gösterge", min: 0, max: 40, step: 1, def: 12 },
    ],
    render({ w, h, color, p }) {
      const t = num(p, "kalinlik", 2);
      const arm = num(p, "tirnak", 10);
      const stem = num(p, "gosterge", 12);
      const y = h - t / 2 - stem;
      const pad = t / 2;
      // Drawn as a span you place *under* a group of bars: two down-turned
      // ends, one up-turned pointer in the middle.
      const d =
        `M${round(pad)} ${round(y + arm)}V${round(y)}H${round(w - pad)}V${round(y + arm)}` +
        (stem > 0 ? `M${round(w / 2)} ${round(y)}V${round(y - stem)}` : "");
      return <path d={d} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />;
    },
  },
  {
    id: "isaret/altcizgi",
    label: "Fosforlu alt çizgi",
    family: "sekil",
    kind: "nesne",
    size: { w: 220, h: 26 },
    opacity: 0.45,
    params: [
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.2, max: 1, step: 0.05, def: 0.7 },
      { type: "sayi", key: "egim", label: "Eğim", min: -1, max: 1, step: 0.05, def: 0.25 },
    ],
    render({ w, h, color, p }) {
      const th = h * num(p, "kalinlik", 0.7);
      const tilt = num(p, "egim", 0.25) * (h - th) * 0.5;
      const y = h - th / 2 - Math.max(0, tilt);
      // A marker stroke, not a rectangle: the ends are ragged and the body
      // swells, the way a chisel tip lays down ink.
      const d =
        `M0 ${round(y + tilt + th * 0.5)}` +
        `Q${round(w * 0.3)} ${round(y + tilt * 0.4 - th * 0.55)} ${round(w)} ${round(y - tilt - th * 0.42)}` +
        `L${round(w)} ${round(y - tilt + th * 0.5)}` +
        `Q${round(w * 0.35)} ${round(y + tilt * 0.4 + th * 0.62)} 0 ${round(y + tilt + th * 0.55)}Z`;
      return <path d={d} fill={color} />;
    },
  },
  {
    id: "isaret/daire-vurgu",
    label: "Daire vurgusu",
    family: "sekil",
    kind: "nesne",
    size: { w: 200, h: 110 },
    params: [
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 10, step: 0.5, def: 2.5 },
      { type: "sayi", key: "tur", label: "Tur", min: 1, max: 2.5, step: 0.1, def: 1.25 },
      { type: "sayi", key: "titrek", label: "Titreklik", min: 0, max: 1, step: 0.05, def: 0.35 },
      { type: "sayi", key: "tohum", label: "Tohum", min: 1, max: 40, step: 1, def: 5 },
    ],
    render({ w, h, color, p }) {
      const t = num(p, "kalinlik", 2.5);
      const turns = num(p, "tur", 1.25);
      const wob = num(p, "titrek", 0.35);
      const rand = rnd(Math.round(num(p, "tohum", 5)));
      const rx = w / 2 - t;
      const ry = h / 2 - t;
      const steps = Math.max(24, Math.round(turns * 40));
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const prog = i / steps;
        const a = prog * turns * Math.PI * 2 - Math.PI * 0.6;
        // The radius drifts and the whole loop spirals slightly outward, which
        // is what a marker circled twice around a word actually looks like.
        const drift = 1 - wob * 0.12 + prog * wob * 0.14;
        const n = (rand() - 0.5) * wob * 0.09;
        pts.push(`${round(w / 2 + Math.cos(a) * rx * (drift + n), 1)} ${round(h / 2 + Math.sin(a) * ry * (drift + n), 1)}`);
      }
      return <path d={`M${pts.join("L")}`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" />;
    },
  },
  {
    id: "isaret/rozet",
    duzenle: "yazi",
    label: "Rozet",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 70, h: 34 },
    params: [
      { type: "metin", key: "yazi", label: "Yazı", def: "+12%", maxLength: 24 },
      { type: "sayi", key: "punto", label: "Punto", min: 6, max: 60, step: 1, def: 15 },
      { type: "sayi", key: "yuvarlak", label: "Yuvarlaklık", min: 0, max: 50, step: 1, def: 50 },
    ],
    render({ w, h, color, paper, p }) {
      const r = (Math.min(w, h) / 2) * (num(p, "yuvarlak", 50) / 50);
      return (
        <g>
          <rect x="0" y="0" width={round(w)} height={round(h)} rx={round(r)} fill={color} />
          <text
            x={round(w / 2)}
            y={round(h / 2)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={paper}
            fontSize={num(p, "punto", 15)}
            fontWeight={600}
            fontFamily="inherit"
          >
            {str(p, "yazi", "")}
          </text>
        </g>
      );
    },
  },
  {
    id: "isaret/patlama",
    label: "Yıldız patlaması",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 80, h: 80 },
    square: true,
    params: [
      { type: "sayi", key: "isin", label: "Işın sayısı", min: 4, max: 24, step: 1, def: 10 },
      { type: "sayi", key: "ic", label: "İç yarıçap", min: 0, max: 0.8, step: 0.05, def: 0.3 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 8, step: 0.5, def: 2 },
    ],
    render({ w, h, color, p }) {
      const n = Math.round(num(p, "isin", 10));
      const R = Math.min(w, h) / 2;
      const inner = R * num(p, "ic", 0.3);
      const cx = w / 2;
      const cy = h / 2;
      const d: string[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const long = i % 2 === 0 ? R : R * 0.7;
        d.push(
          `M${round(cx + Math.cos(a) * inner)} ${round(cy + Math.sin(a) * inner)}` +
            `L${round(cx + Math.cos(a) * long)} ${round(cy + Math.sin(a) * long)}`
        );
      }
      return <path d={d.join("")} fill="none" stroke={color} strokeWidth={num(p, "kalinlik", 2)} strokeLinecap="round" />;
    },
  },
  {
    id: "isaret/baglanti",
    label: "Noktalı bağlantı",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 180, h: 40 },
    params: [
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 6, step: 0.5, def: 1.5 },
      { type: "sayi", key: "aralik", label: "Nokta aralığı", min: 2, max: 24, step: 1, def: 6 },
      { type: "sayi", key: "uc", label: "Uç noktası", min: 0, max: 14, step: 0.5, def: 4 },
    ],
    render({ w, h, color, p }) {
      const t = num(p, "kalinlik", 1.5);
      const dot = num(p, "uc", 4);
      const y = h / 2;
      return (
        <g>
          <path
            d={`M${round(dot)} ${round(y)}H${round(w - dot)}`}
            fill="none"
            stroke={color}
            strokeWidth={t}
            strokeLinecap="round"
            strokeDasharray={`0.01 ${num(p, "aralik", 6)}`}
          />
          {dot > 0 && (
            <>
              <circle cx={round(dot)} cy={round(y)} r={round(dot)} fill={color} />
              <circle cx={round(w - dot)} cy={round(y)} r={round(dot)} fill={color} />
            </>
          )}
        </g>
      );
    },
  },
  {
    id: "isaret/konfeti",
    label: "Konfeti",
    family: "isaret",
    kind: "nesne",
    gizli: true,
    size: { w: 220, h: 140 },
    opacity: 0.8,
    twoTone: true,
    params: [
      { type: "sayi", key: "adet", label: "Adet", min: 4, max: 120, step: 1, def: 34 },
      { type: "sayi", key: "boy", label: "Parça boyu", min: 1, max: 20, step: 0.5, def: 5 },
      { type: "sayi", key: "tohum", label: "Tohum", min: 1, max: 40, step: 1, def: 9 },
    ],
    render({ w, h, color, color2, p }) {
      const n = Math.round(num(p, "adet", 34));
      const size = num(p, "boy", 5);
      const rand = rnd(Math.round(num(p, "tohum", 9)));
      const bits = Array.from({ length: n }, (_, i) => {
        const x = rand() * (w - size * 2) + size;
        const y = rand() * (h - size * 2) + size;
        const rot = rand() * 90;
        const kind = Math.floor(rand() * 3);
        const s = size * (0.6 + rand() * 0.8);
        return { x, y, rot, kind, s, c: i % 3 === 0 ? color2 : color };
      });
      return (
        <g>
          {bits.map((b, i) => (
            <g key={i} transform={`translate(${round(b.x, 1)} ${round(b.y, 1)}) rotate(${round(b.rot, 1)})`}>
              {b.kind === 0 ? (
                <rect x={round(-b.s / 2, 2)} y={round(-b.s / 6, 2)} width={round(b.s, 2)} height={round(b.s / 3, 2)} rx={round(b.s / 8, 2)} fill={b.c} />
              ) : b.kind === 1 ? (
                <circle cx="0" cy="0" r={round(b.s / 3, 2)} fill={b.c} />
              ) : (
                <path
                  d={`M0 ${round(-b.s / 2, 2)}L${round(b.s / 2, 2)} 0L0 ${round(b.s / 2, 2)}L${round(-b.s / 2, 2)} 0Z`}
                  fill={b.c}
                />
              )}
            </g>
          ))}
        </g>
      );
    },
  },
];
