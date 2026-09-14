import type { ReactNode } from "react";

import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "@/charts/legend";
import { formatNumber } from "@/lib/format";
import type { ChartSpec } from "@/lib/spec";

export interface LegendSpec {
  label: string;
  value: number;
  color: string;
  maxValue?: number;
}

/**
 * Gösterge + çizim alanı yerleşimi. ChartCard'dan buraya alındı: hem Bklit
 * grafikleri hem `src/viz/` grafikleri aynı göstergeyi kullanıyor ve
 * ChartCard ↔ viz arasında döngüsel import olmasın diye ortak modülde durur.
 */
export function WithLegend({
  spec,
  items,
  children,
  hoveredIndex,
  onHoverChange,
}: {
  spec: ChartSpec;
  items: LegendSpec[];
  children: ReactNode;
  hoveredIndex?: number | null;
  onHoverChange?: (i: number | null) => void;
}) {
  const { options: o } = spec;
  const show = o.legend && items.length > 0;
  const fmt = (v: number) => formatNumber(v, o.format);
  const legend = show ? (
    <Legend
      // Sahnede tıkla-seç bunu okuyor; dışa aktarım öznitelikleri koruyor.
      data-part="legend"
      items={items}
      hoveredIndex={hoveredIndex}
      onHoverChange={onHoverChange}
      className={
        o.legendPosition === "right"
          ? "flex flex-col gap-1.5 justify-center min-w-[120px] max-w-[220px]"
          : "flex flex-row flex-wrap gap-x-5 gap-y-1.5 justify-center"
      }
    >
      <LegendItem className="flex items-center gap-2 px-0 py-0">
        <LegendMarker className="h-2.5 w-2.5" />
        <LegendLabel className="text-[13px] font-medium" />
        {o.legendValues && (
          <LegendValue className="text-[13px] tabular-nums text-legend-muted-foreground" formatValue={fmt} />
        )}
      </LegendItem>
    </Legend>
  ) : null;

  const gap = o.chartInset;
  if (o.legendPosition === "right") {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: gap * 2 }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>{children}</div>
        {legend}
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap }}>
      {o.legendPosition === "top" && legend}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      {o.legendPosition === "bottom" && legend}
    </div>
  );
}
