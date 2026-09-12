import { ParentSize } from "@visx/responsive";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import type { ChartSpec, Theme } from "@/lib/spec";

/**
 * `src/viz/` — Bklit'te karşılığı olmayan, Flourish şablonlarına denk gelen
 * grafikler. Bklit kaynağı (`src/charts/`) elden geldiğince dokunulmaz
 * kaldığı için bu türler visx ilkelleri üzerine ayrıca yazılır; kart, palet,
 * sayı biçimi ve dışa aktarım yolu ortaktır.
 */

export interface VizProps {
  spec: ChartSpec;
  colors: string[];
  isStatic: boolean;
  theme: Theme;
}

/**
 * Ölçüyü ebeveynden alır; kart hangi boyuta ayarlandıysa ona uyar.
 *
 * Konumlandırma `absolute inset-0`: `WithLegend` çizim alanını `position:
 * relative` bir kutu olarak veriyor, flex konteyner olarak değil — orada
 * `flex: 1` hiçbir şey yapmaz ve yükseklik sıfır kalır. Bklit grafikleri de
 * aynı nedenle `absolute inset-0` kullanıyor.
 */
export function VizFrame({
  children,
  minHeight = 40,
  /**
   * Varsayılan `visible`: radar eksen adları, eğim uç etiketleri ve akor
   * başlıkları çizim alanının bir tık dışına taşar. Haritada tersi gerekir —
   * izdüşüm kadrajın dışını da çizer ve kırpılmazsa kartı basar.
   */
  clip = false,
}: {
  children: (size: { width: number; height: number }) => ReactNode;
  minHeight?: number;
  clip?: boolean;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: clip ? "hidden" : undefined }}>
      <ParentSize debounceTime={0}>
        {({ width, height }) =>
          width > 0 && height > minHeight ? (
            <svg
              width={width}
              height={height}
              style={{ display: "block", overflow: clip ? "hidden" : "visible" }}
            >
              {children({ width, height })}
            </svg>
          ) : null
        }
      </ParentSize>
    </div>
  );
}

/** Giriş animasyonu; dışa aktarımda ve animasyon kapalıyken tek karede biter. */
export function Reveal({
  isStatic,
  animate,
  children,
  delay = 0,
}: {
  isStatic: boolean;
  animate: boolean;
  children: ReactNode;
  delay?: number;
}) {
  if (isStatic || !animate) return <g>{children}</g>;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay }}>
      {children}
    </motion.g>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div
      className="flex h-full items-center justify-center text-center text-[13px] text-muted-foreground"
      style={{ flex: 1, padding: "0 12%" }}
    >
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Renk yardımcıları                                                    */
/* ------------------------------------------------------------------ */

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG bağıl parlaklık; #rrggbb dışındaki değerlerde orta gri varsayar. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0.4;
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** Dolgunun üstüne yazılacak metin rengi — koyu zeminde beyaz, açıkta siyah. */
export function contrastText(background: string): string {
  return luminance(background) > 0.45 ? "#141413" : "#ffffff";
}

/** Rengi zemine doğru karıştırır; sayısal karışım (color-mix serileşmez). */
export function mix(hex: string, target: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex) || !/^#[0-9a-fA-F]{6}$/.test(target)) return hex;
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
  const t = Math.max(0, Math.min(1, amount));
  return (
    "#" +
    a
      .map((v, i) => Math.round(v + (b[i] - v) * t))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/* ------------------------------------------------------------------ */
/* Metin yardımcıları                                                   */
/* ------------------------------------------------------------------ */

/** Kaba genişlik tahmini — sistem yazı yığınında ~0.55em ortalama. */
export function textWidth(s: string, fontSize: number): number {
  return s.length * fontSize * 0.55;
}

/** Verilen genişliğe sığmazsa kısaltır. */
export function ellipsize(s: string, fontSize: number, maxWidth: number): string {
  if (textWidth(s, fontSize) <= maxWidth) return s;
  const keep = Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)) - 1);
  return s.slice(0, keep) + "…";
}

/**
 * Tema renkleri sınıf üzerinden verilir, `var()` içeren sunum niteliğiyle
 * değil: PNG dışa aktarımı her düğümün *hesaplanmış* stilini gömüyor ve
 * sınıfları siliyor, bu yüzden sınıf kesin, nitelik ise tarayıcıya bağlı.
 * Sınıf tanımları `src/index.css` içinde.
 */
export const VIZ = {
  label: "viz-label",
  value: "viz-value",
  strong: "viz-strong",
  grid: "viz-grid",
  hair: "viz-hair",
  track: "viz-track",
} as const;
