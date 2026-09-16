import { normalizeDecor, normalizeLayout } from "@/decor/model";

import { normalizePalettes } from "./palettes";

import { DEFAULT_OPTIONS, defaultWorkspace, uid, type ChartOptions, type ChartSpec, type RefLine, type Workspace } from "./spec";
import { DEFAULT_FORMAT } from "./format";

const KEY = "data-gorsel.workspace.v1";

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultWorkspace();
    return normalizeWorkspace(JSON.parse(raw));
  } catch {
    return defaultWorkspace();
  }
}

export function saveWorkspace(ws: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
  } catch {
    /* quota / private mode — the in-memory state still works */
  }
}

/** Fill in fields added after a workspace was saved, so old JSON files keep loading. */
export function normalizeWorkspace(input: unknown): Workspace {
  const base = defaultWorkspace();
  if (!input || typeof input !== "object") return base;
  const ws = input as Partial<Workspace>;
  const charts = Array.isArray(ws.charts) && ws.charts.length > 0 ? ws.charts.map(normalizeChart) : base.charts;
  const activeId = charts.some((c) => c.id === ws.activeId) ? (ws.activeId as string) : charts[0].id;
  return {
    version: 1,
    theme: ws.theme === "dark" ? "dark" : "light",
    activeId,
    charts,
    palettes: normalizePalettes(ws.palettes),
    export: {
      scale: ([1, 2, 3, 4] as const).includes(ws.export?.scale as 1) ? (ws.export!.scale as 1 | 2 | 3 | 4) : 2,
      background: ws.export?.background === "transparent" ? "transparent" : "theme",
      pptxScale: ([2, 3, 4] as const).includes(ws.export?.pptxScale as 2) ? (ws.export!.pptxScale as 2 | 3 | 4) : 3,
      pptxSlayt: (["16:9", "4:3", "kart"] as const).includes(ws.export?.pptxSlayt as "16:9")
        ? (ws.export!.pptxSlayt as "16:9" | "4:3" | "kart")
        : "16:9",
    },
  };
}

export function normalizeChart(input: unknown): ChartSpec {
  const c = (input ?? {}) as Partial<ChartSpec>;
  const fallback = defaultWorkspace().charts[0];
  return {
    id: typeof c.id === "string" ? c.id : fallback.id,
    name: typeof c.name === "string" ? c.name : fallback.name,
    kind: (c.kind as ChartSpec["kind"]) ?? "bar",
    title: c.title ?? "",
    subtitle: c.subtitle ?? "",
    note: c.note ?? "",
    data:
      c.data && Array.isArray(c.data.columns) && Array.isArray(c.data.rows)
        ? { columns: c.data.columns.map(String), rows: c.data.rows.map((r) => (Array.isArray(r) ? r.map(String) : [])) }
        : fallback.data,
    paletteId: c.paletteId ?? "varsayilan",
    colors: Array.isArray(c.colors) ? c.colors.map(String) : [],
    options: normalizeOptions(c.options),
    // Added after v1 shipped — workspaces saved before the decoration pack
    // simply come back undecorated instead of failing to load.
    decor: normalizeDecor(c.decor),
    yerlesim: normalizeLayout(c.yerlesim),
  };
}

/**
 * Kaydedilmiş ayarları bugünkü sözleşmeye çevir.
 *
 * `DEFAULT_OPTIONS` yayılımı yeni alanları kendiliğinden dolduruyor; burada
 * yapılan iş bunun ötesinde üç şey: yeniden adlandırılan alanların göçü,
 * elle kurcalanmış ya da eski bir sürümden gelen numaralandırmaların
 * doğrulanması, ve dizi/nesne alanlarının biçiminin güvenceye alınması.
 * Doğrulama gereksiz değil: bu dosyalar kullanıcı tarafından düzenlenebiliyor
 * ve geçersiz bir `valueLabels` değeri grafiği çizim sırasında düşürür.
 */
export function normalizeOptions(raw: unknown): ChartOptions {
  const legacy = (raw ?? {}) as Partial<ChartOptions> & { xLabel?: string; yLabel?: string };
  const o: ChartOptions = {
    ...DEFAULT_OPTIONS,
    ...legacy,
    format: { ...DEFAULT_FORMAT, ...(legacy.format ?? {}) },
  };

  // xLabel/yLabel → xTitle/yTitle: eskiden yalnız dağılım/balon grafiğine
  // aitti, artık bütün kartezyen türlerde var.
  if (!o.xTitle && typeof legacy.xLabel === "string") o.xTitle = legacy.xLabel;
  if (!o.yTitle && typeof legacy.yLabel === "string") o.yTitle = legacy.yLabel;
  delete (o as unknown as Record<string, unknown>).xLabel;
  delete (o as unknown as Record<string, unknown>).yLabel;

  o.barRadius = clamp(o.barRadius, 0, 24, DEFAULT_OPTIONS.barRadius);
  o.valueLabelSize = clamp(o.valueLabelSize, 6, 32, DEFAULT_OPTIONS.valueLabelSize);
  o.colorBy = pick(o.colorBy, ["series", "category"], "series");
  o.sort = pick(o.sort, ["none", "asc", "desc"], "none");
  o.valueLabels = pick(o.valueLabels, ["auto", "none", "inside", "outside"], "auto");
  o.valueLabelPoints = pick(o.valueLabelPoints, ["all", "last"], "all");
  o.xTickAngle = ([0, 45, 90] as unknown[]).includes(o.xTickAngle) ? o.xTickAngle : "auto";
  o.highlight = Array.isArray(o.highlight) ? o.highlight.map(String) : [];
  o.forecastFrom = typeof o.forecastFrom === "number" && Number.isFinite(o.forecastFrom) ? o.forecastFrom : null;
  o.refLines = Array.isArray(o.refLines)
    ? o.refLines
        .filter((l): l is RefLine => !!l && Number.isFinite(Number((l as RefLine).value)))
        .slice(0, 12)
        .map((l) => ({
          id: typeof l.id === "string" && l.id ? l.id : uid(),
          value: Number(l.value),
          label: String(l.label ?? "").slice(0, 60),
          color: /^#[0-9a-fA-F]{6}$/.test(String(l.color)) ? String(l.color) : "",
          dash: l.dash !== false,
        }))
    : [];
  return o;
}

function clamp(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return allowed.includes(v as T) ? (v as T) : def;
}

export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(s: string): string {
  return (
    s
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "grafik"
  );
}
