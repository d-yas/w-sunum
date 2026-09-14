import { emptyDecor, emptyLayout, type CardLayout, type DecorState } from "@/decor/model";

import type { Palette } from "./palettes";

import { DEFAULT_FORMAT, type DateGranularity, type NumberFormatSpec } from "./format";

export type ChartKind = "line" | "area" | "bar" | "barH" | "ring" | "heatmap" | "sankey";
export type Theme = "light" | "dark";
export type CurveKind = "linear" | "monotone" | "step" | "natural";
export type XMode = "auto" | "category" | "date";
export type LegendPosition = "bottom" | "right" | "top";

/** Raw table as typed by the user — strings, parsed at render time. */
export interface TableData {
  columns: string[];
  rows: string[][];
}

export interface ChartOptions {
  legend: boolean;
  legendValues: boolean;
  legendPosition: LegendPosition;
  grid: boolean;
  gridVertical: boolean;
  xAxis: boolean;
  yAxis: boolean;
  yTicks: number;
  yMin: number | null;
  yMax: number | null;
  stacked: boolean;
  barWidth: number | null;
  barGap: number;
  curve: CurveKind;
  showMarkers: boolean;
  strokeWidth: number;
  areaOpacity: number;
  xMode: XMode;
  dateGranularity: DateGranularity;
  ringStroke: number;
  ringGap: number;
  ringCenter: boolean;
  ringCenterLabel: string;
  ringShare: boolean;
  heatmapWeekStart: 0 | 1;
  heatmapLegend: boolean;
  sankeyNodeWidth: number;
  sankeyNodePadding: number;
  sankeyUnit: string;
  sankeyValueLabels: boolean;
  format: NumberFormatSpec;
  animate: boolean;
  /** Tooltips and hover highlighting on the live card. Exports never hover. */
  hover: boolean;
  width: number;
  height: number;
  padding: number;
  titleSize: number;
  chartInset: number;
}

export interface ChartSpec {
  id: string;
  name: string;
  kind: ChartKind;
  title: string;
  subtitle: string;
  note: string;
  data: TableData;
  paletteId: string;
  colors: string[];
  options: ChartOptions;
  /** Textures, lights, frames and placed objects — see src/decor. */
  decor: DecorState;
  /** Hand-placed boxes for the card's own title, chart and note. */
  yerlesim: CardLayout;
}

export type ExportBackground = "theme" | "transparent";

export interface Workspace {
  version: 1;
  theme: Theme;
  activeId: string;
  charts: ChartSpec[];
  /** User-defined palettes, offered alongside the built-in four. */
  palettes: Palette[];
  export: { scale: 1 | 2 | 3 | 4; background: ExportBackground };
}

export const KIND_LABELS: Record<ChartKind, string> = {
  line: "Çizgi",
  area: "Alan",
  bar: "Sütun",
  barH: "Yatay çubuk",
  ring: "Halka",
  heatmap: "Isı takvimi",
  sankey: "Akış (Sankey)",
};

