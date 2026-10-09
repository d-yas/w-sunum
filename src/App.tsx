import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { FolderOpen, Maximize2, Minimize2, Redo2, Save, Undo2 } from "lucide-react";

import { ChartCard } from "@/components/ChartCard";
import { ChartStrip } from "@/components/ChartStrip";
import { DecorPanel } from "@/components/DecorPanel";
import { DecorStage } from "@/components/DecorStage";
import { DataGrid } from "@/components/DataGrid";
import { Inspector } from "@/components/Inspector";
import { LayersPanel } from "@/components/LayersPanel";
import { SiraSahnesi, type UzerindeOge } from "@/components/SiraSahnesi";
import { ColorsPanel, ExportPanel, SectionScope } from "@/components/Panels";
import { Toolbar, type Arac } from "@/components/Toolbar";
import { copyBlobToClipboard, serializeElement, snapshotElement } from "@/lib/export-png";
import { buildCardSvg } from "@/lib/export-svg";
import { createHistory } from "@/lib/history";
import { buildPptx, type PptxSlide } from "@/lib/pptx";
import { yazilariTopla } from "@/lib/pptx-metin";
import { buildZip } from "@/lib/zip";
import { KIND_LABELS, newChart, type ChartKind, type ChartSpec, type Workspace } from "@/lib/spec";
import { bicemAl, bicemUygula, type Bicem } from "@/lib/bicem";
import { setFreeLayout } from "@/lib/free-layout";
import { GRAFIK, SLAYT, icerideMi, parcaya, sahneSecimi, sahnedenSecim, type Secim } from "@/lib/selection";
import { olculenSira } from "@/lib/sahne-olcu";
import { adlariTasi, gostergeBoyutu, gorunenSira, renkAdlari, siraBoyutlari } from "@/lib/sira";
import { adimla, komsu, vurguDegistir } from "@/lib/sira-eylem";
import { downloadBlob, downloadText, loadWorkspace, normalizeWorkspace, safeFilename, saveWorkspace } from "@/lib/storage";
import { useKindPreviews } from "@/lib/kind-previews";
import { useThumbnails } from "@/lib/thumbnails";
import { loadPrefs, savePrefs } from "@/lib/ui-prefs";

