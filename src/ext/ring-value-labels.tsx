/**
 * Halka ve ısı takvimi için değer etiketleri.
 *
 * İkisi de Bklit'in kartezyen bağlamını kullanmıyor, kendi bağlamları var; o
 * yüzden `value-labels.tsx`ten ayrı duruyorlar. Her ikisi de kendi grafiğinin
 * SVG'sine doğrudan çocuk olarak giriyor: `RingChart` `RingCenter` dışındaki
 * her çocuğu, `HeatmapChart` da çocuklarını kenar boşluğu kaydırmasının içine
 * koyuyor.
 */
import { useHeatmap } from "@/charts/heatmap/heatmap-context";
import { useRingStable } from "@/charts/ring-context";
import { formatNumber, type NumberFormatSpec } from "@/lib/format";
import { contrastText } from "@/viz/common";

/**
 * Halka değerleri — her yayın **ucunda**, ilerlediği noktada.
 *
 * Bu grafik bir pasta değil, iç içe ilerleme yayları: her halkanın kendi
 * `maxValue`i var, yani "dilim ortası" diye bir yer yok. Sayının anlamlı
 * durduğu tek yer yayın bittiği nokta.
 */
export function RingValueLabels({ format, share, size }: { format: NumberFormatSpec; share: boolean; size: number }) {
  const { data, center, startAngle, endAngle, getRingRadii, getColor } = useRingStable();
  const sweep = endAngle - startAngle;

  return (
    <g className="ring-value-labels" aria-hidden>
      {data.map((d, i) => {
        const max = d.maxValue || 1;
        const frac = Math.max(0, Math.min(1, d.value / max));
        if (frac <= 0.02) return null;
        const a = startAngle + sweep * frac;
        const { innerRadius, outerRadius } = getRingRadii(i);
        const r = (innerRadius + outerRadius) / 2;
        // SVG'de 0° yukarı bakıyor ve açı saat yönünde artıyor.
        const x = center + Math.sin(a) * r;
        const y = center - Math.cos(a) * r;
        const text = share ? `%${Math.round(frac * 100)}` : formatNumber(d.value, format);
        const band = outerRadius - innerRadius;
        return (
          <text
            key={`${d.label}-${i}`}
            className="viz-value"
            data-part="value"
            x={x}
            y={y}
            dy="0.34em"
            fontSize={Math.min(size, Math.max(8, band - 4))}
            textAnchor="middle"
            fill={contrastText(getColor(i))}
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}

/** Isı takvimi hücre değerleri — hücre yazıyı taşıyacak kadar genişse. */
export function HeatmapValueLabels({ format, size }: { format: NumberFormatSpec; size: number }) {
  const { data, xScale, yScale, binWidth, binHeight, fillScale } = useHeatmap();
  if (binWidth < 16 || binHeight < 12) return null;
  const fs = Math.min(size, binHeight - 4, binWidth / 2);

  return (
    <g className="heatmap-value-labels" aria-hidden>
      {data.map((col, ci) =>
        col.bins.map((bin, ri) => {
          if (bin.count == null || bin.count === 0) return null;
          const x = xScale(ci) + binWidth / 2;
          const y = yScale(ri) + binHeight / 2;
          return (
            <text
              key={`${ci}-${ri}`}
              className="viz-value"
              data-part="value"
              x={x}
              y={y}
              dy="0.34em"
              fontSize={fs}
              textAnchor="middle"
              fill={contrastText(fillScale(bin.count))}
            >
              {formatNumber(bin.count, format)}
            </text>
          );
        })
      )}
    </g>
  );
}
