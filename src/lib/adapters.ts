import type { HeatmapColumn } from "@/charts/heatmap/heatmap-context";
import type { RingData } from "@/charts/ring-context";
import type { SankeyData } from "@/charts/sankey/sankey-chart";
import type { Locale } from "./format";
import { parseDate, parseNumber } from "./parse";
import type { ChartSpec, SortOrder, TableData } from "./spec";

export interface Series {
  key: string;
  name: string;
  values: (number | null)[];
  total: number;
}

export interface CartesianModel {
  /** Row objects handed to Bklit. `x` is the category string, `date` the Date used by AreaChart. */
  rows: Record<string, unknown>[];
  labels: string[];
  series: Series[];
  xIsDate: boolean;
  dates: Date[];
  spanMs: number;
}

/**
 * Satırları değere göre sırala.
 *
 * Sıralama veri katmanında yapılıyor, çizim katmanında değil: eksen etiketleri,
 * gösterge, değer etiketleri ve ipucu hepsi aynı sıradan okuyor, yani tek bir
 * yerde sıralamak hepsini tutarlı tutuyor. Sıralanan yalnız tek serili
 * grafikler; çok serilide "hangi seriye göre" sorusunun cevabı yok.
 */
export function sortRows<T>(rows: T[], order: SortOrder, valueOf: (row: T) => number): T[] {
  if (order === "none") return rows;
  const sign = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * (valueOf(a) - valueOf(b)));
}

/** Series keys are positional so renamed columns never break lookups. */
export function seriesKey(i: number): string {
  return `s${i}`;
}

export function toCartesian(spec: ChartSpec): CartesianModel {
  const { data, options } = spec;
  const locale = options.format.locale;
  const kept = data.rows.filter((r) => (r[0] ?? "").trim() !== "" || r.slice(1).some((c) => (c ?? "").trim() !== ""));
  // Tek seri + kategorik eksen: sıralamak anlamlı. Tarih ekseninde zaman
  // sırası verinin kendisi, ona dokunulmaz.
  const rows =
    data.columns.length === 2 && options.xMode !== "date"
      ? sortRows(kept, options.sort, (r) => parseNumber(r[1], locale) ?? 0)
      : kept;
  const labels = rows.map((r, i) => (r[0] ?? "").trim() || `#${i + 1}`);

  const parsedDates = labels.map((l) => parseDate(l));
  const allDates = parsedDates.length > 0 && parsedDates.every((d) => d != null);
  const xIsDate = options.xMode === "date" ? allDates : options.xMode === "category" ? false : allDates;

  // Categorical x → evenly spaced synthetic days so the time scale is uniform.
  const dates = xIsDate
    ? (parsedDates as Date[])
    : labels.map((_, i) => new Date(2000, 0, 1 + i));

  const series: Series[] = data.columns.slice(1).map((name, si) => {
    const values = rows.map((r) => parseNumber(r[si + 1], locale));
    return {
      key: seriesKey(si),
      name: name.trim() || `Seri ${si + 1}`,
      values,
      total: values.reduce<number>((a, v) => a + (v ?? 0), 0),
    };
  });

  const modelRows = rows.map((_, i) => {
    const row: Record<string, unknown> = { x: labels[i], date: dates[i] };
    for (const s of series) {
      const v = s.values[i];
      row[s.key] = v == null ? 0 : v;
    }
    return row;
  });

  // AreaChart bisects on time; keep rows sorted when they are real dates.
  if (xIsDate) {
    const order = modelRows.map((_, i) => i).sort((a, b) => dates[a].getTime() - dates[b].getTime());
    return {
      rows: order.map((i) => modelRows[i]),
      labels: order.map((i) => labels[i]),
      series: series.map((s) => ({ ...s, values: order.map((i) => s.values[i]) })),
      xIsDate,
      dates: order.map((i) => dates[i]),
      spanMs: dates.length > 1 ? Math.abs(dates[order[order.length - 1]].getTime() - dates[order[0]].getTime()) : 0,
    };
  }

  return { rows: modelRows, labels, series, xIsDate, dates, spanMs: 0 };
}

export interface RingModel {
  data: RingData[];
  total: number;
}

