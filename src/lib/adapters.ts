import type { HeatmapColumn } from "@/charts/heatmap/heatmap-context";
import type { RingData } from "@/charts/ring-context";
import type { SankeyData } from "@/charts/sankey/sankey-chart";
import type { Locale } from "./format";
import { parseDate, parseNumber } from "./parse";
import type { ChartSpec, TableData } from "./spec";

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

/** Series keys are positional so renamed columns never break lookups. */
export function seriesKey(i: number): string {
  return `s${i}`;
}

export function toCartesian(spec: ChartSpec): CartesianModel {
  const { data, options } = spec;
  const locale = options.format.locale;
  const rows = data.rows.filter((r) => (r[0] ?? "").trim() !== "" || r.slice(1).some((c) => (c ?? "").trim() !== ""));
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

/** Numbers in the first data column — used to decide if a table looks numeric. */
export function tableLooksNumeric(data: TableData, locale: Locale): boolean {
  const cells = data.rows.slice(0, 20).map((r) => r[1]).filter((c) => (c ?? "").trim() !== "");
  if (cells.length === 0) return true;
  return cells.filter((c) => parseNumber(c, locale) != null).length / cells.length >= 0.6;
}
