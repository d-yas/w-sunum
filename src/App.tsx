import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { ChartCard } from "@/components/ChartCard";
import { DecorPanel } from "@/components/DecorPanel";
import { DecorStage } from "@/components/DecorStage";
import { DataGrid } from "@/components/DataGrid";
import { ColorsPanel, ExportPanel, KindPicker, OptionsPanel } from "@/components/Panels";
import { copyBlobToClipboard, serializeElement, snapshotElement } from "@/lib/export-png";
import { buildPptx, type PptxSlide } from "@/lib/pptx";
import { KIND_GROUPS, KIND_LABELS, dataShape, newChart, type ChartKind, type ChartSpec, type Workspace } from "@/lib/spec";
import { downloadBlob, downloadText, loadWorkspace, normalizeWorkspace, safeFilename, saveWorkspace } from "@/lib/storage";

type Tab = "veri" | "gorunum" | "renk" | "susle" | "disa";

export function App() {
  const [ws, setWs] = useState<Workspace>(() => initialWorkspace());
  const [tab, setTab] = useState<Tab>("veri");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<"fit" | 1>("fit");
  const [decorSel, setDecorSel] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });

  const active = ws.charts.find((c) => c.id === ws.activeId) ?? ws.charts[0];

  // A decoration selection belongs to one card; switching charts drops it.
  useEffect(() => setDecorSel(null), [ws.activeId]);

  useEffect(() => {
    document.documentElement.dataset.theme = ws.theme;
  }, [ws.theme]);

  useEffect(() => {
    const t = setTimeout(() => saveWorkspace(ws), 250);
    return () => clearTimeout(t);
  }, [ws]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const updateChart = useCallback((next: ChartSpec) => {
    setWs((w) => ({ ...w, charts: w.charts.map((c) => (c.id === next.id ? next : c)) }));
  }, []);

  const addChart = (kind: ChartKind) => {
    const n = ws.charts.filter((c) => c.kind === kind).length + 1;
    const c = newChart(kind, n);
    setWs((w) => ({ ...w, charts: [...w.charts, c], activeId: c.id }));
    setTab("veri");
  };
  const duplicateChart = () => {
    const copy: ChartSpec = { ...structuredClone(active), id: newChart(active.kind).id, name: `${active.name} (kopya)` };
    setWs((w) => ({ ...w, charts: [...w.charts, copy], activeId: copy.id }));
  };
  const deleteChart = () => {
    if (!window.confirm(`"${active.name}" silinsin mi?`)) return;
    setWs((w) => {
      const charts = w.charts.filter((c) => c.id !== active.id);
      const next = charts.length > 0 ? charts : [newChart("bar", 1)];
      return { ...w, charts: next, activeId: next[0].id };
    });
  };

  /** Renk panelinde listelenecek adlar — her tür rengi başka bir eksene dağıtır. */
  const seriesNames = useMemo(() => {
    const uniqueFirst = (col: number) => {
      const seen: string[] = [];
      for (const r of active.data.rows) {
        const v = (r[col] ?? "").trim();
        if (v && !seen.includes(v)) seen.push(v);
      }
      return seen;
    };
    switch (dataShape(active.kind)) {
      case "categoryValue":
        return active.data.rows.map((r) => (r[0] ?? "").trim()).filter(Boolean);
      case "flow": {
        const seen: string[] = [];
        for (const r of active.data.rows) {
          for (const n of [r[0], r[1]]) {
            const v = (n ?? "").trim();
            if (v && !seen.includes(v)) seen.push(v);
          }
        }
        return seen;
      }
      case "hierarchy":
        return uniqueFirst(0);
      case "xy":
        return uniqueFirst(4).length > 0 ? uniqueFirst(4) : ["Noktalar"];
      case "calendar":
        return ["Hücre rengi"];
      case "region":
        return ["Yoğunluk"];
      default:
        return active.kind === "slope"
          ? active.data.rows.map((r) => (r[0] ?? "").trim()).filter(Boolean)
          : active.data.columns.slice(1).map((c, i) => c.trim() || `Seri ${i + 1}`);
    }
  }, [active]);

  /* ---------------- export ---------------- */

  const renderStatic = useCallback(
    async (fn: (node: HTMLElement) => Promise<void>, spec: ChartSpec = active) => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
      document.body.appendChild(host);
      const root = createRoot(host);
      try {
        root.render(
          <ChartCard spec={spec} theme={ws.theme} palettes={ws.palettes} static transparent={ws.export.background === "transparent"} />
        );
        // ParentSize measures on the next frame; then wait until every
        // Motion/WAAPI animation in the card has finished (max 3 s).
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 250));
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const running = host.getAnimations({ subtree: true }).filter((a) => a.playState === "running");
          if (running.length === 0) break;
          await new Promise((r) => setTimeout(r, 80));
        }
        // Sankey link reveal is a JS-driven motion value (stroke-dashoffset),
        // invisible to getAnimations(); give its shortened tween time to land.
        if (spec.kind === "sankey") await new Promise((r) => setTimeout(r, 900));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const node = host.firstElementChild as HTMLElement | null;
        if (!node) throw new Error("Kart oluşturulamadı.");
        await fn(node);
      } finally {
        root.unmount();
        host.remove();
      }
    },
    // ws.palettes belongs here: without it the memoised closure keeps the
    // palette list it was created with, and editing a custom palette would
    // export the old colours while the stage showed the new ones.
    [active, ws.theme, ws.export.background, ws.palettes]
  );

  const withBusy = async (label: string, job: () => Promise<string>) => {
    setBusy(true);
    setMessage(`${label}…`);
    try {
      const done = await job();
      setMessage(done);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportPng = () =>
    withBusy("PNG hazırlanıyor", async () => {
      let out = "";
      await renderStatic(async (node) => {
        const blob = await snapshotElement(node, { scale: ws.export.scale, background: null });
        const name = `${safeFilename(active.title || active.name)}@${ws.export.scale}x.png`;
        downloadBlob(name, blob);
        out = `İndirildi: ${name} (${Math.round(blob.size / 1024)} KB)`;
      });
      return out;
    });

  const copyPng = () =>
    withBusy("Panoya kopyalanıyor", async () => {
      let out = "";
      await renderStatic(async (node) => {
        const blob = await snapshotElement(node, { scale: ws.export.scale, background: null });
        await copyBlobToClipboard(blob);
        out = `Panoya kopyalandı (${active.options.width * ws.export.scale} × ${active.options.height * ws.export.scale}).`;
      });
      return out;
    });

  const exportSvg = () =>
    withBusy("SVG hazırlanıyor", async () => {
      let out = "";
      await renderStatic(async (node) => {
        // Not `querySelector("svg")` — since the decoration pack, the first
        // <svg> in the card is the background layer. The chart is the one
        // without a data-decor marker.
        const svg = node.querySelector<SVGSVGElement>("svg:not([data-decor])");
        if (!svg) throw new Error("Bu grafikte SVG bulunamadı.");
        const text = new XMLSerializer().serializeToString(buildCardSvg(node, svg, active.options.width, active.options.height));
        const name = `${safeFilename(active.title || active.name)}.svg`;
        downloadText(name, text, "image/svg+xml");
        out = `İndirildi: ${name}. Not: SVG çizim alanını ve süslemeyi içerir; başlık ve gösterge HTML olduğu için dışarıda kalır.`;
      });
      return out;
    });

  /** One 16:9 slide per chart; the PNG is fitted and centred, slide bg matches the card. */
  const exportPptx = (all: boolean) =>
    withBusy(all ? "Sunu hazırlanıyor" : "Slayt hazırlanıyor", async () => {
      const specs = all ? ws.charts : [active];
      const slides: PptxSlide[] = [];
      for (const spec of specs) {
        await renderStatic(async (node) => {
          const blob = await snapshotElement(node, { scale: ws.export.scale, background: null });
          const cardBg = getComputedStyle(node).backgroundColor;
          slides.push({
            png: new Uint8Array(await blob.arrayBuffer()),
            width: spec.options.width,
            height: spec.options.height,
            background: ws.export.background === "transparent" ? null : cssColorToHex(cardBg),
            name: spec.title || spec.name,
          });
        }, spec);
      }
      const name = all ? "grafikler.pptx" : `${safeFilename(active.title || active.name)}.pptx`;
      const bytes = buildPptx(slides, all ? "Grafikler" : active.title || active.name);
      downloadBlob(name, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
      return `İndirildi: ${name} (${slides.length} slayt, ${Math.round(bytes.length / 1024)} KB)`;
    });

  // Debug hook for headless checks (scripts/cdp-check.mjs): renders the static
  // card and returns the PNG as a data URL, exactly what "PNG indir" produces.
  useEffect(() => {
    (window as unknown as { __veriGorsel?: unknown }).__veriGorsel = {
      staticMarkup: async () => {
        let out = "";
        await renderStatic(async (node) => {
          out = serializeElement(node, 1).svg;
        });
        return out;
      },
      snapshotDataUrl: async (scale = 2) => {
        let out = "";
        await renderStatic(async (node) => {
          const blob = await snapshotElement(node, { scale, background: null });
          out = await new Promise<string>((res) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.readAsDataURL(blob);
          });
        });
        return out;
      },
    };
  }, [renderStatic]);

  /* ---------------- workspace io ---------------- */

  const fileRef = useRef<HTMLInputElement>(null);
  const exportWorkspace = () => downloadText("grafikler.json", JSON.stringify(ws, null, 2));
  const importWorkspace = async (f: File) => {
    try {
      const next = normalizeWorkspace(JSON.parse(await f.text()));
      setWs(next);
      setMessage(`${next.charts.length} grafik yüklendi.`);
    } catch {
      setMessage("Dosya okunamadı — geçerli bir çalışma alanı JSON'u değil.");
    }
  };

  /* ---------------- stage scale ---------------- */

  const pad = 48;
  const fit = Math.min(1, (stageSize.w - pad) / active.options.width, (stageSize.h - pad) / active.options.height);
  const scale = zoom === "fit" ? Math.max(0.1, fit) : 1;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <div className="flex items-center gap-2 pr-2">
          <span className="inline-block h-5 w-5 rounded-md" style={{ background: "linear-gradient(135deg, var(--series-1), var(--series-3))" }} />
          <span className="text-[13px] font-semibold tracking-tight">Veri Görsel</span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Bklit · çevrimdışı</span>
        </div>
        <span className="h-5 w-px bg-border" />
        <select
          className="inp max-w-[220px]"
          value={active.id}
          onChange={(e) => setWs((w) => ({ ...w, activeId: e.target.value }))}
          title="Grafikler"
        >
          {ws.charts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="inp w-40"
          value={active.name}
          onChange={(e) => updateChart({ ...active, name: e.target.value })}
          title="Grafik adı"
        />
        <div className="relative">
          <select className="inp" value="" onChange={(e) => e.target.value && addChart(e.target.value as ChartKind)} title="Yeni grafik">
            <option value="">+ Yeni grafik</option>
            {KIND_GROUPS.map((g) => (
              <optgroup key={g.title} label={g.title}>
                {g.kinds.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button className="btn" onClick={duplicateChart}>
          Kopyala
        </button>
        <button className="btn btn-danger" onClick={deleteChart}>
          Sil
        </button>
        <span className="ml-auto" />
        <button className="btn" onClick={exportWorkspace} title="Tüm grafikleri JSON olarak indir">
          Kaydet (JSON)
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="JSON çalışma alanı yükle">
          Yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importWorkspace(f);
            e.target.value = "";
          }}
        />
        <span className="h-5 w-px bg-border" />
        <div className="seg" title="Tema">
          <button type="button" aria-pressed={ws.theme === "light"} onClick={() => setWs((w) => ({ ...w, theme: "light" }))}>
            Açık
          </button>
          <button type="button" aria-pressed={ws.theme === "dark"} onClick={() => setWs((w) => ({ ...w, theme: "dark" }))}>
            Koyu
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left: type + tabs */}
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-border bg-card">
          <div className="border-b border-border p-3">
            <KindPicker spec={active} onChange={updateChart} />
          </div>
          <div className="tabbar">
            {(
              [
                ["veri", "Veri"],
                ["gorunum", "Görünüm"],
                ["renk", "Renkler"],
                ["susle", "Süsle"],
                ["disa", "Dışa aktar"],
              ] as [Tab, string][]
            ).map(([t, l]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {l}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === "veri" && (
              <div className="h-full p-3">
                <DataGrid kind={active.kind} data={active.data} onChange={(data) => updateChart({ ...active, data })} />
              </div>
            )}
            {tab === "gorunum" && <OptionsPanel spec={active} onChange={updateChart} />}
            {tab === "renk" && (
              <ColorsPanel
                spec={active}
                theme={ws.theme}
                seriesNames={seriesNames}
                palettes={ws.palettes}
                onPalettes={(palettes) => setWs((w) => ({ ...w, palettes }))}
                onChange={updateChart}
              />
            )}
            {tab === "susle" && (
              <DecorPanel
                spec={active}
                theme={ws.theme}
                palettes={ws.palettes}
                selectedId={decorSel}
                onSelect={setDecorSel}
                onChange={updateChart}
              />
            )}
            {tab === "disa" && (
              <ExportPanel
                scale={ws.export.scale}
                background={ws.export.background}
                width={active.options.width}
                height={active.options.height}
                busy={busy}
                onScale={(s) => setWs((w) => ({ ...w, export: { ...w.export, scale: s } }))}
                onBackground={(b) => setWs((w) => ({ ...w, export: { ...w.export, background: b } }))}
                onDownload={exportPng}
                onCopy={copyPng}
                onSvg={exportSvg}
                onPptx={() => exportPptx(false)}
                onPptxAll={() => exportPptx(true)}
                chartCount={ws.charts.length}
                message={message}
              />
            )}
          </div>
        </aside>

        {/* Stage */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card/60 px-3 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {active.options.width} × {active.options.height} px
            </span>
            <span>·</span>
            <span className="tabular-nums">{Math.round(scale * 100)}%</span>
            <div className="seg ml-2">
              <button type="button" aria-pressed={zoom === "fit"} onClick={() => setZoom("fit")}>
                Sığdır
              </button>
              <button type="button" aria-pressed={zoom === 1} onClick={() => setZoom(1)}>
                100%
              </button>
            </div>
            <span className="ml-auto" />
            <button className="btn btn-sm" disabled={busy} onClick={copyPng} title="PNG olarak panoya kopyala">
              Panoya kopyala
            </button>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={exportPng}>
              PNG indir
            </button>
          </div>
          <div ref={stageRef} className="stage min-h-0 flex-1 overflow-auto">
            <div
              style={{
                width: Math.max(stageSize.w, active.options.width * scale + pad),
                height: Math.max(stageSize.h, active.options.height * scale + pad),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: active.options.width * scale,
                  height: active.options.height * scale,
                  boxShadow: "0 12px 40px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08)",
                  borderRadius: 2,
                }}
              >
                <ChartCard
                  spec={active}
                  theme={ws.theme}
                  palettes={ws.palettes}
                  transparent={ws.export.background === "transparent"}
                  // The decor panel measures this card to seed free-layout boxes.
                  className="stage-card"
                  style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
                />
                {tab === "susle" && (
                  <DecorStage spec={active} scale={scale} selectedId={decorSel} onSelect={setDecorSel} onChange={updateChart} />
                )}
              </div>
            </div>
          </div>
          {message && tab !== "disa" && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] shadow">
              {message}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * `index.html?kind=ring&theme=dark` opens a fresh chart of that kind — handy
 * for demos and for screenshot-based checks. Without params the saved
 * workspace is restored.
 */
function initialWorkspace(): Workspace {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("kind") as ChartKind | null;
  if (kind && kind in KIND_LABELS) {
    const ws = loadWorkspace();
    const chart = newChart(kind, ws.charts.filter((c) => c.kind === kind).length + 1);
    const theme = params.get("theme") === "dark" ? "dark" : params.get("theme") === "light" ? "light" : ws.theme;
    return { ...ws, theme, charts: [...ws.charts, chart], activeId: chart.id };
  }
  return loadWorkspace();
}

/** "rgb(26, 26, 25)" → "1A1A19"; transparent or unparsable → null (theme white). */
function cssColorToHex(color: string): string | null {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  if (m[4] != null && Number(m[4]) === 0) return null;
  return [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0").toUpperCase()).join("");
}

/**
 * Compose one card-sized SVG: background decoration, the chart translated to
 * where it actually sits in the card, then foreground decoration.
 *
 * The decoration layers are copied verbatim — every asset writes explicit
 * presentation attributes, so unlike the chart they need no style inlining.
 * Their <text> asks to inherit the font, which is why the root carries one.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

function buildCardSvg(card: HTMLElement, chart: SVGSVGElement, width: number, height: number): SVGSVGElement {
  const out = document.createElementNS(SVG_NS, "svg");
  out.setAttribute("xmlns", SVG_NS);
  out.setAttribute("width", String(width));
  out.setAttribute("height", String(height));
  out.setAttribute("viewBox", `0 0 ${width} ${height}`);
  out.setAttribute("font-family", getComputedStyle(card).fontFamily);

  const cardBox = card.getBoundingClientRect();
  const layers = (phase: string) => Array.from(card.querySelectorAll<SVGSVGElement>(`svg[data-decor="${phase}"]`));
  for (const layer of layers("arka")) out.appendChild(layer.cloneNode(true));

  const box = chart.getBoundingClientRect();
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `translate(${Math.round(box.left - cardBox.left)} ${Math.round(box.top - cardBox.top)})`);
  const clone = chart.cloneNode(true) as SVGSVGElement;
  inlineSvgStyles(chart, clone);
  g.appendChild(clone);
  out.appendChild(g);

  for (const layer of layers("on")) out.appendChild(layer.cloneNode(true));
  return out;
}

/** Copy computed presentation styles onto a detached SVG clone so it renders standalone. */
function inlineSvgStyles(source: Element, target: Element) {
  const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "transform", "clip-path", "mask", "filter", "visibility", "color"];
  const cs = getComputedStyle(source);
  const decl = props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
  target.setAttribute("style", decl);
  target.removeAttribute("class");
  const sc = source.children;
  const tc = target.children;
  for (let i = 0; i < sc.length; i++) if (tc[i]) inlineSvgStyles(sc[i], tc[i]);
}