export function toRing(spec: ChartSpec, colors: string[]): RingModel {
  const locale = spec.options.format.locale;
  const items = spec.data.rows
    .map((r) => ({
      label: (r[0] ?? "").trim(),
      value: parseNumber(r[1], locale),
      target: parseNumber(r[2], locale),
    }))
    .filter((r) => r.label !== "" && r.value != null) as { label: string; value: number; target: number | null }[];
  const total = items.reduce((a, r) => a + r.value, 0);
  return {
    total,
    data: items.map((r, i) => ({
      label: r.label,
      value: r.value,
      maxValue: r.target != null && r.target > 0 ? r.target : spec.options.ringShare ? total || 1 : Math.max(r.value, 1),
      color: colors[i % colors.length],
    })),
  };
}

export interface HeatmapModel {
  columns: HeatmapColumn[];
  max: number;
  count: number;
  start: Date | null;
  end: Date | null;
}

export function toHeatmap(spec: ChartSpec): HeatmapModel {
  const locale = spec.options.format.locale;
  const weekStart = spec.options.heatmapWeekStart;
  const counts = new Map<string, number>();
  let min: Date | null = null;
  let max: Date | null = null;
  let maxVal = 0;
  for (const r of spec.data.rows) {
    const d = parseDate(r[0]);
    const v = parseNumber(r[1], locale);
    if (!d || v == null) continue;
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    counts.set(String(key), (counts.get(String(key)) ?? 0) + v);
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
    if (v > maxVal) maxVal = v;
  }
  if (!min || !max) return { columns: [], max: 0, count: 0, start: null, end: null };

  const start = new Date(min);
  const back = (start.getDay() - weekStart + 7) % 7;
  start.setDate(start.getDate() - back);
  const end = new Date(max);
  const fwd = (weekStart + 6 - end.getDay() + 7) % 7;
  end.setDate(end.getDate() + fwd);

  const columns: HeatmapColumn[] = [];
  const cursor = new Date(start);
  let w = 0;
  while (cursor <= end) {
    const bins = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + d);
      const count = counts.get(String(date.getTime())) ?? 0;
      bins.push({ bin: d, date, count });
    }
    columns.push({ bin: w, bins });
    cursor.setDate(cursor.getDate() + 7);
    w++;
  }
  return { columns, max: maxVal, count: counts.size, start: min, end: max };
}

export interface SankeyModel {
  data: SankeyData;
  nodeNames: string[];
  total: number;
}

export function toSankey(spec: ChartSpec): SankeyModel {
  const locale = spec.options.format.locale;
  const names: string[] = [];
  const index = new Map<string, number>();
  const id = (name: string) => {
    let i = index.get(name);
    if (i == null) {
      i = names.length;
      names.push(name);
      index.set(name, i);
    }
    return i;
  };
  const links: SankeyData["links"] = [];
  const hasIncoming = new Set<number>();
  const hasOutgoing = new Set<number>();
  for (const r of spec.data.rows) {
    const s = (r[0] ?? "").trim();
    const t = (r[1] ?? "").trim();
    const v = parseNumber(r[2], locale);
    if (!s || !t || v == null || v <= 0 || s === t) continue;
    const si = id(s);
    const ti = id(t);
    hasOutgoing.add(si);
    hasIncoming.add(ti);
    links.push({ source: si, target: ti, value: v });
  }
  const nodes: SankeyData["nodes"] = names.map((name, i) => ({
    name,
    category: !hasIncoming.has(i) ? "source" : !hasOutgoing.has(i) ? "outcome" : "landing",
  }));
  const total = links.filter((l) => nodes[l.source as number]?.category === "source").reduce((a, l) => a + l.value, 0);
  return { data: { nodes, links }, nodeNames: names, total };
}

/* ------------------------------------------------------------------ */
/* Kategori + değer — huni, şelale, piktogram, gösterge                 */
/* ------------------------------------------------------------------ */

export interface CategoryItem {
  label: string;
  value: number;
  /** Üçüncü sütun; halka ve göstergede hedef, diğerlerinde yok. */
  target: number | null;
}

export interface CategoryModel {
  items: CategoryItem[];
  total: number;
  max: number;
  min: number;
}

