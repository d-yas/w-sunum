/**
 * Tür seçicideki örnek çizimler.
 *
 * Küçük resimlerle (`thumbnails.ts`) aynı hattan geçiyorlar: örnek veriyle
 * kurulmuş bir kart, dışa aktarımın kendi kodunca rasterleştiriliyor. Gerekçesi
 * de aynı — sayfada ikinci bir canlı grafik ağacı açmak `url(#…)` kimliklerini
 * çakıştırıyor ve sahnedeki grafiği bozuyor.
 *
 * Üretim tembel: kutu ilk açıldığında başlıyor, tema başına bir kez yapılıyor
 * ve fareyle üstünde durulan tür sıranın başına alınıyor — kullanıcı hangi
 * türe bakıyorsa önce o hazırlanıyor.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { snapshotElement } from "./export-png";
import { KIND_GROUPS, newChart, type ChartKind, type ChartSpec, type Theme } from "./spec";

export type KindPreviews = Partial<Record<ChartKind, string>>;

type RenderStatic = (fn: (node: HTMLElement) => Promise<void>, spec: ChartSpec) => Promise<void>;

/** Izgaradaki okuma sırası — üretim de aynı sırayı izliyor. */
const SIRA: ChartKind[] = KIND_GROUPS.flatMap((g) => g.kinds);

/** Örnek kart: animasyon ve fare vurgusu kapalı, kendi örnek verisiyle. */
function ornek(kind: ChartKind): ChartSpec {
  const spec = newChart(kind, 1);
  return { ...spec, options: { ...spec.options, animate: false, hover: false } };
}

export function useKindPreviews(renderStatic: RenderStatic, theme: Theme, enabled: boolean, paused: boolean) {
  const [previews, setPreviews] = useState<KindPreviews>({});
  /** Üretilmiş object URL'ler — tema değişince bırakılıyorlar. */
  const urls = useRef<KindPreviews>({});
  /** Bu temada üretimi bitmiş türler. */
  const done = useRef<Set<ChartKind>>(new Set());
  const running = useRef(false);
  const oncelik = useRef<ChartKind | null>(null);
  const temaRef = useRef(theme);

  const onHover = useCallback((kind: ChartKind | null) => {
    oncelik.current = kind;
  }, []);

  // Tema değişince eldeki resimler yanlış: hepsi bırakılıp baştan üretiliyor.
  useEffect(() => {
    if (temaRef.current === theme) return;
    temaRef.current = theme;
    for (const u of Object.values(urls.current)) if (u) URL.revokeObjectURL(u);
    urls.current = {};
    done.current = new Set();
    setPreviews({});
  }, [theme]);

  useEffect(() => {
    if (!enabled || paused || running.current) return;
    let iptal = false;
    running.current = true;
    void (async () => {
      try {
        while (!iptal) {
          const tema = temaRef.current;
          // Üstünde durulan tür sıranın başına: kullanıcı ona bakıyor.
          const sira = SIRA.filter((k) => !done.current.has(k));
          if (sira.length === 0) break;
          const istek = oncelik.current;
          const kind = istek && sira.includes(istek) ? istek : sira[0];
          try {
            await renderStatic(async (node) => {
              const blob = await snapshotElement(node, { scale: 0.35, background: null });
              if (iptal || temaRef.current !== tema) return;
              const url = URL.createObjectURL(blob);
              urls.current[kind] = url;
              setPreviews((p) => ({ ...p, [kind]: url }));
            }, ornek(kind));
          } catch {
            // Tek bir türün resmi çıkmazsa kutu o türü ikonla gösterir.
          }
          done.current.add(kind);
          // Sıradaki türe geçmeden tarayıcıya nefes ver.
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        running.current = false;
      }
    })();
    return () => {
      iptal = true;
    };
  }, [enabled, paused, renderStatic, theme]);

  useEffect(() => () => Object.values(urls.current).forEach((u) => u && URL.revokeObjectURL(u)), []);

  return { previews, onHover };
}