export const DEFAULT_OPTIONS: ChartOptions = {
  legend: true,
  legendValues: false,
  legendPosition: "bottom",
  grid: true,
  gridVertical: false,
  xAxis: true,
  yAxis: true,
  yTicks: 5,
  yMin: null,
  yMax: null,
  stacked: false,
  barWidth: null,
  barGap: 0.35,
  curve: "monotone",
  showMarkers: false,
  strokeWidth: 2,
  areaOpacity: 0.25,
  xMode: "auto",
  dateGranularity: "auto",
  ringStroke: 16,
  ringGap: 6,
  ringCenter: true,
  ringCenterLabel: "Toplam",
  ringShare: true,
  heatmapWeekStart: 1,
  heatmapLegend: true,
  sankeyNodeWidth: 16,
  sankeyNodePadding: 24,
  sankeyUnit: "",
  sankeyValueLabels: true,
  format: DEFAULT_FORMAT,
  animate: true,
  hover: true,
  width: 960,
  height: 540,
  padding: 32,
  titleSize: 22,
  chartInset: 8,
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/* ------------------------------------------------------------------ */
/* Sample data per chart kind                                           */
/* ------------------------------------------------------------------ */

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function sampleData(kind: ChartKind): TableData {
  switch (kind) {
    case "line":
    case "area":
      return {
        columns: ["Ay", "Gelir", "Gider"],
        rows: MONTHS.map((m, i) => [
          `${m} 2025`,
          String(Math.round(120 + i * 9 + Math.sin(i / 1.7) * 18)),
          String(Math.round(90 + i * 5 + Math.cos(i / 2.1) * 12)),
        ]),
      };
    case "bar":
      return {
        columns: ["Çeyrek", "Ürün A", "Ürün B", "Ürün C"],
        rows: [
          ["Ç1 2025", "420", "310", "180"],
          ["Ç2 2025", "465", "340", "210"],
          ["Ç3 2025", "510", "295", "260"],
          ["Ç4 2025", "580", "360", "300"],
        ],
      };
    case "barH":
      return {
        columns: ["Birim", "Tamamlanan", "Devam eden"],
        rows: [
          ["Satış", "82", "18"],
          ["Pazarlama", "64", "30"],
          ["Operasyon", "71", "12"],
          ["Finans", "90", "6"],
          ["İK", "55", "25"],
        ],
      };
    case "ring":
      return {
        columns: ["Etiket", "Değer", "Hedef"],
        rows: [
          ["Türkiye", "540", ""],
          ["Avrupa", "320", ""],
          ["Orta Doğu", "180", ""],
          ["Diğer", "95", ""],
        ],
      };
    case "heatmap": {
      const rows: string[][] = [];
      const start = new Date(2025, 0, 1);
      for (let i = 0; i < 365; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dow = d.getDay();
        const base = dow === 0 || dow === 6 ? 0.15 : 1;
        const v = Math.random() < 0.18 ? 0 : Math.round(base * (2 + Math.random() * 10));
        rows.push([iso(d), String(v)]);
      }
      return { columns: ["Tarih", "Değer"], rows };
    }
    case "sankey":
      return {
        columns: ["Kaynak", "Hedef", "Değer"],
        rows: [
          ["Web", "Kayıt", "420"],
          ["Mobil", "Kayıt", "310"],
          ["Referans", "Kayıt", "120"],
          ["Kayıt", "Deneme", "560"],
          ["Kayıt", "Ayrıldı", "290"],
          ["Deneme", "Ücretli", "240"],
          ["Deneme", "Ayrıldı", "320"],
        ],
      };
  }
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newChart(kind: ChartKind, index = 1): ChartSpec {
  const titles: Record<ChartKind, [string, string]> = {
    line: ["Aylık gelir ve gider", "2025, bin ₺"],
    area: ["Aylık gelir ve gider", "2025, bin ₺"],
    bar: ["Çeyreklik satış", "Ürün bazında, adet"],
    barH: ["Birim bazında görev durumu", "2025 Ç3 sonu"],
    ring: ["Bölgesel dağılım", "Gelir payı, %"],
    heatmap: ["Günlük aktivite", "2025 takvimi"],
    sankey: ["Kullanıcı akışı", "Kanaldan dönüşüme"],
  };
  const [title, subtitle] = titles[kind];
  return {
    id: uid(),
    name: `${KIND_LABELS[kind]} ${index}`,
    kind,
    title,
    subtitle,
    note: "",
    data: sampleData(kind),
    paletteId: "varsayilan",
    colors: [],
    decor: emptyDecor(),
    yerlesim: emptyLayout(),
    options: {
      ...DEFAULT_OPTIONS,
      legendPosition: kind === "ring" ? "right" : DEFAULT_OPTIONS.legendPosition,
      legendValues: kind === "ring",
      format: { ...DEFAULT_FORMAT },
    },
  };
}

export function defaultWorkspace(): Workspace {
  const first = newChart("bar", 1);
  return {
    version: 1,
    theme: "light",
    activeId: first.id,
    charts: [first],
    palettes: [],
    export: { scale: 2, background: "theme" },
  };
}

/** Column roles per kind — used by the grid header and the adapters. */
export function columnRoles(kind: ChartKind): { fixed: string[]; seriesLabel: string | null } {
  switch (kind) {
    case "ring":
      return { fixed: ["Etiket", "Değer", "Hedef (boş = toplam)"], seriesLabel: null };
    case "heatmap":
      return { fixed: ["Tarih", "Değer"], seriesLabel: null };
    case "sankey":
      return { fixed: ["Kaynak", "Hedef", "Değer"], seriesLabel: null };
    default:
      return { fixed: ["Kategori / Tarih"], seriesLabel: "Seri" };
  }
}

/** When switching chart kind, keep the table if its shape is compatible, otherwise load the sample. */
export function adaptDataForKind(data: TableData, from: ChartKind, to: ChartKind): TableData {
  const cartesian = (k: ChartKind) => k === "line" || k === "area" || k === "bar" || k === "barH";
  if (cartesian(from) && cartesian(to)) return data;
  if (from === to) return data;
  if (cartesian(from) && to === "ring") {
    return {
      columns: ["Etiket", "Değer", "Hedef (boş = toplam)"],
      rows: data.rows.map((r) => [r[0] ?? "", r[1] ?? "", ""]),
    };
  }
  if (from === "ring" && cartesian(to)) {
    return { columns: ["Kategori", "Değer"], rows: data.rows.map((r) => [r[0] ?? "", r[1] ?? ""]) };
  }
  return sampleData(to);
}
