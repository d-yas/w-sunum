/**
 * Arrows.
 *
 * Every arrow draws into the placed box at its real pixel size rather than
 * scaling a fixed original. That is the whole reason a 400×60 arrow and a
 * 90×90 one both look right: a uniform viewBox would squash the stroke and
 * the head along with the geometry.
 *
 * The neutral orientation is left to right. Rotation is the wrapper's job.
 */
import { num, round, str, type AssetDef } from "./types";

const HEAD_STYLES = [
  { value: "dolu", label: "Dolu" },
  { value: "cizgi", label: "Çizgi" },
  { value: "yok", label: "Yok" },
];

/**
 * Arrow head at (x, y) pointing along `ang` radians. Filled heads are a
 * triangle; line heads are a chevron that inherits the shaft's stroke, so
 * the two never disagree about weight.
 */
function Head({ x, y, ang, size, color, width, style }: { x: number; y: number; ang: number; size: number; color: string; width: number; style: string }) {
  if (style === "yok" || size <= 0) return null;
  const back = (spread: number) => {
    const a = ang + Math.PI - spread;
    return [round(x + Math.cos(a) * size), round(y + Math.sin(a) * size)] as const;
  };
  if (style === "cizgi") {
    const [ax, ay] = back(0.46);
    const [bx, by] = back(-0.46);
    return (
      <path
        d={`M${ax} ${ay}L${round(x)} ${round(y)}L${bx} ${by}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  const [ax, ay] = back(0.38);
  const [bx, by] = back(-0.38);
  return <path d={`M${round(x)} ${round(y)}L${ax} ${ay}L${bx} ${by}Z`} fill={color} />;
}

const END_STYLES = [
  { value: "yok", label: "Yok" },
  { value: "ok", label: "Ok" },
  { value: "cizgi", label: "Çizgi" },
  { value: "nokta", label: "Nokta" },
];

/**
 * Bağlantının uç süsü. `Head`'in üstüne bir katman: oraya "nokta" eklemek
 * mevcut sekiz okun `ucTipi` seçeneklerini de değiştirirdi.
 */
function Uc({ x, y, ang, size, color, width, style }: { x: number; y: number; ang: number; size: number; color: string; width: number; style: string }) {
  if (style === "yok" || size <= 0) return null;
  if (style === "nokta") return <circle cx={round(x)} cy={round(y)} r={round(size * 0.35)} fill={color} />;
  return <Head x={x} y={y} ang={ang} size={size} color={color} width={width} style={style === "ok" ? "dolu" : "cizgi"} />;
}

/** Pull the shaft back so a filled head does not sit on top of its own line. */
function shorten(x: number, y: number, ang: number, by: number) {
  return [x - Math.cos(ang) * by, y - Math.sin(ang) * by] as const;
}

const SHAFT = {
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const COMMON = [
  { type: "sayi" as const, key: "kalinlik", label: "Kalınlık", min: 0.5, max: 24, step: 0.5, def: 3 },
  { type: "sayi" as const, key: "uc", label: "Uç boyu", min: 0, max: 60, step: 1, def: 16 },
  { type: "secim" as const, key: "ucTipi", label: "Uç tipi", options: HEAD_STYLES, def: "dolu" },
];

interface Geo {
  t: number;
  head: number;
  style: string;
  pad: number;
}

function geo(p: Record<string, number | string>, w: number, h: number): Geo {
  const t = num(p, "kalinlik", 3);
  const head = num(p, "uc", 16);
  const style = str(p, "ucTipi", "dolu");
  return { t, head, style, pad: Math.max(t, head * 0.5, 2) + Math.min(w, h) * 0.02 };
}

export const ARROWS: AssetDef[] = [
  {
    id: "ok/duz",
    label: "Düz",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 60 },
    params: COMMON,
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const y = round(h / 2);
      const tip = w - pad;
      const [ex] = shorten(tip, 0, 0, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          <path d={`M${round(pad)} ${y}H${round(ex)}`} {...SHAFT} stroke={color} strokeWidth={t} />
          <Head x={tip} y={h / 2} ang={0} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/sivrilen",
    label: "Sivrilen",
    family: "ok",
    kind: "nesne",
    size: { w: 240, h: 70 },
    params: [
      { type: "sayi", key: "kalinlik", label: "Taban kalınlığı", min: 1, max: 40, step: 0.5, def: 10 },
      { type: "sayi", key: "uc", label: "Uç boyu", min: 4, max: 90, step: 1, def: 26 },
      { type: "sayi", key: "kuyruk", label: "Kuyruk incelmesi", min: 0, max: 1, step: 0.05, def: 0.85 },
    ],
    render({ w, h, color, p }) {
      const base = num(p, "kalinlik", 10);
      const head = num(p, "uc", 26);
      const taper = num(p, "kuyruk", 0.85);
      const y = h / 2;
      const pad = 2;
      const x1 = w - pad - head;
      const tail = (base / 2) * (1 - taper);
      // One closed path: tail sliver → shaft → head barbs → tip. Drawing the
      // whole silhouette avoids the seam a stroked shaft plus filled head
      // leaves behind at low opacity.
      const d =
        `M${round(pad)} ${round(y - tail)}` +
        `L${round(x1)} ${round(y - base / 2)}` +
        `L${round(x1)} ${round(y - head * 0.62)}` +
        `L${round(w - pad)} ${round(y)}` +
        `L${round(x1)} ${round(y + head * 0.62)}` +
        `L${round(x1)} ${round(y + base / 2)}` +
        `L${round(pad)} ${round(y + tail)}Z`;
      return <path d={d} fill={color} />;
    },
  },
  {
    id: "ok/kesikli",
    label: "Kesikli",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 60 },
    params: [...COMMON, { type: "sayi", key: "cizgi", label: "Çizgi boyu", min: 1, max: 40, step: 1, def: 9 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const dash = num(p, "cizgi", 9);
      const y = round(h / 2);
      const tip = w - pad;
      const [ex] = shorten(tip, 0, 0, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          <path
            d={`M${round(pad)} ${y}H${round(ex)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
            strokeDasharray={`${dash} ${round(dash * 0.8)}`}
          />
          <Head x={tip} y={h / 2} ang={0} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/yay",
    label: "Yay",
    family: "ok",
    kind: "nesne",
    size: { w: 240, h: 120 },
    params: [...COMMON, { type: "sayi", key: "egrilik", label: "Eğrilik", min: -1, max: 1, step: 0.05, def: 0.55 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const bow = num(p, "egrilik", 0.55);
      const y0 = bow >= 0 ? h - pad : pad;
      const span = h - 2 * pad;
      const cy = y0 - bow * 2 * span;
      const p0 = { x: pad, y: y0 };
      const c = { x: w / 2, y: cy };
      const p1 = { x: w - pad, y: y0 };
      const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
      const [ex, ey] = shorten(p1.x, p1.y, ang, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          <path
            d={`M${round(p0.x)} ${round(p0.y)}Q${round(c.x)} ${round(c.y)} ${round(ex)} ${round(ey)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
          />
          <Head x={p1.x} y={p1.y} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/s-egri",
    label: "S eğrisi",
    family: "ok",
    kind: "nesne",
    size: { w: 240, h: 120 },
    params: [...COMMON, { type: "sayi", key: "egrilik", label: "Eğrilik", min: 0.1, max: 1, step: 0.05, def: 0.75 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const k = num(p, "egrilik", 0.75);
      const p0 = { x: pad, y: h - pad };
      const p1 = { x: w - pad, y: pad };
      const c1 = { x: pad + (w - 2 * pad) * k, y: h - pad };
      const c2 = { x: w - pad - (w - 2 * pad) * k, y: pad };
      const ang = Math.atan2(p1.y - c2.y, p1.x - c2.x);
      const [ex, ey] = shorten(p1.x, p1.y, ang, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          <path
            d={`M${round(p0.x)} ${round(p0.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(ex)} ${round(ey)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
          />
          <Head x={p1.x} y={p1.y} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/dirsek",
    label: "Dirsek",
    family: "ok",
    kind: "nesne",
    size: { w: 200, h: 120 },
    params: [...COMMON, { type: "sayi", key: "yuvarlak", label: "Köşe yuvarlaklığı", min: 0, max: 60, step: 1, def: 14 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const r = Math.min(num(p, "yuvarlak", 14), (w - 2 * pad) / 2, (h - 2 * pad) / 2);
      const cx = w - pad;
      const ang = -Math.PI / 2;
      const [, ey] = shorten(cx, pad, ang, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          <path
            d={`M${round(pad)} ${round(h - pad)}H${round(cx - r)}A${round(r)} ${round(r)} 0 0 1 ${round(cx)} ${round(h - pad - r)}V${round(ey)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
          />
          <Head x={cx} y={pad} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/cift",
    label: "Çift başlı",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 60 },
    params: COMMON,
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const y = h / 2;
      const back = style === "dolu" ? head * 0.85 : 0;
      return (
        <>
          <path d={`M${round(pad + back)} ${round(y)}H${round(w - pad - back)}`} {...SHAFT} stroke={color} strokeWidth={t} />
          <Head x={w - pad} y={y} ang={0} size={head} color={color} width={t} style={style} />
          <Head x={pad} y={y} ang={Math.PI} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/dongu",
    label: "Döngü",
    family: "ok",
    kind: "nesne",
    size: { w: 120, h: 120 },
    square: true,
    params: [...COMMON, { type: "sayi", key: "acilik", label: "Açıklık", min: 10, max: 180, step: 5, def: 60 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - pad;
      const gapDeg = num(p, "acilik", 60);
      const a0 = (-90 + gapDeg / 2) * (Math.PI / 180);
      const a1 = (270 - gapDeg / 2) * (Math.PI / 180);
      const at = (a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
      const [sx, sy] = at(a0);
      const [tx, ty] = at(a1);
      // Tangent of a counter-clockwise sweep at the end angle.
      const ang = a1 + Math.PI / 2;
      const back = style === "dolu" ? head * 0.7 : 0;
      const a1b = a1 - back / r;
      const [ex, ey] = at(a1b);
      return (
        <>
          <path
            d={`M${round(sx)} ${round(sy)}A${round(r)} ${round(r)} 0 ${gapDeg > 180 ? 0 : 1} 1 ${round(ex)} ${round(ey)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
          />
          <Head x={tx} y={ty} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/trend-yukari",
    label: "Trend yukarı",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 120 },
    params: [...COMMON, { type: "sayi", key: "basamak", label: "Basamak", min: 2, max: 8, step: 1, def: 4 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const n = Math.round(num(p, "basamak", 4));
      const dx = (w - 2 * pad) / n;
      const dy = (h - 2 * pad) / n;
      const pts: string[] = [];
      for (let i = 0; i <= n; i++) {
        // Every other step dips a little — a flat staircase reads as a chart
        // axis, a jagged one reads as a trend.
        const jitter = i > 0 && i < n && i % 2 === 1 ? dy * 0.35 : 0;
        pts.push(`${round(pad + dx * i)} ${round(h - pad - dy * i + jitter)}`);
      }
      const ang = Math.atan2(-dy, dx);
      const [ex, ey] = shorten(w - pad, pad, ang, style === "dolu" ? head * 0.85 : 0);
      pts[pts.length - 1] = `${round(ex)} ${round(ey)}`;
      return (
        <>
          <path d={`M${pts.join("L")}`} {...SHAFT} stroke={color} strokeWidth={t} />
          <Head x={w - pad} y={pad} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/trend-asagi",
    label: "Trend aşağı",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 120 },
    params: [...COMMON, { type: "sayi", key: "basamak", label: "Basamak", min: 2, max: 8, step: 1, def: 4 }],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const n = Math.round(num(p, "basamak", 4));
      const dx = (w - 2 * pad) / n;
      const dy = (h - 2 * pad) / n;
      const pts: string[] = [];
      for (let i = 0; i <= n; i++) {
        const jitter = i > 0 && i < n && i % 2 === 1 ? -dy * 0.35 : 0;
        pts.push(`${round(pad + dx * i)} ${round(pad + dy * i + jitter)}`);
      }
      const ang = Math.atan2(dy, dx);
      const [ex, ey] = shorten(w - pad, h - pad, ang, style === "dolu" ? head * 0.85 : 0);
      pts[pts.length - 1] = `${round(ex)} ${round(ey)}`;
      return (
        <>
          <path d={`M${pts.join("L")}`} {...SHAFT} stroke={color} strokeWidth={t} />
          <Head x={w - pad} y={h - pad} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/isaretci",
    label: "İşaretçi",
    family: "ok",
    kind: "nesne",
    size: { w: 180, h: 100 },
    params: [
      ...COMMON,
      { type: "sayi", key: "nokta", label: "Kuyruk noktası", min: 0, max: 16, step: 0.5, def: 4 },
      { type: "sayi", key: "egrilik", label: "Eğrilik", min: -1, max: 1, step: 0.05, def: 0.35 },
    ],
    render({ w, h, color, p }) {
      const { t, head, style, pad } = geo(p, w, h);
      const dot = num(p, "nokta", 4);
      const bow = num(p, "egrilik", 0.35);
      const p0 = { x: pad + dot, y: h - pad };
      const p1 = { x: w - pad, y: pad };
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      // Push the control point perpendicular to the chord, so the curve bows
      // the same way no matter how the box is proportioned.
      const nx = -(p1.y - p0.y);
      const ny = p1.x - p0.x;
      const len = Math.hypot(nx, ny) || 1;
      const amp = bow * Math.min(w, h) * 0.5;
      const c = { x: mx + (nx / len) * amp, y: my + (ny / len) * amp };
      const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
      const [ex, ey] = shorten(p1.x, p1.y, ang, style === "dolu" ? head * 0.85 : 0);
      return (
        <>
          {dot > 0 && <circle cx={round(p0.x)} cy={round(p0.y)} r={round(dot)} fill={color} />}
          <path
            d={`M${round(p0.x)} ${round(p0.y)}Q${round(c.x)} ${round(c.y)} ${round(ex)} ${round(ey)}`}
            {...SHAFT}
            stroke={color}
            strokeWidth={t}
          />
          <Head x={p1.x} y={p1.y} ang={ang} size={head} color={color} width={t} style={style} />
        </>
      );
    },
  },
  {
    id: "ok/firca",
    label: "Fırça darbesi",
    family: "ok",
    kind: "nesne",
    size: { w: 260, h: 90 },
    params: [
      { type: "sayi", key: "kalinlik", label: "En kalın", min: 2, max: 50, step: 1, def: 14 },
      { type: "sayi", key: "egrilik", label: "Eğrilik", min: -1, max: 1, step: 0.05, def: 0.4 },
      { type: "sayi", key: "uc", label: "Uç boyu", min: 0, max: 80, step: 1, def: 30 },
    ],
    render({ w, h, color, p }) {
      const thick = num(p, "kalinlik", 14);
      const bow = num(p, "egrilik", 0.4);
      const head = num(p, "uc", 30);
      const pad = 3;
      // Neutral position is the centre of the box: the body runs from y0 down
      // by `thick`, so y0 starts half a thickness high, and the bow moves it
      // from there. Anchoring to h/2 directly would leave a straight stroke
      // sitting low in its own box.
      const span = Math.max(0, h - thick - 2 * pad);
      const y0 = h / 2 - thick / 2 + bow * span * 0.35;
      const cy = y0 - bow * span * 1.4;
      const x0 = pad;
      const x1 = w - pad - head * 0.15;
      const cx = w * 0.45;
      // An outbound edge and a return edge with different thickness offsets —
      // the stroke swells in the middle and dries out at both ends.
      const top = `M${round(x0)} ${round(y0)}Q${round(cx)} ${round(cy)} ${round(x1)} ${round(y0 - thick * 0.1)}`;
      const bottom = `Q${round(cx)} ${round(cy + thick)} ${round(x0)} ${round(y0 + thick * 0.18)}Z`;
      return (
        <>
          <path d={`${top}${bottom}`} fill={color} />
          {head > 0 && (
            <path
              d={`M${round(x1 - head * 0.5)} ${round(y0 - thick * 0.9)}L${round(w - pad)} ${round(y0 + thick * 0.35)}L${round(x1 - head * 0.4)} ${round(y0 + thick * 1.4)}Z`}
              fill={color}
            />
          )}
        </>
      );
    },
  },
  {
    /**
     * Bağlantı — kutu içinde çizilip döndürülen bir ok değil, **iki ucu olan**
     * bir çizgi. Uçlar kutunun yüzdesi olarak duruyor; sahnede her ucun kendi
     * tutamağı var ve uç kaydırılınca kutu iki noktanın sınırlayıcı
     * dikdörtgeni olarak yeniden yazılıyor (`AssetDef.uclar`). Bir veriyi
     * işaret eden açıklama oku ancak böyle kurulabiliyor: "şu çubuktan şu
     * yazıya" demek, bir açı ile bir kutu boyu ayarlamak değil.
     */
    id: "ok/baglanti",
    label: "Bağlantı",
    family: "ok",
    kind: "nesne",
    size: { w: 220, h: 120 },
    uclar: {
      x1: "x1",
      y1: "y1",
      x2: "x2",
      y2: "y2",
      pay: (p) => Math.max(num(p, "kalinlik", 3), num(p, "uc", 14)) / 2 + 4,
    },
    params: [
      { type: "sayi", key: "x1", label: "Baş X", min: -100, max: 200, step: 0.01, def: 0, gizli: true },
      { type: "sayi", key: "y1", label: "Baş Y", min: -100, max: 200, step: 0.01, def: 100, gizli: true },
      { type: "sayi", key: "x2", label: "Son X", min: -100, max: 200, step: 0.01, def: 100, gizli: true },
      { type: "sayi", key: "y2", label: "Son Y", min: -100, max: 200, step: 0.01, def: 0, gizli: true },
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 24, step: 0.5, def: 3 },
      {
        type: "secim",
        key: "stil",
        label: "Çizgi",
        options: [
          { value: "duz", label: "Düz" },
          { value: "kesik", label: "Kesik" },
          { value: "nokta", label: "Noktalı" },
        ],
        def: "duz",
      },
      { type: "secim", key: "bas", label: "Baş ucu", options: END_STYLES, def: "yok" },
      { type: "secim", key: "son", label: "Son ucu", options: END_STYLES, def: "ok" },
      { type: "sayi", key: "uc", label: "Uç boyu", min: 4, max: 40, step: 1, def: 14 },
      { type: "sayi", key: "bukum", label: "Büküm", min: -100, max: 100, step: 5, def: 0 },
    ],
    render({ w, h, color, p }) {
      const t = num(p, "kalinlik", 3);
      const uc = num(p, "uc", 14);
      const ax = (num(p, "x1", 0) / 100) * w;
      const ay = (num(p, "y1", 100) / 100) * h;
      const bx = (num(p, "x2", 100) / 100) * w;
      const by = (num(p, "y2", 0) / 100) * h;
      const dx = bx - ax;
      const dy = by - ay;
      const uzunluk = Math.hypot(dx, dy) || 1;
      // Bükümün kontrol noktası orta noktadan **dike** kaçıyor; yarıçapı
      // uzunluğa oranlı, yani kısa bir bağlantı da uzun bir bağlantı da aynı
      // kavisi gösteriyor.
      const bukum = num(p, "bukum", 0) / 100;
      const cx = (ax + bx) / 2 - (dy / uzunluk) * uzunluk * bukum * 0.5;
      const cy = (ay + by) / 2 + (dx / uzunluk) * uzunluk * bukum * 0.5;
      // Uç açıları kontrol noktasına bakıyor: kavisli bir çizgide ok başı
      // kirişin değil teğetin yönünde durmalı.
      const basAci = Math.atan2(ay - cy, ax - cx);
      const sonAci = Math.atan2(by - cy, bx - cx);
      const basStil = str(p, "bas", "yok");
      const sonStil = str(p, "son", "ok");
      const [sx, sy] = shorten(ax, ay, basAci, basStil === "ok" ? uc * 0.85 : 0);
      const [ex, ey] = shorten(bx, by, sonAci, sonStil === "ok" ? uc * 0.85 : 0);
      const stil = str(p, "stil", "duz");
      const kesik =
        stil === "kesik" ? `${round(t * 3)} ${round(t * 2)}` : stil === "nokta" ? `0.01 ${round(t * 2)}` : undefined;
      const govde = bukum === 0
        ? `M${round(sx)} ${round(sy)}L${round(ex)} ${round(ey)}`
        : `M${round(sx)} ${round(sy)}Q${round(cx)} ${round(cy)} ${round(ex)} ${round(ey)}`;
      return (
        <>
          <path d={govde} {...SHAFT} stroke={color} strokeWidth={t} strokeDasharray={kesik} />
          <Uc x={ax} y={ay} ang={basAci} size={uc} color={color} width={t} style={basStil} />
          <Uc x={bx} y={by} ang={sonAci} size={uc} color={color} width={t} style={sonStil} />
        </>
      );
    },
  },
];