export function toCategoryValue(spec: ChartSpec): CategoryModel {
  const locale = spec.options.format.locale;
  const items: CategoryItem[] = [];
  for (const r of spec.data.rows) {
    const label = (r[0] ?? "").trim();
    const value = parseNumber(r[1], locale);
    if (label === "" || value == null) continue;
    items.push({ label, value, target: parseNumber(r[2], locale) });
  }
  const sorted = sortRows(items, spec.options.sort, (i) => i.value);
  const values = sorted.map((i) => i.value);
  return {
    items: sorted,
    total: values.reduce((a, v) => a + v, 0),
    max: values.length ? Math.max(...values) : 0,
    min: values.length ? Math.min(...values) : 0,
  };
}

/** Şelale adımları: her kalem bir önceki kümülatiften başlar. */
export interface WaterfallStep {
  label: string;
  value: number;
  start: number;
  end: number;
  kind: "increase" | "decrease" | "total";
}

export function toWaterfall(spec: ChartSpec): { steps: WaterfallStep[]; min: number; max: number } {
  const { items } = toCategoryValue(spec);
  const steps: WaterfallStep[] = [];
  let running = 0;
  for (const it of items) {
    const start = running;
    running += it.value;
    steps.push({
      label: it.label,
      value: it.value,
      start,
      end: running,
      kind: it.value >= 0 ? "increase" : "decrease",
    });
  }
  if (spec.options.waterfallTotal && steps.length > 0) {
    steps.push({
      label: spec.options.waterfallTotalLabel || "Toplam",
      value: running,
      start: 0,
      end: running,
      kind: "total",
    });
  }
  let min = 0;
  let max = 0;
  for (const s of steps) {
    min = Math.min(min, s.start, s.end);
    max = Math.max(max, s.start, s.end);
  }
  return { steps, min, max };
}

/* ------------------------------------------------------------------ */
/* Hiyerarşi — ağaç haritası, güneş patlaması, daire yığını            */
/* ------------------------------------------------------------------ */

export interface HierarchyDatum {
  name: string;
  /** Kökten itibaren derinlik 1 = ana grup, 2 = alt grup. */
  value?: number;
  children?: HierarchyDatum[];
}

export interface HierarchyModel {
  root: HierarchyDatum;
  /** Ana grup adları, renk sırasını belirler. */
  groups: string[];
  leaves: number;
  total: number;
}

/**
 * `Ana grup ; Alt grup ; Değer` → iki düzeyli ağaç. Alt grup boşsa ana grup
 * yaprak olur; aynı ana grup hem yaprak hem dal olamayacağı için o durumda
 * ana grup tek çocuklu bir dala dönüşür.
 */
export function toHierarchy(spec: ChartSpec): HierarchyModel {
  const locale = spec.options.format.locale;
  const groups: string[] = [];
  const byGroup = new Map<string, HierarchyDatum[]>();
  let total = 0;
  let leaves = 0;

  for (const r of spec.data.rows) {
    const group = (r[0] ?? "").trim();
    const child = (r[1] ?? "").trim();
    const value = parseNumber(r[2], locale);
    if (group === "" || value == null || value <= 0) continue;
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      groups.push(group);
    }
    byGroup.get(group)!.push({ name: child || group, value });
    total += value;
    leaves++;
  }

  return {
    root: {
      name: "kök",
      children: groups.map((g) => {
        const children = byGroup.get(g)!;
        // Tek isimsiz yaprak: ara düğüm yaratma, doğrudan yaprak yap.
        if (children.length === 1 && children[0].name === g) return { name: g, value: children[0].value };
        return { name: g, children };
      }),
    },
    groups,
    leaves,
    total,
  };
}

/* ------------------------------------------------------------------ */
/* Dağılım — scatter / balon                                            */
/* ------------------------------------------------------------------ */

export interface XYPoint {
  label: string;
  x: number;
  y: number;
  size: number;
  group: string;
}

export interface XYModel {
  points: XYPoint[];
  groups: string[];
  xDomain: [number, number];
  yDomain: [number, number];
  sizeMax: number;
  /** En küçük kareler doğrusu; iki noktadan azsa null. */
  trend: { slope: number; intercept: number; r2: number } | null;
}