export function App() {
  const [ws, setWs] = useState<Workspace>(() => initialWorkspace());
  const [arac, setArac] = useState<Arac>("sec");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<"fit" | 1>("fit");
  const [secim, setSecim] = useState<Secim>(SLAYT);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  /** Stil panosu — oturumluk; iş dosyasına yazılmıyor, geçmişte yer almıyor. */
  const [bicemPano, setBicemPano] = useState<Bicem | null>(null);
  /**
   * Sahnede öğe sürüklenirken karta giden geçici spec — yalnız sıra alanları
   * farklı. İşe yazılmaz, geçmişe girmez; küçük resim ve dışa aktarım onu görmez.
   */
  const [onizleme, setOnizleme] = useState<ChartSpec | null>(null);
  /** Sağ paneldeki sıra listesinde üstüne gelinen öğe — sahnede çerçevelenir. */
  const [uzerinde, setUzerinde] = useState<UzerindeOge | null>(null);
  const [layerHeight, setLayerHeight] = useState(() => loadPrefs().layerHeight);

  const active = ws.charts.find((c) => c.id === ws.activeId) ?? ws.charts[0];

  /* ---------------- geri al / yinele ---------------- */

  const history = useRef(createHistory()).current;
  // Geçmiş React durumu değil (saf bir yığın), o yüzden düğmelerin
  // etkin/etkisiz hâli kendiliğinden yenilenmiyor; bu sayaç yenilemeyi tetikler.
  const [histTick, setHistTick] = useState(0);
  const canUndo = useMemo(() => history.canUndo(), [history, histTick]);
  const canRedo = useMemo(() => history.canRedo(), [history, histTick]);

  /**
   * İşi değiştiren **tek kapı**. Değişiklikten önceki grafik/palet hâli
   * geçmişe yazılır; tema, sekme, yakınlaştırma buradan geçmez, o yüzden
   * geçmişte de yer almaz.
   */
  const commit = useCallback(
    (fn: (w: Workspace) => Workspace) => {
      setWs((w) => {
        const next = fn(w);
        if (next.charts !== w.charts || next.palettes !== w.palettes) {
          history.record({ charts: w.charts, palettes: w.palettes });
          setHistTick((t) => t + 1);
        }
        return next;
      });
    },
    [history]
  );

  const undo = useCallback(() => {
    setWs((w) => {
      const prev = history.undo({ charts: w.charts, palettes: w.palettes });
      setHistTick((t) => t + 1);
      if (!prev) return w;
      return { ...w, charts: prev.charts, palettes: prev.palettes, activeId: prev.charts.some((c) => c.id === w.activeId) ? w.activeId : prev.charts[0].id };
    });
  }, [history]);

  const redo = useCallback(() => {
    setWs((w) => {
      const next = history.redo({ charts: w.charts, palettes: w.palettes });
      setHistTick((t) => t + 1);
      if (!next) return w;
      return { ...w, charts: next.charts, palettes: next.palettes, activeId: next.charts.some((c) => c.id === w.activeId) ? w.activeId : next.charts[0].id };
    });
  }, [history]);

  // Seçim bir karta ait; grafik değişince düşer.
  useEffect(() => {
    setSecim(SLAYT);
    setOnizleme(null);
    setUzerinde(null);
  }, [ws.activeId]);

  // Tablo değişince seçili öğeler yok olmuş olabilir: kalmayanlar düşer,
  // hiçbiri kalmadıysa grafiğin kendisi seçili kalır.
  useEffect(() => {
    if (secim.tur !== "oge") return;
    const var_ = new Set(gorunenSira(active, secim.boyut).map((x) => x.anahtar));
    const kalan = secim.anahtarlar.filter((k) => var_.has(k));
    if (kalan.length === secim.anahtarlar.length) return;
    setSecim(kalan.length > 0 ? { ...secim, anahtarlar: kalan } : GRAFIK);
  }, [active, secim]);

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

  const updateChart = useCallback(
    (next: ChartSpec) => {
      commit((w) => ({ ...w, charts: w.charts.map((c) => (c.id === next.id ? next : c)) }));
    },
    [commit]
  );

  /**
   * Sahnede sürüklemeyi bırakmak: **tek** geri al adımı. Geçmiş 400 ms
   * içindeki değişiklikleri birleştiriyor; bırakmadan hemen önceki bir
   * düzenlemeyle (ya da art arda iki sürüklemeyle) kaynaşmasın diye pencere
   * kapatılıyor. Sonuç güncel durumdan hesaplanıyor, sürüklemenin başında
   * alınmış bir kopyadan değil.
   */
  const siraBirak = useCallback(
    (fn: (s: ChartSpec) => ChartSpec) => {
      history.mark();
      commit((w) => ({ ...w, charts: w.charts.map((c) => (c.id === w.activeId ? fn(c) : c)) }));
      history.mark();
    },
    [commit, history]
  );

  /* ---------------- stili kopyala / yapıştır ---------------- */

  const bicemKopyala = useCallback(() => {
    setBicemPano(bicemAl(active));
    setMessage(`"${active.name}" stili panoya alındı`);
    setTimeout(() => setMessage(null), 1800);
  }, [active]);

  const bicemYapistir = useCallback(() => {
    if (!bicemPano) return;
    updateChart(bicemUygula(active, bicemPano));
  }, [active, bicemPano, updateChart]);

  /** Aktif kartın biçemini ötekilere geçirir — "şunu şablon yap" tek düğme. */
  const bicemHepsine = useCallback(() => {
    const b = bicemAl(active);
    commit((w) => ({ ...w, charts: w.charts.map((c) => (c.id === active.id ? c : bicemUygula(c, b))) }));
    setMessage(`${ws.charts.length - 1} grafiğe uygulandı`);
    setTimeout(() => setMessage(null), 1800);
  }, [active, commit, ws.charts.length]);

  /** `index` verilmezse sona eklenir; şeritteki ara noktalar yer belirtiyor. */
  const addChart = (kind: ChartKind, index?: number) => {
    const n = ws.charts.filter((c) => c.kind === kind).length + 1;
    const c = newChart(kind, n);
    commit((w) => {
      const at = index == null ? w.charts.length : Math.max(0, Math.min(w.charts.length, index));
      const charts = [...w.charts];
      charts.splice(at, 0, c);
      return { ...w, charts, activeId: c.id };
    });
  };
  const duplicateChart = (id: string) => {
    const src = ws.charts.find((c) => c.id === id);
    if (!src) return;
    const copy: ChartSpec = { ...structuredClone(src), id: newChart(src.kind).id, name: `${src.name} (kopya)` };
    commit((w) => ({ ...w, charts: [...w.charts, copy], activeId: copy.id }));
  };
  const deleteChart = (id: string) => {
    const src = ws.charts.find((c) => c.id === id);
    if (!src || !window.confirm(`"${src.name}" silinsin mi?`)) return;
    commit((w) => {
      const charts = w.charts.filter((c) => c.id !== id);
      const next = charts.length > 0 ? charts : [newChart("bar", 1)];
      return { ...w, charts: next, activeId: next.some((c) => c.id === w.activeId) ? w.activeId : next[0].id };
    });
  };
  const moveChart = (id: string, dir: -1 | 1) => {
    commit((w) => {
      const i = w.charts.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= w.charts.length) return w;
      const charts = [...w.charts];
      [charts[i], charts[j]] = [charts[j], charts[i]];
      return { ...w, charts };
    });
  };
  // Geniş bir tabloyu 300 px'lik sütunda düzenlemek işkence; tam ekran veri
  // panelini tüm pencereye açıyor. Esc kapatıyor — açık kalıp da kullanıcıyı
  // kilitlemesin diye.
  const [veriTam, setVeriTam] = useState(false);
  useEffect(() => {
    if (!veriTam) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Yalnız paneli kapatsın; seçimi bir üste taşımak ayrı bir Esc.
      e.preventDefault();
      setVeriTam(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [veriTam]);

  /** Sürüklemenin karşılığı: komşu takası değil, listeden alıp araya sokma. */
  const reorderCharts = (from: number, to: number) => {
    commit((w) => {
      if (from < 0 || to < 0 || from >= w.charts.length || to >= w.charts.length) return w;
      const charts = [...w.charts];
      const [moved] = charts.splice(from, 1);
      charts.splice(to, 0, moved);
      return { ...w, charts };
    });
  };

  /**
   * Renk panelinde listelenecek adlar — `colors[i]`'nin hangi öğeye ait olduğu.
   * Çizimle aynı kimlikten (`src/lib/sira.ts`): eskiden ham tablo sırasından
   * okunuyordu, sıralama ya da süzülen satırlar adları renklerden kaydırıyordu.
   */
  const seriesNames = useMemo(() => renkAdlari(active), [active]);

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

  /** Kartın tamamını vektör olarak serileştir — başlık ve gösterge dâhil. */
  const cardSvgText = useCallback(
    async (spec: ChartSpec) => {
      let text = "";
      await renderStatic(async (node) => {
        const svg = buildCardSvg(node, {
          width: spec.options.width,
          height: spec.options.height,
          transparent: ws.export.background === "transparent",
        });
        text = new XMLSerializer().serializeToString(svg);
      }, spec);
      return text;
    },
    [renderStatic, ws.export.background]
  );

  const exportSvg = () =>
    withBusy("SVG hazırlanıyor", async () => {
      const text = await cardSvgText(active);
      const name = `${safeFilename(active.title || active.name)}.svg`;
      downloadText(name, text, "image/svg+xml");
      return `İndirildi: ${name} (${Math.round(text.length / 1024)} KB, vektör).`;
    });

  const copySvg = () =>
    withBusy("SVG kopyalanıyor", async () => {
      const text = await cardSvgText(active);
      await navigator.clipboard.writeText(text);
      return `SVG panoya kopyalandı (${Math.round(text.length / 1024)} KB). Illustrator / Figma'ya yapıştırın.`;
    });

  /** Her grafik bir dosya, hepsi tek bir zip — STORE yöntemli kendi yazıcımız. */
  const exportAll = (kind: "png" | "svg") =>
    withBusy(kind === "png" ? "PNG paketi hazırlanıyor" : "SVG paketi hazırlanıyor", async () => {
      const files: { name: string; data: Uint8Array | string }[] = [];
      let i = 0;
      for (const spec of ws.charts) {
        i += 1;
        const stem = `${String(i).padStart(2, "0")}-${safeFilename(spec.title || spec.name)}`;
        if (kind === "svg") {
          files.push({ name: `${stem}.svg`, data: await cardSvgText(spec) });
        } else {
          await renderStatic(async (node) => {
            const blob = await snapshotElement(node, { scale: ws.export.scale, background: null });
            files.push({ name: `${stem}@${ws.export.scale}x.png`, data: new Uint8Array(await blob.arrayBuffer()) });
          }, spec);
        }
      }
      const bytes = buildZip(files);
      const name = kind === "png" ? "grafikler-png.zip" : "grafikler-svg.zip";
      downloadBlob(name, new Blob([bytes], { type: "application/zip" }));
      return `İndirildi: ${name} (${files.length} dosya, ${Math.round(bytes.length / 1024)} KB)`;
    });

  /** One 16:9 slide per chart; the PNG is fitted and centred, slide bg matches the card. */
  const exportPptx = (all: boolean) =>
    withBusy(all ? "Sunu hazırlanıyor" : "Slayt hazırlanıyor", async () => {
      const specs = all ? ws.charts : [active];
      const slides: PptxSlide[] = [];
      for (const spec of specs) {
        await renderStatic(async (node) => {
          const cardBg = getComputedStyle(node).backgroundColor;
          // Tek geçiş: ölçülen kart ile PNG'ye giden kart aynı kart. Önce
          // yazılar toplanıyor, sonra görünmez kılınıyor — böylece slaytta
          // düzenlenebilir bir kutu olarak duruyorlar ve resimde yoklar.
          const { yazilar, gizle } = yazilariTopla(node);
          gizle();
          const blob = await snapshotElement(node, { scale: ws.export.pptxScale, background: null });
          slides.push({
            png: new Uint8Array(await blob.arrayBuffer()),
            width: spec.options.width,
            height: spec.options.height,
            background: ws.export.background === "transparent" ? null : cssColorToHex(cardBg),
            name: spec.title || spec.name,
            texts: yazilar,
          });
        }, spec);
      }
      const name = all ? "grafikler.pptx" : `${safeFilename(active.title || active.name)}.pptx`;
      const bytes = buildPptx(slides, all ? "Grafikler" : active.title || active.name, ws.export.pptxSlayt);
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
      cardSvg: async () => cardSvgText(active),
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
  }, [renderStatic, cardSvgText, active]);

  /* ---------------- workspace io ---------------- */

  const fileRef = useRef<HTMLInputElement>(null);
  const exportWorkspace = () => downloadText("grafikler.json", JSON.stringify(ws, null, 2));
  const importWorkspace = async (f: File) => {
    try {
      const next = normalizeWorkspace(JSON.parse(await f.text()));
      commit(() => next);
      setMessage(`${next.charts.length} grafik yüklendi.`);
    } catch {
      setMessage("Dosya okunamadı — geçerli bir çalışma alanı JSON'u değil.");
    }
  };

  /* ---------------- klavye ---------------- */

  /**
   * Uygulama geri alması `<textarea>` dışında her yerde çalışır ve tarayıcının
   * kendi geri almasını bastırır. Gerekçe: buradaki inputların hepsi kontrollü,
   * React değeri her tuşta yeniden yazdığı için tarayıcı yığını zaten
   * güvenilmez; kullanıcının geri almak istediği şey de çoğunlukla tablo ya da
   * ayar değişikliği. Yapıştırma kutusu (`textarea`) istisna: orada çok satırlı
   * metni elle düzenlemek doğal davranışı gerektiriyor.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const inTextarea = (e.target as HTMLElement | null)?.tagName === "TEXTAREA";
      const k = e.key.toLowerCase();
      if (k === "z" && !inTextarea) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y" && !inTextarea) {
        e.preventDefault();
        redo();
      } else if (k === "s") {
        e.preventDefault();
        if (e.shiftKey) void exportPng();
        else exportWorkspace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, exportPng, exportWorkspace]);

  // Odak bir alandan çıkınca geçmişte yeni girdi başlat: başlığı yazıp alt
  // başlığa geçmek tek adım değil iki adım olmalı.
  useEffect(() => {
    const onOut = () => history.mark();
    window.addEventListener("focusout", onOut);
    return () => window.removeEventListener("focusout", onOut);
  }, [history]);

  /* ---------------- sol panel bölmesi ---------------- */

  /**
   * Sol sütunda iki bölme var — katmanlar ve veri — aralarında bir tutamaç:
   * basıştan bu yana kaç piksel gidildiyse üstteki bölmenin yüksekliğine ekle.
   * (Grafik listesi artık sahnenin altındaki şeritte, bkz. `ChartStrip`.)
   */
  const splitDrag =
    (h: number, setH: (v: number) => void, key: "layerHeight") => (e: React.PointerEvent<HTMLDivElement>) => {
      const startY = e.clientY;
      const clamp = (v: number) => Math.max(90, Math.min(Math.max(160, stageSize.h - 40), v));
      const move = (ev: PointerEvent) => setH(clamp(h + ev.clientY - startY));
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        savePrefs({ [key]: clamp(h + ev.clientY - startY) });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: true });
    };

  const thumbs = useThumbnails(ws, renderStatic, busy);

  /**
   * Tür seçicideki örnek çizimler. Üretim tür ızgarası ilk kez göründüğünde
   * başlıyor (`istendi`), küçük resimlerle aynı hattı paylaştığı için dışa
   * aktarım sürerken duruyor.
   */
  const [turIstendi, setTurIstendi] = useState(false);
  const { previews: turResimleri, onHover: turHover } = useKindPreviews(renderStatic, ws.theme, turIstendi, busy);
  const onTurHover = useCallback(
    (k: ChartKind | null) => {
      setTurIstendi(true);
      turHover(k);
    },
    [turHover]
  );

  /* ---------------- sahnede seçim ---------------- */

  /**
   * Karttaki parçaya tıklamak onu seçer; sağ panel seçime göre içerik gösterir.
   *
   * Eşleştirme `data-part` özniteliğinden okunuyor — kartın DOM'u zaten dışa
   * aktarılan DOM, ona durum eklemek istemiyoruz. Çubuk, değer etiketi gibi
   * alt parçalar grafiğin kendisini seçiyor: seçim her yerde aynı davransın
   * diye. Bir kategoriyi vurgulamak `Alt+tık`.
   */
  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Süsleme katmanının kendi jestleri (metin/çizgi araçları, tutamaçlar) buraya
    // düşmemeli: yoksa yeni koyduğumuz kutu daha doğar doğmaz altındaki grafiğe
    // seçim devrediyor.
    if (arac !== "sec" || (e.target as HTMLElement | null)?.closest(".decor-overlay")) return;
    // Süsleme katmanı kartın üstünde duruyor, o yüzden tıklamanın hedefi çoğu
    // zaman o katmanın kendisi oluyor. Hedef bir parça değilse noktadaki tüm
    // öğelere bakıp altındaki parçayı buluyoruz.
    const dogrudan = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-part]");
    const el =
      dogrudan ??
      document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((n) => (n as HTMLElement).closest?.("[data-part]") as HTMLElement | null)
        .find((n): n is HTMLElement => n != null) ??
      null;
    const part = el?.dataset.part;
    if (!part) {
      setSecim(SLAYT);
      return;
    }
    const cat = el?.dataset.category;
    if (e.altKey && cat) {
      updateChart(vurguDegistir(active, cat, e.shiftKey));
      return;
    }
    setSecim({ tur: "parca", part: parcaya(part) });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Bir menü, açılır kutu ya da odaktaki liste tuşu zaten kullandıysa dokunma.
      if (e.defaultPrevented) return;
      // Esc önce araçtan çıkarıyor: bir kipte sıkışıp kalmanın çıkışı, seçimi
      // düşürmekten daha acil. Seçimde bir üste çıkar — öğe → grafik → slayt,
      // Figma'daki gibi.
      if (e.key === "Escape") {
        setArac("sec");
        setSecim(secim.tur === "oge" ? GRAFIK : SLAYT);
      }
      const hedef = e.target as HTMLElement | null;
      if (hedef && hedef.closest("input, textarea, select")) return;
      if (siraTusu(e)) return;
      // Ctrl+Alt+C / V: stil panosu. Düz Ctrl+C metin kopyalamayı bozardı.
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
        e.preventDefault();
        bicemKopyala();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
        e.preventDefault();
        bicemYapistir();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "v" || e.key === "V") setArac("sec");
      if (e.key === "h" || e.key === "H") setArac("el");
      if (e.key === "t" || e.key === "T") setArac("metin");
      if (e.key === "l" || e.key === "L") setArac("cizgi");
    };
    /**
     * Grafik öğelerinin klavyesi. Yalnız odak sahnedeyken (ya da hiçbir
     * yerdeyken): paneldeki bir düğmede `Tab`/`Enter`'ı çalmamalı.
     */
    const siraTusu = (e: KeyboardEvent): boolean => {
      const odak = document.activeElement;
      if (odak && odak !== document.body && !odak.closest(".stage")) return false;
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (secim.tur === "oge") {
        const s = { boyut: secim.boyut, anahtarlar: secim.anahtarlar, grup: secim.grup };
        const geri = e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "[" || e.key === "{";
        const ileri = e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "]" || e.key === "}";
        if (geri || ileri) {
          e.preventDefault();
          // Her basış ayrı bir geri al adımı — yazmak gibi birleşmesin.
          const olculen = olculenSira(active);
          siraBirak((c) => adimla(c, s, geri ? -1 : 1, e.shiftKey, olculen));
          return true;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const k = komsu(active, s, e.shiftKey ? -1 : 1, olculenSira(active));
          if (k) setSecim({ tur: "oge", boyut: secim.boyut, anahtarlar: [k], grup: secim.grup });
          return true;
        }
        return false;
      }
      // Grafikten (ya da göstergesinden) ilk öğesine in.
      if (e.key === "Enter" && icerideMi(secim)) {
        const boyut =
          secim.tur === "parca" && secim.part === "legend"
            ? gostergeBoyutu(active)
            : (siraBoyutlari(active).find((b) => b.boyut === "oge" && !b.kapali) ?? siraBoyutlari(active)[0])?.boyut;
        const ilk = boyut ? gorunenSira(active, boyut, olculenSira(active))[0] : undefined;
        if (!boyut || !ilk) return false;
        e.preventDefault();
        setSecim({ tur: "oge", boyut, anahtarlar: [ilk.anahtar], grup: ilk.grup });
        return true;
      }
      return false;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bicemKopyala, bicemYapistir, secim, active, siraBirak]);

  /**
   * El aracı: sahneyi sürükleyerek kaydırır. Sahne zaten `overflow: auto`,
   * yani yapılacak tek şey tekerleğin işini imlece devretmek.
   */
  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (arac !== "el") return;
    const el = stageRef.current;
    if (!el) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const sl = el.scrollLeft;
    const st = el.scrollTop;
    const move = (ev: PointerEvent) => {
      el.scrollLeft = sl - (ev.clientX - x0);
      el.scrollTop = st - (ev.clientY - y0);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------------- stage scale ---------------- */

  const pad = 48;
  const fit = Math.min(1, (stageSize.w - pad) / active.options.width, (stageSize.h - pad) / active.options.height);
  const scale = zoom === "fit" ? Math.max(0.1, fit) : 1;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <div className="flex items-center gap-2 pr-1">
          <span className="inline-block h-5 w-5 rounded-md" style={{ background: "linear-gradient(135deg, var(--series-1), var(--series-3))" }} />
          <span className="text-[13px] font-semibold tracking-tight">Veri Görsel</span>
          <span className="hidden text-[11px] text-muted-foreground lg:inline">Bklit · çevrimdışı</span>
        </div>
        <span className="h-5 w-px bg-border" />
        <button className="btn" onClick={undo} disabled={!canUndo} title="Geri al (Ctrl+Z)" data-act="undo">
          <Undo2 size={14} />
        </button>
        <button className="btn" onClick={redo} disabled={!canRedo} title="Yinele (Ctrl+Shift+Z)" data-act="redo">
          <Redo2 size={14} />
        </button>
        <span className="ml-auto" />
        <button className="btn" onClick={exportWorkspace} title="Tüm grafikleri JSON olarak indir (Ctrl+S)">
          <Save size={14} /> Kaydet
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="JSON çalışma alanı yükle">
          <FolderOpen size={14} /> Yükle
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
        {/* Sol: katmanlar + veri */}
        <aside className="left flex w-[300px] shrink-0 flex-col border-r border-border bg-card">
          <div className="panel-label shrink-0 px-3 pt-2.5 pb-1">Katmanlar</div>
          <div className="flex min-h-0 flex-col" style={{ height: layerHeight }}>
            <LayersPanel
              spec={active}
              selectedIds={sahneSecimi(secim)}
              onSelect={(ids) => setSecim(sahnedenSecim(ids))}
              onChange={updateChart}
            />
          </div>
          <div
            className="split-handle shrink-0"
            onPointerDown={splitDrag(layerHeight, setLayerHeight, "layerHeight")}
            title="Katman listesini yeniden boyutlandır"
          />
          <div className={`veri-panel flex min-h-0 flex-1 flex-col${veriTam ? " veri-tam" : ""}`}>
            <div className="panel-label flex shrink-0 items-center justify-between px-3 pb-1">
              <span>Veri</span>
              <button
                className="icon-btn"
                data-veri-tam
                aria-pressed={veriTam}
                title={veriTam ? "Küçült (Esc)" : "Tam ekran"}
                onClick={() => setVeriTam((v) => !v)}
              >
                {veriTam ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
              {/* Bir adı değiştirmek elle sıradaki ve vurgudaki karşılığını da değiştirir. */}
              <DataGrid kind={active.kind} data={active.data} onChange={(data) => updateChart(adlariTasi(active, data))} />
            </div>
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
          <div ref={stageRef} className="stage min-h-0 flex-1 overflow-auto" data-arac={arac} onPointerDown={onStagePointerDown}>
            {/* Seçim aracı dışındaki her kipte süsleme kutuları tıklamayı
                almıyor. Tek işaret imlecin değişmesiydi; `H`'ye basıp unutan
                kullanıcı için bu "hiçbir şey seçilmiyor" demek oluyordu. */}
            {arac !== "sec" && (
              <div className="arac-kip">
                <span>
                  {arac === "el" ? "Kaydırma aracı" : arac === "metin" ? "Metin aracı" : "Bağlantı aracı"}
                  <kbd>Esc</kbd>
                </span>
              </div>
            )}
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
                // `inspect` sınıfı yalnız sahne sarmalayıcısında — ChartCard'ın
                // kendisine asla: aynı DOM dışa aktarılıyor, hover çerçevesi
                // PNG'ye sızmasın.
                className="inspect"
                data-sel={secim.tur === "parca" ? secim.part : secim.tur === "oge" ? "oge" : undefined}
                onClick={onStageClick}
                style={{
                  position: "relative",
                  width: active.options.width * scale,
                  height: active.options.height * scale,
                  boxShadow: "0 12px 40px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08)",
                  borderRadius: 2,
                }}
              >
                <ChartCard
                  // Sürüklerken yer açan önizleme; bırakınca kayıtlı spec geri gelir.
                  spec={onizleme ?? active}
                  theme={ws.theme}
                  palettes={ws.palettes}
                  transparent={ws.export.background === "transparent"}
                  // The decor panel measures this card to seed free-layout boxes.
                  className="stage-card"
                  style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
                />
                <DecorStage
                  spec={active}
                  scale={scale}
                  selectedIds={sahneSecimi(secim)}
                  onSelect={(ids) => setSecim(sahnedenSecim(ids))}
                  onChange={updateChart}
                  arac={arac}
                  onArac={setArac}
                />
                <SiraSahnesi
                  spec={active}
                  cizilen={onizleme ?? active}
                  scale={scale}
                  secim={secim}
                  onSecim={setSecim}
                  onChange={updateChart}
                  onBirak={siraBirak}
                  onOnizleme={setOnizleme}
                  arac={arac}
                  uzerinde={uzerinde}
                />
              </div>
            </div>
          </div>
          {message && (
            <div className="pointer-events-none absolute bottom-[104px] left-1/2 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] shadow">
              {message}
            </div>
          )}
          <Toolbar
            arac={arac}
            onArac={setArac}
            serbest={active.yerlesim.serbest}
            onSerbest={(on) => updateChart(setFreeLayout(active, on))}
            ekle={
              <SectionScope show={["galeri"]}>
                <DecorPanel
                  spec={active}
                  theme={ws.theme}
                  palettes={ws.palettes}
                  selectedIds={sahneSecimi(secim)}
                  onSelect={(ids) => setSecim(sahnedenSecim(ids))}
                  onChange={updateChart}
                />
              </SectionScope>
            }
            renk={
              <SectionScope show={["palet", "seri"]}>
              <ColorsPanel
                spec={active}
                theme={ws.theme}
                seriesNames={seriesNames}
                palettes={ws.palettes}
                onPalettes={(palettes) => commit((w) => ({ ...w, palettes }))}
                onChange={updateChart}
              />
              </SectionScope>
            }
            disa={
              <SectionScope show={["png", "svg", "pptx", "json"]}>
              <ExportPanel
                scale={ws.export.scale}
                background={ws.export.background}
                width={active.options.width}
                height={active.options.height}
                busy={busy}
                onScale={(sc) => setWs((w) => ({ ...w, export: { ...w.export, scale: sc } }))}
                onBackground={(b) => setWs((w) => ({ ...w, export: { ...w.export, background: b } }))}
                onDownload={exportPng}
                onCopy={copyPng}
                onSvg={exportSvg}
                onSvgCopy={copySvg}
                onAllPng={() => exportAll("png")}
                onAllSvg={() => exportAll("svg")}
                onPptx={() => exportPptx(false)}
                onPptxAll={() => exportPptx(true)}
                pptxScale={ws.export.pptxScale}
                onPptxScale={(pptxScale) => setWs((w) => ({ ...w, export: { ...w.export, pptxScale } }))}
                pptxSlayt={ws.export.pptxSlayt}
                onPptxSlayt={(pptxSlayt) => setWs((w) => ({ ...w, export: { ...w.export, pptxSlayt } }))}
                onSaveJson={exportWorkspace}
                onLoadJson={() => fileRef.current?.click()}
                chartCount={ws.charts.length}
                message={message}
              />
              </SectionScope>
            }
          />
          <ChartStrip
            charts={ws.charts}
            activeId={active.id}
            thumbs={thumbs}
            previews={turResimleri}
            onPreviewHover={onTurHover}
            onSelect={(id) => setWs((w) => ({ ...w, activeId: id }))}
            onRename={(id, name) => {
              const c = ws.charts.find((x) => x.id === id);
              if (c) updateChart({ ...c, name });
            }}
            onDuplicate={duplicateChart}
            onDelete={deleteChart}
            onMove={moveChart}
            onReorder={reorderCharts}
            onAdd={addChart}
          />
        </main>

        {/* Sağ: seçili öğenin özellikleri */}
        <aside className="right flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
          <Inspector
            secim={secim}
            spec={active}
            theme={ws.theme}
            palettes={ws.palettes}
            previews={turResimleri}
            onPreviewHover={onTurHover}
            onSecim={setSecim}
            onChange={updateChart}
            onSira={siraBirak}
            onUzerinde={setUzerinde}
            bicem={{
              pano: bicemPano,
              kartSayisi: ws.charts.length,
              onKopyala: bicemKopyala,
              onYapistir: bicemYapistir,
              onHepsine: bicemHepsine,
            }}
          />
        </aside>
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
