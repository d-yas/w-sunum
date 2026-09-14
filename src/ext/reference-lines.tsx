/**
 * Referans çizgileri — hedef, eşik, ortalama.
 *
 * Dekor okuyla karıştırılmamalı: dekor kart uzayında duruyor ve veri değişince
 * yerinde kalıyor; buradaki çizgi **veri uzayında** duruyor, 120 değeri hangi
 * piksele denk gelirse oraya. Tabloyu düzenleyince kendisi yerini buluyor.
 *
 * `__isPostOverlay = true` — Bklit bunu gören katmanı en son ve açılış
 * klipinin dışında çiziyor, yani çizgi çubukların üstünde ve animasyondan
 * bağımsız duruyor.
 */
import { useChartStable, useYScale } from "@/charts/chart-context";
import { formatNumber, type NumberFormatSpec } from "@/lib/format";
import type { RefLine } from "@/lib/spec";

export function ReferenceLines({ lines, format }: { lines: RefLine[]; format: NumberFormatSpec }) {
  const { innerWidth, innerHeight, orientation } = useChartStable();
  const scale = useYScale();
  if (lines.length === 0) return null;
  const horizontal = orientation === "horizontal";

  return (
    <g className="chart-ref-lines" aria-hidden>
      {lines.map((l) => {
        const pos = scale(l.value);
        if (pos == null || !Number.isFinite(pos)) return null;
        // Ölçeğin dışına düşen bir çizgiyi çizmek, kullanıcıya eksende
        // olmayan bir değeri varmış gibi göstermek olurdu.
        if (horizontal ? pos < 0 || pos > innerWidth : pos < 0 || pos > innerHeight) return null;
        const stroke = l.color || "var(--ink-secondary)";
        const label = l.label || formatNumber(l.value, format);
        return (
          <g key={l.id} data-part="refline">
            <line
              x1={horizontal ? pos : 0}
              x2={horizontal ? pos : innerWidth}
              y1={horizontal ? 0 : pos}
              y2={horizontal ? innerHeight : pos}
              stroke={stroke}
              strokeWidth={1.25}
              strokeDasharray={l.dash ? "4 4" : undefined}
            />
            {label && (
              <text
                className="viz-strong"
                data-part="reflabel"
                x={horizontal ? pos : innerWidth}
                y={horizontal ? 10 : pos - 5}
                textAnchor="end"
                fontSize={11}
                fill={stroke}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
ReferenceLines.__isPostOverlay = true;
