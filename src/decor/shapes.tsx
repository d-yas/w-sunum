/**
 * Şekiller — kare, daire, üçgen ve arkadaşları.
 *
 * Diğer ailelerden farkı, hiçbirinin bir anlamı olmaması: ok "şuraya bak",
 * balon "şunu söylüyor" der, şekil hiçbir şey demez. Bir alanı boyamak, bir
 * bloğun arkasına renk koymak, iki şeyi bir çerçeveye almak için var.
 *
 * Hepsi tek bir dolgu/çizgi anahtarını paylaşıyor: aynı kare hem dolu bir
 * blok hem ince bir çerçeve olabilsin diye. Çizgi rengi ikinci renkten gelir,
 * yani "gri dolgu + koyu kenar" tek nesneyle kurulabiliyor.
 */
import { num, round, str, type AssetCtx, type AssetDef, type ParamDef } from "./types";

/** Dolgu ve kenarı üç şıkka indiren ortak anahtar. */
const BICEM: ParamDef = {
  type: "secim",
  key: "bicem",
  label: "Biçem",
  options: [
    { value: "dolu", label: "Dolu" },
    { value: "cizgi", label: "Yalnız kenar" },
    { value: "ikisi", label: "Dolu + kenar" },
  ],
  def: "dolu",
};

const KALINLIK: ParamDef = { type: "sayi", key: "kalinlik", label: "Kenar kalınlığı", min: 0.5, max: 16, step: 0.5, def: 2 };

/**
 * Bir şeklin boya özellikleri. Kenar şeklin *içine* çiziliyor
 * (`paintOrder`/yarım kalınlık payı değil, kutu küçültülerek): kutunun kendisi
 * kullanıcının sürüklediği şey, kenar onun dışına taşarsa tutamaçla çizim
 * birbirini tutmuyor.
 */
function boya({ p, color, color2 }: Pick<AssetCtx, "p" | "color" | "color2">) {
  const bicem = str(p, "bicem", "dolu");
  const kalinlik = num(p, "kalinlik", 2);
  const cizgi = bicem === "dolu" ? 0 : kalinlik;
  return {
    fill: bicem === "cizgi" ? "none" : color,
    stroke: bicem === "dolu" ? "none" : color2 || color,
    strokeWidth: cizgi,
    /** Kenarın kutunun içinde kalması için her yönden yenen pay. */
    pay: cizgi / 2,
  };
}

/** Köşeleri bir çokgenin `points` dizesine çevirir. */
function noktalar(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
}

/** Merkezi (cx, cy) olan düzgün çokgen; ilk köşe yukarıda. */
function duzgun(cx: number, cy: number, rx: number, ry: number, n: number, faz = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = faz + (i * 2 * Math.PI) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as [number, number];
  });
}

