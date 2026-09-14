/**
 * The icon set: a flat table of path data on a 24×24 grid, stroked in the
 * asset's colour.
 *
 * Data, not code — adding an icon is one line. Stroke width is expressed in
 * grid units and scales with the icon, which is why a 20 px icon and a 120 px
 * one both look like they belong to the same set.
 */
import { circlePath, num, round, type AssetDef } from "./types";

const c = circlePath;

/** Gear teeth, generated once — eight identical spokes are not worth typing. */
const GEAR = (() => {
  const teeth: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const at = (r: number) => `${round(12 + Math.cos(a) * r)} ${round(12 + Math.sin(a) * r)}`;
    teeth.push(`M${at(5.8)}L${at(8.8)}`);
  }
  return [c(12, 12, 3.2), c(12, 12, 6), teeth.join("")];
})();

/** id → [label, path data]. Ids are stable; they end up in saved workspaces. */
const TABLE: Record<string, [string, string[]]> = {
  "trend-yukari": ["Trend yukarı", ["M3 17l6-6 4 4 8-8", "M17 5h4v4"]],
  "trend-asagi": ["Trend aşağı", ["M3 7l6 6 4-4 8 8", "M17 19h4v-4"]],
  hedef: ["Hedef", [c(12, 12, 9), c(12, 12, 5), c(12, 12, 1.4)]],
  uyari: ["Uyarı", ["M12 3.4 2.4 20.2h19.2Z", "M12 9.6v4.2", "M12 16.9v.01"]],
  onay: ["Onay", [c(12, 12, 9), "M8 12.4l2.7 2.7L16 9.6"]],
  carpi: ["Çarpı", [c(12, 12, 9), "M9 9l6 6M15 9l-6 6"]],
  bilgi: ["Bilgi", [c(12, 12, 9), "M12 11.2v5", "M12 7.9v.01"]],
  soru: ["Soru", [c(12, 12, 9), "M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5", "M12 16.9v.01"]],
  arti: ["Artı", [c(12, 12, 9), "M12 8v8M8 12h8"]],
  eksi: ["Eksi", [c(12, 12, 9), "M8 12h8"]],
  ampul: ["Ampul", ["M9.5 18.6h5", "M10.6 21h2.8", "M12 3a5.5 5.5 0 0 0-3.2 10 2.6 2.6 0 0 1 1 2v1.6h4.4V15a2.6 2.6 0 0 1 1-2A5.5 5.5 0 0 0 12 3Z"]],
  disli: ["Dişli", GEAR],
  kullanici: ["Kullanıcı", ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", c(12, 7.5, 4)]],
  kullanicilar: ["Kullanıcılar", ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", c(9, 7, 3.6), "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.3a3.6 3.6 0 0 1 0 7"]],
  lira: ["Türk lirası", ["M10 3.6v15.8c4.3 0 7.7-3.5 7.7-7.8", "M6.3 9.9 14.2 6.6", "M6.3 14 14.2 10.7"]],
  yuzde: ["Yüzde", ["M19 5 5 19", c(7.6, 7.6, 2.4), c(16.4, 16.4, 2.4)]],
  saat: ["Saat", [c(12, 12, 9), "M12 6.8v5.4l3.6 2.1"]],
  takvim: ["Takvim", ["M4 6.6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z", "M4 10h16", "M8.2 3v3.2", "M15.8 3v3.2"]],
  bayrak: ["Bayrak", ["M5.5 21V3.6", "M5.5 3.6h11l-2.1 3.6 2.1 3.6h-11"]],
  bina: ["Bina", ["M4.5 21V6a2 2 0 0 1 2-2h5.5a2 2 0 0 1 2 2v15", "M14 11.5h3.5a2 2 0 0 1 2 2V21", "M3 21h18", "M7.5 8h3M7.5 12h3M7.5 16h3"]],
  kamyon: ["Kamyon", ["M2.5 7.6a1.6 1.6 0 0 1 1.6-1.6H14v10H2.5Z", "M14 10h3.6l2.4 3v3H14Z", c(6.6, 18, 2), c(17, 18, 2)]],
  dunya: ["Dünya", [c(12, 12, 9), "M3 12h18", "M12 3a5 9 0 0 1 0 18a5 9 0 0 1 0-18"]],
  belge: ["Belge", ["M6 3.2h7.2l4.8 4.8V20.8H6Z", "M13.2 3.2V8H18", "M9 13.4h6M9 17h6"]],
  klasor: ["Klasör", ["M3 7.2a2 2 0 0 1 2-2h4l2.2 2.6H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"]],
  veritabani: ["Veritabanı", ["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z", "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"]],
  bulut: ["Bulut", ["M7.2 19a4.6 4.6 0 0 1-.5-9.1 6 6 0 0 1 11.4 1.7A4 4 0 0 1 17.4 19Z"]],
  kalkan: ["Kalkan", ["M12 3l8 3v6c0 4.5-3.2 8.2-8 9.6C7.2 20.2 4 16.5 4 12V6Z", "M9 12.2l2.2 2.2 4.3-4.4"]],
  roket: ["Roket", ["M12 2.5c3.3 2.6 5.2 6.4 5.2 10.3L14 16.5h-4L6.8 12.8c0-3.9 1.9-7.7 5.2-10.3Z", c(12, 9.6, 2), "M9.6 17.2c-1.6 1-2.4 2.6-2.4 4.3 1.9 0 3.4-.7 4.4-2.1", "M14.4 17.2c1.6 1 2.4 2.6 2.4 4.3-1.9 0-3.4-.7-4.4-2.1"]],
  odul: ["Ödül", [c(12, 9, 6), "M9 14.4 7.6 21 12 18.6 16.4 21 15 14.4"]],
  "grafik-sutun": ["Sütun grafik", ["M3 21h18", "M7 21V11M12 21V4.5M17 21v-7"]],
  "grafik-cizgi": ["Çizgi grafik", ["M3.5 20.5V3.5", "M3.5 20.5h17", "M6 16l4.5-4.5L14 15l5.5-7.5"]],
  "grafik-pasta": ["Pasta grafik", ["M12 12V3A9 9 0 1 1 3 12Z", "M12 12V3A9 9 0 0 0 3 12Z"]],
  pin: ["Konum", ["M12 21.2s7-6.4 7-11.2a7 7 0 1 0-14 0c0 4.8 7 11.2 7 11.2Z", c(12, 10, 2.6)]],
  yildiz: ["Yıldız", ["M12 3.4l2.7 5.6 6.1.9-4.4 4.3 1.1 6.1L12 17.4l-5.5 2.9 1.1-6.1L3.2 9.9l6.1-.9Z"]],
  kalp: ["Kalp", ["M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z"]],
  kilit: ["Kilit", ["M5 11h14v10H5Z", "M8.2 11V7.6a3.8 3.8 0 0 1 7.6 0V11"]],
  anahtar: ["Anahtar", [c(7.4, 15.2, 3.6), "M9.9 12.6 20.4 3", "M17.2 6.2l2.2 2.2", "M14.6 8.8l2.2 2.2"]],
  arama: ["Arama", [c(10.5, 10.5, 6.4), "M15.2 15.2 21 21"]],
  huni: ["Huni", ["M3.2 4.2h17.6l-7.1 8.6V21l-3.4-2.2v-6Z"]],
  beyin: ["Beyin", ["M12 5.6a3 3 0 0 0-5.6-1.4 3 3 0 0 0-1.8 5A3 3 0 0 0 6 14.4a3 3 0 0 0 2.8 4.4A3 3 0 0 0 12 17.4Z", "M12 5.6a3 3 0 0 1 5.6-1.4 3 3 0 0 1 1.8 5A3 3 0 0 1 18 14.4a3 3 0 0 1-2.8 4.4A3 3 0 0 1 12 17.4Z"]],
  zincir: ["Bağlantı", ["M10.2 13.6a3.6 3.6 0 0 0 5.2 0l2.8-2.8a3.6 3.6 0 1 0-5.2-5.2l-1.4 1.4", "M13.8 10.4a3.6 3.6 0 0 0-5.2 0l-2.8 2.8a3.6 3.6 0 1 0 5.2 5.2l1.4-1.4"]],
  telefon: ["Telefon", ["M4.6 4h3.8l2 4.8-2.4 1.5a12.4 12.4 0 0 0 5.7 5.7l1.5-2.4 4.8 2v3.8a1.6 1.6 0 0 1-1.7 1.6A16.6 16.6 0 0 1 3 5.7 1.6 1.6 0 0 1 4.6 4Z"]],
  zarf: ["E-posta", ["M3 6h18v12H3Z", "M3 6.8l9 6.2 9-6.2"]],
  yenile: ["Yenile", ["M20.4 12a8.4 8.4 0 1 1-2.5-6", "M20.6 3.6v5.2h-5.2"]],
  indir: ["İndir", ["M12 3.4v11.8", "M7.4 10.6 12 15.2l4.6-4.6", "M4 20h16"]],
  yukle: ["Yükle", ["M12 15.2V3.4", "M7.4 8 12 3.4 16.6 8", "M4 20h16"]],
  sepet: ["Sepet", ["M3 4h2.2l2.4 11.2h10L20 7.2H6", c(9, 19.4, 1.5), c(16.4, 19.4, 1.5)]],
};

export const ICONS: AssetDef[] = Object.entries(TABLE).map(([key, [label, d]]) => ({
  id: `ikon/${key}`,
  label,
  family: "ikon",
  kind: "nesne",
  size: { w: 64, h: 64 },
  square: true,
  params: [{ type: "sayi", key: "kalinlik", label: "Kalınlık", min: 0.5, max: 3.5, step: 0.25, def: 1.7 }],
  render({ w, h, color, p }) {
    const s = Math.min(w, h) / 24;
    return (
      <g
        transform={`translate(${round((w - 24 * s) / 2)} ${round((h - 24 * s) / 2)}) scale(${round(s, 4)})`}
        fill="none"
        stroke={color}
        strokeWidth={num(p, "kalinlik", 1.7)}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {d.map((path, i) => (
          <path key={i} d={path} />
        ))}
      </g>
    );
  },
}));
