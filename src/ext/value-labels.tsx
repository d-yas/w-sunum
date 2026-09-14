/**
 * Değer etiketleri — Bklit'in çubuk ve çizgi grafiklerine.
 *
 * Bklit hiçbir markın üstüne sayı yazmıyor (belgelik üslubu kasıtlı olarak
 * çıplak); slayt ise sayıyı okunur yerde istiyor. Bu katman `src/ext/axes.tsx`
 * ile aynı yolu izliyor: aynı grafik bağlamını okuyup `<text>` çiziyor.
 *
 * `__isPostOverlay = true` işareti önemli — Bklit'in çocuk sınıflandırıcısı
 * (`chart-child-passthrough.ts`) bunu gören bileşeni **en son ve seri açılış
 * klipinin dışında** çiziyor. Klibin içinde kalsa etiketler çubukla birlikte
 * aşağıdan süzülür ve animasyon bitene kadar yarısı görünmezdi.
 *
 * Çubuk geometrisi `bar.tsx` ile aynı formülden yeniden hesaplanıyor. Bunu
 * Bklit'ten dışa vurmak `Bar`ın her çubuk için geri çağrı çağırması demekti;
 * formül ise üç satır ve iki yerde de aynı bağlamdan besleniyor.
 */
import type { ReactElement } from "react";

import { useChartStable, useYScale } from "@/charts/chart-context";
import { formatNumber, type NumberFormatSpec } from "@/lib/format";
import type { ValueLabels } from "@/lib/spec";
import { contrastText } from "@/viz/common";

/** Bklit'in gruplu çubuklar arasına koyduğu boşluk (`Bar` varsayılanı). */
const GROUP_GAP = 4;

export interface BarValueLabelsProps {
  /** Seri anahtarı ve rengi — renk "içeride" yerleşiminde kontrast için. */
  series: { key: string; color: string }[];
  mode: Exclude<ValueLabels, "auto">;
  format: NumberFormatSpec;
  size: number;
  /** Yığılı grafikte `bar.tsx`e geçirilen değer. */
  stackGap?: number;
  /** Çubuklarla aynı vurgu listesi — etiket de çubuğuyla birlikte soluklaşır. */
  highlight?: readonly string[];
}

