import { normalizeDecor, normalizeLayout } from "@/decor/model";

import { DEFAULT_OPTIONS, defaultWorkspace, type ChartSpec, type Workspace } from "./spec";
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
    export: {
      scale: ([1, 2, 3, 4] as const).includes(ws.export?.scale as 1) ? (ws.export!.scale as 1 | 2 | 3 | 4) : 2,
      background: ws.export?.background === "transparent" ? "transparent" : "theme",
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
    options: { ...DEFAULT_OPTIONS, ...(c.options ?? {}), format: { ...DEFAULT_FORMAT, ...(c.options?.format ?? {}) } },
    // Added after v1 shipped — workspaces saved before the decoration pack
    // simply come back undecorated instead of failing to load.
    decor: normalizeDecor(c.decor),
    yerlesim: normalizeLayout(c.yerlesim),
  };
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
