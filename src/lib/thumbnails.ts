/**
 * Sol listedeki küçük resimler.
 *
 * Küçük resim canlı bir `ChartCard` değil, **gerçek dışa aktarım hattından
 * geçmiş bir PNG**. İki gerekçe:
 *
 * 1. `src/charts/area-chart.tsx` klip yolu kimliğini sabit yazıyor
 *    (`chart-area-grow-clip`). Sayfada ikinci bir canlı AreaChart olursa
 *    `url(#…)` ilk eşleşmeye bağlanır ve sahnedeki grafik küçük resmin
 *    genişliğinde kırpılır.
 * 2. On tane canlı visx/Bklit ağacı (her biri kendi ResizeObserver'ı ve
 *    animasyonuyla) bir düzenleme başına bir 0,25× rasterleştirmeden pahalı.
 *
 * Yan faydası: küçük resim tam olarak "PNG indir"in ürettiği şey, yani listede
 * gördüğünüz çıktının kendisi.
 */
import { useEffect, useRef, useState } from "react";

import { snapshotElement } from "./export-png";
import type { ChartSpec, Workspace } from "./spec";

export type Thumbs = Record<string, string>;

type RenderStatic = (fn: (node: HTMLElement) => Promise<void>, spec: ChartSpec) => Promise<void>;

/** Bir grafiğin görünümünü belirleyen her şeyin özeti; değişirse resim eskir. */
function keyOf(spec: ChartSpec, ws: Workspace): string {
  return hash(JSON.stringify([spec, ws.theme, ws.palettes, ws.export.background]));
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function useThumbnails(ws: Workspace, renderStatic: RenderStatic, paused: boolean): Thumbs {
  const [thumbs, setThumbs] = useState<Thumbs>({});
  /** id → o resmin üretildiği anahtar. */
  const done = useRef<Record<string, string>>({});
  const urls = useRef<Record<string, string>>({});
  const running = useRef(false);

  // Aktif grafik yazarken her tuşta yeniden çizmemek için kuyruk gecikmeli
  // başlar; ekran dışı kart ~0,4 sn sürüyor, her karakterde bir tanesi
  // yazmayı hissedilir ölçüde ağırlaştırırdı.
  useEffect(() => {
    if (paused) return;
    const stale = ws.charts.filter((c) => done.current[c.id] !== keyOf(c, ws));
    if (stale.length === 0) return;
    const t = setTimeout(() => void drain(), 600);
    return () => clearTimeout(t);

    async function drain() {
      if (running.current) return;
      running.current = true;
      try {
        for (const spec of ws.charts) {
          const key = keyOf(spec, ws);
          if (done.current[spec.id] === key) continue;
          try {
            await renderStatic(async (node) => {
              const blob = await snapshotElement(node, { scale: 0.25, background: null });
              const url = URL.createObjectURL(blob);
              const old = urls.current[spec.id];
              urls.current[spec.id] = url;
              done.current[spec.id] = key;
              setThumbs((t) => ({ ...t, [spec.id]: url }));
              if (old) URL.revokeObjectURL(old);
            }, spec);
          } catch {
            // Tek bir grafiğin resmi çıkmazsa liste ikonla devam eder.
            done.current[spec.id] = key;
          }
          // Sıradaki karta geçmeden tarayıcıya nefes ver.
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        running.current = false;
      }
    }
  }, [ws, renderStatic, paused]);

  // Silinen grafiklerin URL'lerini bırak.
  useEffect(() => {
    const live = new Set(ws.charts.map((c) => c.id));
    for (const id of Object.keys(urls.current)) {
      if (live.has(id)) continue;
      URL.revokeObjectURL(urls.current[id]);
      delete urls.current[id];
      delete done.current[id];
      setThumbs((t) => {
        const next = { ...t };
        delete next[id];
        return next;
      });
    }
  }, [ws.charts]);

  useEffect(() => () => Object.values(urls.current).forEach(URL.revokeObjectURL), []);

  return thumbs;
}