export function toXY(spec: ChartSpec): XYModel {
  const locale = spec.options.format.locale;
  const points: XYPoint[] = [];
  const groups: string[] = [];
  for (const r of spec.data.rows) {
    const x = parseNumber(r[1], locale);
    const y = parseNumber(r[2], locale);
    if (x == null || y == null) continue;
    const group = (r[4] ?? "").trim();
    if (group && !groups.includes(group)) groups.push(group);
    points.push({
      label: (r[0] ?? "").trim(),
      x,
      y,
      size: parseNumber(r[3], locale) ?? 1,
      group,
    });
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    points,
    groups: groups.length ? groups : [""],
    xDomain: pad(xs),
    yDomain: pad(ys),
    sizeMax: points.reduce((a, p) => Math.max(a, p.size), 0) || 1,
    trend: regression(points),
  };
}

/** Uçlara %6 pay bırak, tek nokta ya da sabit değer için de bir aralık üret. */
function pad(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const d = Math.abs(lo) * 0.1 || 1;
    lo -= d;
    hi += d;
  } else {
    const d = (hi - lo) * 0.06;
    lo -= d;
    hi += d;
  }
  return [lo, hi];
}

function regression(points: XYPoint[]): XYModel["trend"] {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxy += p.x * p.y;
    sxx += p.x * p.x;
    syy += p.y * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const rDen = Math.sqrt(denom * (n * syy - sy * sy));
  const r = rDen === 0 ? 0 : (n * sxy - sx * sy) / rDen;
  return { slope, intercept, r2: r * r };
}

/* ------------------------------------------------------------------ */
/* İlişki — akor, ağ, yay (aynı Kaynak ; Hedef ; Değer tablosu)         */
/* ------------------------------------------------------------------ */

export interface FlowLink {
  source: number;
  target: number;
  value: number;
}

export interface FlowModel {
  names: string[];
  links: FlowLink[];
  /** Akor için n×n yönlü akış matrisi. */
  matrix: number[][];
  /** Düğüm başına toplam (giren + çıkan). */
  totals: number[];
  maxValue: number;
}

export function toFlow(spec: ChartSpec): FlowModel {
  const locale = spec.options.format.locale;
  const names: string[] = [];
  const index = new Map<string, number>();
  const id = (name: string) => {
    let i = index.get(name);
    if (i == null) {
      i = names.length;
      names.push(name);
      index.set(name, i);
    }
    return i;
  };
  const links: FlowLink[] = [];
  for (const r of spec.data.rows) {
    const s = (r[0] ?? "").trim();
    const t = (r[1] ?? "").trim();
    const v = parseNumber(r[2], locale);
    if (!s || !t || v == null || v <= 0 || s === t) continue;
    links.push({ source: id(s), target: id(t), value: v });
  }
  const n = names.length;
  const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const totals = new Array<number>(n).fill(0);
  let maxValue = 0;
  for (const l of links) {
    matrix[l.source][l.target] += l.value;
    totals[l.source] += l.value;
    totals[l.target] += l.value;
    if (l.value > maxValue) maxValue = l.value;
  }
  return { names, links, matrix, totals, maxValue };
}

/* ------------------------------------------------------------------ */
/* Harita — ülke adı / kod → değer                                      */
/* ------------------------------------------------------------------ */

export interface RegionModel {
  /** world-atlas'ın ISO 3166-1 numeric id'si → değer. */
  byId: Map<string, number>;
  /** Girilen ama haritada karşılığı bulunamayan satırlar. */
  unmatched: string[];
  min: number;
  max: number;
  count: number;
}

export function toRegion(spec: ChartSpec, resolve: (key: string) => string | null): RegionModel {
  const locale = spec.options.format.locale;
  const byId = new Map<string, number>();
  const unmatched: string[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const r of spec.data.rows) {
    const key = (r[0] ?? "").trim();
    const v = parseNumber(r[1], locale);
    if (!key || v == null) continue;
    const id = resolve(key);
    if (!id) {
      unmatched.push(key);
      continue;
    }
    byId.set(id, (byId.get(id) ?? 0) + v);
  }
  for (const v of byId.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!byId.size) return { byId, unmatched, min: 0, max: 0, count: 0 };
  return { byId, unmatched, min, max, count: byId.size };
}

/** Numbers in the first data column — used to decide if a table looks numeric. */
export function tableLooksNumeric(data: TableData, locale: Locale): boolean {
  const cells = data.rows.slice(0, 20).map((r) => r[1]).filter((c) => (c ?? "").trim() !== "");
  if (cells.length === 0) return true;
  return cells.filter((c) => parseNumber(c, locale) != null).length / cells.length >= 0.6;
}