export const SHAPES: AssetDef[] = [
  {
    id: "sekil/dikdortgen",
    label: "Dikdörtgen",
    family: "sekil",
    kind: "nesne",
    size: { w: 220, h: 120 },
    twoTone: true,
    opacity: 0.85,
    params: [
      BICEM,
      KALINLIK,
      { type: "sayi", key: "kose", label: "Köşe yarıçapı", min: 0, max: 80, step: 1, def: 0 },
    ],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const r = Math.min(num(p, "kose", 0), Math.min(w, h) / 2 - b.pay);
      return (
        <rect
          x={round(b.pay)}
          y={round(b.pay)}
          width={round(w - b.pay * 2)}
          height={round(h - b.pay * 2)}
          rx={round(Math.max(0, r))}
          fill={b.fill}
          stroke={b.stroke}
          strokeWidth={b.strokeWidth}
        />
      );
    },
  },
  {
    id: "sekil/kare",
    label: "Kare",
    family: "sekil",
    kind: "nesne",
    size: { w: 140, h: 140 },
    square: true,
    twoTone: true,
    opacity: 0.85,
    params: [
      BICEM,
      KALINLIK,
      { type: "sayi", key: "kose", label: "Köşe yarıçapı", min: 0, max: 70, step: 1, def: 0 },
    ],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const r = Math.min(num(p, "kose", 0), Math.min(w, h) / 2 - b.pay);
      return (
        <rect
          x={round(b.pay)}
          y={round(b.pay)}
          width={round(w - b.pay * 2)}
          height={round(h - b.pay * 2)}
          rx={round(Math.max(0, r))}
          fill={b.fill}
          stroke={b.stroke}
          strokeWidth={b.strokeWidth}
        />
      );
    },
  },
  {
    id: "sekil/hap",
    label: "Hap",
    family: "sekil",
    kind: "nesne",
    size: { w: 200, h: 72 },
    twoTone: true,
    opacity: 0.85,
    params: [BICEM, KALINLIK],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      return (
        <rect
          x={round(b.pay)}
          y={round(b.pay)}
          width={round(w - b.pay * 2)}
          height={round(h - b.pay * 2)}
          rx={round((h - b.pay * 2) / 2)}
          fill={b.fill}
          stroke={b.stroke}
          strokeWidth={b.strokeWidth}
        />
      );
    },
  },
  {
    id: "sekil/daire",
    label: "Daire",
    family: "sekil",
    kind: "nesne",
    size: { w: 140, h: 140 },
    square: true,
    twoTone: true,
    opacity: 0.85,
    params: [BICEM, KALINLIK],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      return (
        <ellipse
          cx={round(w / 2)}
          cy={round(h / 2)}
          rx={round(Math.max(0, w / 2 - b.pay))}
          ry={round(Math.max(0, h / 2 - b.pay))}
          fill={b.fill}
          stroke={b.stroke}
          strokeWidth={b.strokeWidth}
        />
      );
    },
  },
  {
    id: "sekil/elips",
    label: "Elips",
    family: "sekil",
    kind: "nesne",
    size: { w: 220, h: 130 },
    twoTone: true,
    opacity: 0.85,
    params: [BICEM, KALINLIK],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      return (
        <ellipse
          cx={round(w / 2)}
          cy={round(h / 2)}
          rx={round(Math.max(0, w / 2 - b.pay))}
          ry={round(Math.max(0, h / 2 - b.pay))}
          fill={b.fill}
          stroke={b.stroke}
          strokeWidth={b.strokeWidth}
        />
      );
    },
  },
  {
    id: "sekil/ucgen",
    label: "Üçgen",
    family: "sekil",
    kind: "nesne",
    size: { w: 150, h: 130 },
    twoTone: true,
    opacity: 0.85,
    params: [
      BICEM,
      KALINLIK,
      {
        type: "secim",
        key: "yon",
        label: "Yön",
        options: [
          { value: "yukari", label: "Yukarı" },
          { value: "asagi", label: "Aşağı" },
          { value: "sol", label: "Sol" },
          { value: "sag", label: "Sağ" },
        ],
        def: "yukari",
      },
    ],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const x0 = b.pay;
      const y0 = b.pay;
      const x1 = w - b.pay;
      const y1 = h - b.pay;
      const yon = str(p, "yon", "yukari");
      const pts: [number, number][] =
        yon === "asagi"
          ? [
              [x0, y0],
              [x1, y0],
              [(x0 + x1) / 2, y1],
            ]
          : yon === "sol"
            ? [
                [x0, (y0 + y1) / 2],
                [x1, y0],
                [x1, y1],
              ]
            : yon === "sag"
              ? [
                  [x1, (y0 + y1) / 2],
                  [x0, y0],
                  [x0, y1],
                ]
              : [
                  [(x0 + x1) / 2, y0],
                  [x1, y1],
                  [x0, y1],
                ];
      return <polygon points={noktalar(pts)} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeLinejoin="round" />;
    },
  },
  {
    id: "sekil/baklava",
    label: "Baklava",
    family: "sekil",
    kind: "nesne",
    size: { w: 140, h: 140 },
    twoTone: true,
    opacity: 0.85,
    params: [BICEM, KALINLIK],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const pts: [number, number][] = [
        [w / 2, b.pay],
        [w - b.pay, h / 2],
        [w / 2, h - b.pay],
        [b.pay, h / 2],
      ];
      return <polygon points={noktalar(pts)} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeLinejoin="round" />;
    },
  },
  {
    id: "sekil/cokgen",
    label: "Çokgen",
    family: "sekil",
    kind: "nesne",
    size: { w: 140, h: 140 },
    square: true,
    twoTone: true,
    opacity: 0.85,
    params: [
      BICEM,
      KALINLIK,
      { type: "sayi", key: "kenar", label: "Kenar sayısı", min: 3, max: 12, step: 1, def: 6 },
    ],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const n = Math.max(3, Math.round(num(p, "kenar", 6)));
      const pts = duzgun(w / 2, h / 2, Math.max(0, w / 2 - b.pay), Math.max(0, h / 2 - b.pay), n);
      return <polygon points={noktalar(pts)} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeLinejoin="round" />;
    },
  },
  {
    id: "sekil/yildiz",
    label: "Yıldız",
    family: "sekil",
    kind: "nesne",
    size: { w: 140, h: 140 },
    square: true,
    twoTone: true,
    opacity: 0.9,
    params: [
      BICEM,
      KALINLIK,
      { type: "sayi", key: "uc", label: "Uç sayısı", min: 3, max: 12, step: 1, def: 5 },
      { type: "sayi", key: "ic", label: "İç yarıçap", min: 0.15, max: 0.9, step: 0.05, def: 0.4 },
    ],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const n = Math.max(3, Math.round(num(p, "uc", 5)));
      const k = num(p, "ic", 0.4);
      const rx = Math.max(0, w / 2 - b.pay);
      const ry = Math.max(0, h / 2 - b.pay);
      const dis = duzgun(w / 2, h / 2, rx, ry, n);
      const ic = duzgun(w / 2, h / 2, rx * k, ry * k, n, -Math.PI / 2 + Math.PI / n);
      const pts = dis.flatMap((d, i) => [d, ic[i]]);
      return <polygon points={noktalar(pts)} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeLinejoin="round" />;
    },
  },
  {
    id: "sekil/arti",
    label: "Artı",
    family: "sekil",
    kind: "nesne",
    size: { w: 120, h: 120 },
    square: true,
    twoTone: true,
    opacity: 0.9,
    params: [BICEM, KALINLIK, { type: "sayi", key: "kol", label: "Kol kalınlığı", min: 0.1, max: 0.8, step: 0.05, def: 0.34 }],
    render({ w, h, p, color, color2 }) {
      const b = boya({ p, color, color2 });
      const t = num(p, "kol", 0.34);
      const kw = (w - b.pay * 2) * t;
      const kh = (h - b.pay * 2) * t;
      const x0 = b.pay;
      const y0 = b.pay;
      const x1 = w - b.pay;
      const y1 = h - b.pay;
      const cx0 = (w - kw) / 2;
      const cx1 = (w + kw) / 2;
      const cy0 = (h - kh) / 2;
      const cy1 = (h + kh) / 2;
      const pts: [number, number][] = [
        [cx0, y0],
        [cx1, y0],
        [cx1, cy0],
        [x1, cy0],
        [x1, cy1],
        [cx1, cy1],
        [cx1, y1],
        [cx0, y1],
        [cx0, cy1],
        [x0, cy1],
        [x0, cy0],
        [cx0, cy0],
      ];
      return <polygon points={noktalar(pts)} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeLinejoin="round" />;
    },
  },
  {
    id: "sekil/cizgi",
    label: "Çizgi",
    family: "sekil",
    kind: "nesne",
    size: { w: 240, h: 24 },
    params: [
      { type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 24, step: 0.5, def: 3 },
      {
        type: "secim",
        key: "desen",
        label: "Desen",
        options: [
          { value: "duz", label: "Düz" },
          { value: "kesik", label: "Kesik" },
          { value: "nokta", label: "Noktalı" },
        ],
        def: "duz",
      },
    ],
    render({ w, h, p, color }) {
      const k = num(p, "kalinlik", 3);
      const desen = str(p, "desen", "duz");
      const dash = desen === "kesik" ? `${round(k * 3)} ${round(k * 2.2)}` : desen === "nokta" ? `0.01 ${round(k * 2)}` : undefined;
      return (
        <line
          x1={0}
          y1={round(h / 2)}
          x2={round(w)}
          y2={round(h / 2)}
          stroke={color}
          strokeWidth={k}
          strokeLinecap={desen === "nokta" ? "round" : "butt"}
          strokeDasharray={dash}
        />
      );
    },
  },
];