export function BarValueLabels({ series, mode, format, size, stackGap = 0, highlight }: BarValueLabelsProps) {
  const { data, barScale, bandWidth, barXAccessor, innerHeight, innerWidth, orientation, stacked, stackOffsets } = useChartStable();
  const valueScale = useYScale();
  if (mode === "none" || !barScale || !barXAccessor || !bandWidth) return null;

  const horizontal = orientation === "horizontal";
  const n = series.length;
  const barW = stacked ? bandWidth : (bandWidth - (n > 1 ? GROUP_GAP : 0) * (n - 1)) / n;

  const out: ReactElement[] = [];
  data.forEach((d, i) => {
    const category = barXAccessor(d);
    const bandPos = barScale(category) ?? 0;
    series.forEach((s, si) => {
      const value = d[s.key];
      if (typeof value !== "number") return;
      const pos = valueScale(value) ?? 0;
      const offset = stacked && stackOffsets ? (stackOffsets.get(i)?.get(s.key) ?? 0) : 0;
      const offsetPos = stacked ? (valueScale(offset) ?? (horizontal ? 0 : innerHeight)) : null;
      const along = stacked ? bandPos : bandPos + si * (barW + (n > 1 ? GROUP_GAP : 0));
      const isLast = si === n - 1;
      const gapShift = stacked ? si * stackGap : 0;

      // Çubuğun değer eksenindeki iki ucu. Yığılı çubukta segment kendi
      // offset'inden başlıyor, yığının tabanından değil.
      let near: number;
      let far: number;
      if (horizontal) {
        const len = pos;
        near = stacked ? (offsetPos ?? 0) : 0;
        far = stacked ? near + len - (isLast ? 0 : stackGap) : len;
      } else {
        const len = innerHeight - pos;
        const base = stacked ? (offsetPos ?? innerHeight) - gapShift : innerHeight;
        far = stacked ? base - len + (isLast ? 0 : stackGap) : pos;
        near = base;
      }

      const span = Math.abs(far - near);
      const text = formatNumber(value, format);
      // İçeride yazmak segmentin yüksekliğine bağlı; sığmayan etiketi
      // yazmamak, kırpılmış bir sayı göstermekten iyi.
      const inside = mode === "inside" || (mode === "outside" && stacked);
      if (inside && span < size + 6) return;

      const cross = along + barW / 2;
      const key = `${s.key}-${category}-${i}`;
      // Soluklaşan bir çubuğun etiketi tam opak kalırsa vurgu yarım kalıyor:
      // göz rengin soluğuna değil yazının koyuluğuna takılıyor.
      const dim = highlight != null && highlight.length > 0 && !highlight.includes(String(category));
      const opacity = dim ? 0.25 : undefined;
      if (horizontal) {
        const x = inside ? (near + far) / 2 : far + 6;
        if (!inside && x > innerWidth - 4) return;
        out.push(
          <text
            key={key}
            className="viz-value"
            data-part="value"
            x={x}
            y={cross}
            dy="0.34em"
            fontSize={size}
            textAnchor={inside ? "middle" : "start"}
            opacity={opacity}
            fill={inside ? contrastText(s.color) : undefined}
          >
            {text}
          </text>
        );
      } else {
        const y = inside ? (near + far) / 2 : far - 5;
        if (!inside && y < size) return;
        out.push(
          <text
            key={key}
            className="viz-value"
            data-part="value"
            x={cross}
            y={y}
            dy={inside ? "0.34em" : undefined}
            fontSize={size}
            textAnchor="middle"
            opacity={opacity}
            fill={inside ? contrastText(s.color) : undefined}
          >
            {text}
          </text>
        );
      }
    });
  });

  return (
    <g className="chart-value-labels" aria-hidden>
      {out}
    </g>
  );
}
BarValueLabels.__isPostOverlay = true;

export interface PointValueLabelsProps {
  series: { key: string }[];
  /** "last" yalnız son noktayı yazar — çizgi kalabalığı için. */
  which: "all" | "last";
  format: NumberFormatSpec;
  size: number;
}

/** Çizgi ve alan grafiğinde nokta değerleri. */
export function PointValueLabels({ series, which, format, size }: PointValueLabelsProps) {
  const { data, xScale, xAccessor, innerWidth } = useChartStable();
  const yScale = useYScale();
  if (data.length === 0) return null;

  // Komşu etiketler çakışıyorsa seyreltiliyor: on iki aylık bir seride her
  // noktayı yazmak sayıları üst üste bindiriyor.
  const minGap = Math.max(28, size * 3);
  const every = which === "last" ? 1 : Math.max(1, Math.ceil((data.length * minGap) / Math.max(innerWidth, 1)));

  const out: ReactElement[] = [];
  series.forEach((s) => {
    data.forEach((d, i) => {
      if (which === "last" ? i !== data.length - 1 : i % every !== 0) return;
      const value = d[s.key];
      if (typeof value !== "number") return;
      const x = xScale(xAccessor(d)) ?? 0;
      const y = yScale(value) ?? 0;
      const anchor = x < 12 ? "start" : x > innerWidth - 12 ? "end" : "middle";
      out.push(
        <text key={`${s.key}-${i}`} className="viz-value" data-part="value" x={x} y={y - 8} fontSize={size} textAnchor={anchor}>
          {formatNumber(value, format)}
        </text>
      );
    });
  });

  return (
    <g className="chart-value-labels" aria-hidden>
      {out}
    </g>
  );
}
PointValueLabels.__isPostOverlay = true;
