import { useMemo } from "react";

import { pictoIcon } from "@/lib/chart-icons";
import { toCategoryValue } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { Empty, type VizProps } from "./common";

/**
 * Piktogram / simge dizisi — Flourish "Pictogram". Her simge `pictoUnit` kadar
 * birim; artan kısım yarım simge yerine yatay kırpılmış simgeyle gösterilir,
 * çünkü çoğu şeklin yarısı okunmuyor.
 *
 * SVG değil HTML ızgarası: ikonlar Lucide bileşenleri ve `pictoPerRow` bir
 * grid sütun sayısına doğrudan karşılık geliyor. PNG dışa aktarımı zaten
 * HTML'i `<foreignObject>` içinde rasterliyor.
 */
export function PictogramViz({ spec, colors }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCategoryValue(spec), [spec]);
  const Icon = pictoIcon(o.pictoIcon);
  const unit = Math.max(1, o.pictoUnit);
  const perRow = Math.max(1, o.pictoPerRow);

  const rows = useMemo(
    () =>
      model.items.map((item) => {
        const full = Math.floor(item.value / unit);
        const rest = (item.value % unit) / unit;
        const icons = full + (rest > 0.08 ? 1 : 0);
        return { ...item, full: Math.min(full, 600), rest, lines: Math.max(1, Math.ceil(icons / perRow)) };
      }),
    [model, unit, perRow]
  );

  if (rows.length === 0) {
    return <Empty text="Etiket ve değer girin (örn. Uzaktan ; 420)." />;
  }

  const labelWidth = Math.min(180, Math.max(90, o.width * 0.16));
  const valueWidth = 62;
  const totalLines = rows.reduce((a, r) => a + r.lines, 0);

  /**
   * Simge boyutu bütün satırlarda aynıdır — satır başına ayrı hesaplansaydı
   * az değerli satırın simgeleri büyür ve karşılaştırma bozulurdu. Hem
   * genişliğe (satır başına simge) hem yüksekliğe (toplam satır) sığar.
   */
  const size = Math.max(
    7,
    Math.min(
      34,
      (o.width - o.padding * 2 - labelWidth - valueWidth - 40) / perRow - o.pictoGap,
      (o.height * 0.62) / Math.max(1, totalLines) - o.pictoGap
    )
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.max(8, o.chartInset * 1.5),
        overflow: "hidden",
      }}
    >
      {rows.map((row, i) => {
        const color = colors[i % colors.length];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 0 }}>
            <div
              style={{
                width: labelWidth,
                flex: "0 0 auto",
                textAlign: "right",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.label}
            >
              {row.label}
            </div>
            <div
              style={{
                flex: "0 0 auto",
                display: "grid",
                gridTemplateColumns: `repeat(${perRow}, ${size}px)`,
                gap: o.pictoGap,
                justifyContent: "start",
              }}
            >
              {Array.from({ length: row.full }, (_, k) => (
                <Icon key={k} size={size} color={color} strokeWidth={1.8} />
              ))}
              {row.rest > 0.08 && (
                <span style={{ display: "block", width: size * row.rest, height: size, overflow: "hidden", lineHeight: 0 }}>
                  <Icon size={size} color={color} strokeWidth={1.8} />
                </span>
              )}
            </div>
            {o.valueLabels !== "none" && (
            <div
              style={{
                marginLeft: "auto",
                flex: "0 0 auto",
                width: valueWidth,
                fontSize: o.valueLabelSize + 1,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink-primary)",
                textAlign: "right",
              }}
            >
              {formatNumber(row.value, o.format)}
            </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--ink-muted)", textAlign: "right" }}>
        {`Her simge = ${formatNumber(unit, o.format)}`}
      </div>
    </div>
  );
}
