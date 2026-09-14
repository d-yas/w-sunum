/**
 * Light and gradient washes.
 *
 * Every bloom here is built from radial gradient stops, never from a blur.
 * That is deliberate: the PNG export serialises the card into a
 * <foreignObject> and rasterises it through an <img>, and CSS blur and
 * backdrop-filter are unreliable on that path. Gradient stops always survive.
 */
import { num, round, str, type AssetDef } from "./types";

const CORNERS = [
  { value: "sol-ust", label: "Sol üst" },
  { value: "sag-ust", label: "Sağ üst" },
  { value: "sol-alt", label: "Sol alt" },
  { value: "sag-alt", label: "Sağ alt" },
];

const CORNER_XY: Record<string, [number, number]> = {
  "sol-ust": [0, 0],
  "sag-ust": [1, 0],
  "sol-alt": [0, 1],
  "sag-alt": [1, 1],
};

/**
 * A soft orb: three stops rather than two. A plain two-stop radial has a
 * visible edge where it lands on the card; easing the middle stop down to a
 * third of the strength is what makes it read as light instead of as a disc.
 */
function Orb({ id, cx, cy, r, color, strength }: { id: string; cx: number; cy: number; r: number; color: string; strength: number }) {
  return (
    <radialGradient id={id} cx={round(cx, 4)} cy={round(cy, 4)} r={round(r, 4)}>
      <stop offset="0" stopColor={color} stopOpacity={round(strength, 3)} />
      <stop offset="0.45" stopColor={color} stopOpacity={round(strength * 0.35, 3)} />
      <stop offset="1" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
}

function Cover({ uid, w, h }: { uid: string; w: number; h: number }) {
  return <rect width={w} height={h} fill={`url(#${uid}-g)`} />;
}

export const LIGHTS: AssetDef[] = [
  {
    id: "isik/kose",
    label: "Köşe ışığı",
    family: "isik",
    kind: "zemin",
    opacity: 0.9,
    params: [
      { type: "secim", key: "kose", label: "Köşe", options: CORNERS, def: "sag-ust" },
      { type: "sayi", key: "yayilim", label: "Yayılım", min: 0.2, max: 1.6, step: 0.05, def: 0.85 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.45 },
    ],
    render({ uid, w, h, color, p }) {
      const [cx, cy] = CORNER_XY[str(p, "kose", "sag-ust")] ?? [1, 0];
      return (
        <>
          <defs>
            <Orb id={`${uid}-g`} cx={cx} cy={cy} r={num(p, "yayilim", 0.85)} color={color} strength={num(p, "siddet", 0.45)} />
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/kure",
    label: "Yumuşak küre",
    family: "isik",
    kind: "zemin",
    opacity: 0.9,
    params: [
      { type: "sayi", key: "x", label: "Yatay", min: 0, max: 100, step: 1, def: 72 },
      { type: "sayi", key: "y", label: "Dikey", min: 0, max: 100, step: 1, def: 30 },
      { type: "sayi", key: "yayilim", label: "Yayılım", min: 0.1, max: 1.2, step: 0.05, def: 0.5 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.5 },
    ],
    render({ uid, w, h, color, p }) {
      return (
        <>
          <defs>
            <Orb
              id={`${uid}-g`}
              cx={num(p, "x", 72) / 100}
              cy={num(p, "y", 30) / 100}
              r={num(p, "yayilim", 0.5)}
              color={color}
              strength={num(p, "siddet", 0.5)}
            />
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/ikiz",
    label: "İkiz leke",
    family: "isik",
    kind: "zemin",
    opacity: 0.9,
    twoTone: true,
    params: [
      { type: "sayi", key: "ayrik", label: "Ayrıklık", min: 0, max: 100, step: 1, def: 55 },
      { type: "sayi", key: "yayilim", label: "Yayılım", min: 0.15, max: 1.2, step: 0.05, def: 0.55 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.5 },
      { type: "sayi", key: "aci", label: "Eksen açısı", min: 0, max: 180, step: 5, def: 25 },
    ],
    render({ uid, w, h, color, color2, p }) {
      const d = num(p, "ayrik", 55) / 200;
      const a = (num(p, "aci", 25) * Math.PI) / 180;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const r = num(p, "yayilim", 0.55);
      const s = num(p, "siddet", 0.5);
      return (
        <>
          <defs>
            <Orb id={`${uid}-a`} cx={0.5 - dx} cy={0.5 - dy} r={r} color={color} strength={s} />
            <Orb id={`${uid}-b`} cx={0.5 + dx} cy={0.5 + dy} r={r} color={color2} strength={s} />
          </defs>
          <rect width={w} height={h} fill={`url(#${uid}-a)`} />
          <rect width={w} height={h} fill={`url(#${uid}-b)`} />
        </>
      );
    },
  },
  {
    id: "isik/mesh",
    label: "Mesh",
    family: "isik",
    kind: "zemin",
    opacity: 0.85,
    twoTone: true,
    params: [
      { type: "sayi", key: "yayilim", label: "Yayılım", min: 0.2, max: 1.2, step: 0.05, def: 0.62 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.4 },
      { type: "sayi", key: "kayma", label: "Kayma", min: 0, max: 40, step: 1, def: 16 },
    ],
    render({ uid, w, h, color, color2, p }) {
      const r = num(p, "yayilim", 0.62);
      const s = num(p, "siddet", 0.4);
      const k = num(p, "kayma", 16) / 100;
      // Four orbs on alternating corners — the cheapest thing that reads as a
      // mesh gradient without a mesh gradient, which SVG does not have.
      const spots: [number, number, string][] = [
        [0.1 + k, 0.12, color],
        [0.9 - k, 0.2, color2],
        [0.18, 0.88 - k, color2],
        [0.82, 0.9, color],
      ];
      return (
        <>
          <defs>
            {spots.map(([cx, cy, c], i) => (
              <Orb key={i} id={`${uid}-g${i}`} cx={cx} cy={cy} r={r} color={c} strength={s} />
            ))}
          </defs>
          {spots.map((_, i) => (
            <rect key={i} width={w} height={h} fill={`url(#${uid}-g${i})`} />
          ))}
        </>
      );
    },
  },
  {
    id: "isik/spot",
    label: "Spot konisi",
    family: "isik",
    kind: "zemin",
    opacity: 0.8,
    params: [
      { type: "sayi", key: "x", label: "Kaynak yatay", min: 0, max: 100, step: 1, def: 28 },
      { type: "sayi", key: "genislik", label: "Taban genişliği", min: 10, max: 200, step: 5, def: 90 },
      { type: "sayi", key: "agiz", label: "Ağız genişliği", min: 0, max: 60, step: 2, def: 12 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.35 },
    ],
    render({ uid, w, h, color, p }) {
      const x = (num(p, "x", 28) / 100) * w;
      const half = (num(p, "genislik", 90) / 200) * w;
      const mouth = (num(p, "agiz", 12) / 200) * w;
      const s = num(p, "siddet", 0.35);
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={round(s, 3)} />
              <stop offset="0.55" stopColor={color} stopOpacity={round(s * 0.35, 3)} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={`M${round(x - mouth)} 0H${round(x + mouth)}L${round(x + half)} ${round(h)}H${round(x - half)}Z`}
            fill={`url(#${uid}-g)`}
          />
        </>
      );
    },
  },
  {
    id: "isik/vinyet",
    label: "Vinyet",
    family: "isik",
    kind: "zemin",
    opacity: 1,
    tone: "murekkep",
    params: [
      { type: "sayi", key: "ic", label: "Temiz alan", min: 0.1, max: 0.95, step: 0.05, def: 0.55 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.02, max: 0.8, step: 0.02, def: 0.22 },
    ],
    render({ uid, w, h, color, p }) {
      const inner = num(p, "ic", 0.55);
      return (
        <>
          <defs>
            <radialGradient id={`${uid}-g`} cx="0.5" cy="0.5" r="0.78">
              <stop offset="0" stopColor={color} stopOpacity={0} />
              <stop offset={round(inner, 3)} stopColor={color} stopOpacity={0} />
              <stop offset="1" stopColor={color} stopOpacity={round(num(p, "siddet", 0.22), 3)} />
            </radialGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/ufuk",
    label: "Ufuk parlaması",
    family: "isik",
    kind: "zemin",
    opacity: 0.9,
    params: [
      { type: "secim", key: "kenar", label: "Kenar", options: [
        { value: "alt", label: "Alt" },
        { value: "ust", label: "Üst" },
        { value: "sol", label: "Sol" },
        { value: "sag", label: "Sağ" },
      ], def: "alt" },
      { type: "sayi", key: "yukseklik", label: "Yükseklik", min: 5, max: 100, step: 1, def: 45 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.4 },
    ],
    render({ uid, w, h, color, p }) {
      const edge = str(p, "kenar", "alt");
      const reach = num(p, "yukseklik", 45) / 100;
      const s = num(p, "siddet", 0.4);
      const axis = ({ alt: [0, 1, 0, 0], ust: [0, 0, 0, 1], sol: [0, 0, 1, 0], sag: [1, 0, 0, 0] } as Record<string, number[]>)[edge] ?? [0, 1, 0, 0];
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1={axis[0]} y1={axis[1]} x2={axis[2]} y2={axis[3]}>
              <stop offset="0" stopColor={color} stopOpacity={round(s, 3)} />
              <stop offset={round(reach * 0.5, 3)} stopColor={color} stopOpacity={round(s * 0.3, 3)} />
              <stop offset={round(reach, 3)} stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/dalgalar",
    label: "Halka dalgaları",
    family: "isik",
    kind: "zemin",
    opacity: 0.7,
    params: [
      { type: "sayi", key: "x", label: "Merkez yatay", min: -20, max: 120, step: 1, def: 84 },
      { type: "sayi", key: "y", label: "Merkez dikey", min: -20, max: 120, step: 1, def: 18 },
      { type: "sayi", key: "sayi", label: "Halka sayısı", min: 2, max: 24, step: 1, def: 9 },
      { type: "sayi", key: "aralik", label: "Aralık", min: 8, max: 120, step: 2, def: 42 },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.25, max: 6, step: 0.25, def: 1.25 },
    ],
    render({ w, h, color, p }) {
      const cx = (num(p, "x", 84) / 100) * w;
      const cy = (num(p, "y", 18) / 100) * h;
      const n = Math.round(num(p, "sayi", 9));
      const gap = num(p, "aralik", 42);
      return (
        <g fill="none" stroke={color} strokeWidth={num(p, "kalinlik", 1.25)}>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={round(cx)} cy={round(cy)} r={round(gap * (i + 1))} opacity={round(1 - i / n, 3)} />
          ))}
        </g>
      );
    },
  },
  {
    id: "isik/dogrusal",
    label: "Doğrusal gradyan",
    family: "isik",
    kind: "zemin",
    opacity: 0.5,
    twoTone: true,
    params: [
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 360, step: 5, def: 135 },
      { type: "sayi", key: "bas", label: "Baş yoğunluk", min: 0, max: 1, step: 0.05, def: 0.9 },
      { type: "sayi", key: "son", label: "Son yoğunluk", min: 0, max: 1, step: 0.05, def: 0 },
    ],
    render({ uid, w, h, color, color2, p }) {
      const a = (num(p, "aci", 135) * Math.PI) / 180;
      const dx = Math.cos(a) / 2;
      const dy = Math.sin(a) / 2;
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1={round(0.5 - dx, 4)} y1={round(0.5 - dy, 4)} x2={round(0.5 + dx, 4)} y2={round(0.5 + dy, 4)}>
              <stop offset="0" stopColor={color} stopOpacity={round(num(p, "bas", 0.9), 3)} />
              <stop offset="1" stopColor={color2} stopOpacity={round(num(p, "son", 0), 3)} />
            </linearGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/radyal",
    label: "Radyal gradyan",
    family: "isik",
    kind: "zemin",
    opacity: 0.5,
    twoTone: true,
    params: [
      { type: "sayi", key: "x", label: "Yatay", min: 0, max: 100, step: 1, def: 50 },
      { type: "sayi", key: "y", label: "Dikey", min: 0, max: 100, step: 1, def: 50 },
      { type: "sayi", key: "yaricap", label: "Yarıçap", min: 0.1, max: 1.6, step: 0.05, def: 0.75 },
      { type: "sayi", key: "ic", label: "İç yoğunluk", min: 0, max: 1, step: 0.05, def: 0.9 },
      { type: "sayi", key: "dis", label: "Dış yoğunluk", min: 0, max: 1, step: 0.05, def: 0 },
    ],
    render({ uid, w, h, color, color2, p }) {
      return (
        <>
          <defs>
            <radialGradient
              id={`${uid}-g`}
              cx={round(num(p, "x", 50) / 100, 4)}
              cy={round(num(p, "y", 50) / 100, 4)}
              r={round(num(p, "yaricap", 0.75), 4)}
            >
              <stop offset="0" stopColor={color} stopOpacity={round(num(p, "ic", 0.9), 3)} />
              <stop offset="1" stopColor={color2} stopOpacity={round(num(p, "dis", 0), 3)} />
            </radialGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/duotone",
    label: "Duotone",
    family: "isik",
    kind: "zemin",
    opacity: 0.28,
    twoTone: true,
    params: [
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 360, step: 5, def: 160 },
      { type: "sayi", key: "orta", label: "Geçiş noktası", min: 0, max: 100, step: 1, def: 50 },
    ],
    render({ uid, w, h, color, color2, p }) {
      const a = (num(p, "aci", 160) * Math.PI) / 180;
      const dx = Math.cos(a) / 2;
      const dy = Math.sin(a) / 2;
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1={round(0.5 - dx, 4)} y1={round(0.5 - dy, 4)} x2={round(0.5 + dx, 4)} y2={round(0.5 + dy, 4)}>
              <stop offset="0" stopColor={color} />
              <stop offset={round(num(p, "orta", 50) / 100, 3)} stopColor={color} />
              <stop offset={round(num(p, "orta", 50) / 100 + 0.001, 3)} stopColor={color2} />
              <stop offset="1" stopColor={color2} />
            </linearGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
  {
    id: "isik/bant",
    label: "Bantlı gradyan",
    family: "isik",
    kind: "zemin",
    opacity: 0.4,
    params: [
      { type: "sayi", key: "aci", label: "Açı", min: 0, max: 360, step: 5, def: 90 },
      { type: "sayi", key: "adet", label: "Bant sayısı", min: 2, max: 16, step: 1, def: 6 },
      { type: "sayi", key: "siddet", label: "Şiddet", min: 0.05, max: 1, step: 0.05, def: 0.7 },
    ],
    render({ uid, w, h, color, p }) {
      const a = (num(p, "aci", 90) * Math.PI) / 180;
      const dx = Math.cos(a) / 2;
      const dy = Math.sin(a) / 2;
      const n = Math.round(num(p, "adet", 6));
      const s = num(p, "siddet", 0.7);
      // Hard stop pairs — a stepped ramp, the retro-print look, instead of the
      // smooth one every other gradient here already gives you.
      const stops: { o: number; a: number }[] = [];
      for (let i = 0; i < n; i++) {
        const level = s * (1 - i / n);
        stops.push({ o: i / n, a: level }, { o: (i + 1) / n, a: level });
      }
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-g`} x1={round(0.5 - dx, 4)} y1={round(0.5 - dy, 4)} x2={round(0.5 + dx, 4)} y2={round(0.5 + dy, 4)}>
              {stops.map((st, i) => (
                <stop key={i} offset={round(st.o, 4)} stopColor={color} stopOpacity={round(st.a, 3)} />
              ))}
            </linearGradient>
          </defs>
          <Cover uid={uid} w={w} h={h} />
        </>
      );
    },
  },
];
