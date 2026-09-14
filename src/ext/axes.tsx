/**
 * Axis label layers for Bklit's cartesian charts.
 *
 * Bklit ships grid lines but no numeric tick labels (its docs style is
 * chrome-less). Slides need readable axes, so these components consume the
 * same chart context `Grid` does and draw `<text>` into the margin. Their
 * displayName is one Bklit's clip classifier already knows ("XAxis" /
 * "YAxis" / "BarXAxis"), which keeps them out of the series reveal clip.
 */
import { useChartStable, useYScale } from "@/charts/chart-context";
import { formatDate, formatTick, type DateGranularity, type Locale, type NumberFormatSpec } from "@/lib/format";
import type { TickAngle } from "@/lib/spec";

const TEXT_CLASS = "chart-axis-text";

/**
 * Eğik etiket. Dönme merkezi metnin hizalandığı nokta: 45 derecede sağ uç
 * kategorinin ortasına çakılı kalır, yoksa eğilen yazı çubuğundan kayıyor.
 */
function Tick({
  x,
  y,
  angle,
  children,
  anchor = "middle",
}: {
  x: number;
  y: number;
  angle: 0 | 45 | 90;
  children: React.ReactNode;
  anchor?: "start" | "middle" | "end";
}) {
  if (angle === 0) {
    return (
      <text className={TEXT_CLASS} x={x} y={y} textAnchor={anchor}>
        {children}
      </text>
    );
  }
  return (
    <text className={TEXT_CLASS} x={x} y={y} textAnchor="end" transform={`rotate(-${angle} ${x} ${y})`}>
      {children}
    </text>
  );
}

/** Eksen adı — değer ekseninde döndürülmüş, kategori ekseninde düz. */
function AxisTitle({ text, x, y, rotate }: { text: string; x: number; y: number; rotate?: boolean }) {
  if (!text) return null;
  return (
    <text
      className={TEXT_CLASS}
      x={x}
      y={y}
      textAnchor="middle"
      fontWeight={600}
      transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
    >
      {text}
    </text>
  );
}

/**
 * "auto" açısını çöz: etiketler yan yana sığmıyorsa eğ.
 *
 * Kaba bir genişlik tahmini yeterli (11 px yazıda karakter ~6,2 px); amaç
 * çakışmayı matematiksel olarak imkânsız kılmak değil, hangi açının daha
 * okunur olduğuna karar vermek.
 */
export function resolveAngle(angle: TickAngle, slot: number, longestChars: number): 0 | 45 | 90 {
  if (angle !== "auto") return angle;
  const need = longestChars * 6.2 + 6;
  if (need <= slot) return 0;
  return need <= slot * 2.2 ? 45 : 90;
}

/** Eğik etiketin alt kenar boşluğuna eklediği yükseklik. */
export function tickOverhang(angle: 0 | 45 | 90, longestChars: number): number {
  if (angle === 0) return 0;
  const len = longestChars * 6.2;
  return Math.min(120, Math.round(angle === 45 ? len * 0.72 : len));
}

function niceTicks(scale: { ticks?: (n: number) => number[]; domain: () => number[] }, n: number): number[] {
  const ticks = scale.ticks ? scale.ticks(n) : [];
  return ticks.length > 0 ? ticks : scale.domain();
}

/* ---------------- numeric value axis (left) ---------------- */

export interface YAxisProps {
  numTicks?: number;
  format: NumberFormatSpec;
  yAxisId?: string | number;
  title?: string;
}

export function YAxis({ numTicks = 5, format, yAxisId, title = "" }: YAxisProps) {
  const { innerHeight, orientation, margin } = useChartStable();
  const yScale = useYScale(yAxisId);
  // Horizontal bar charts put the value scale on x — see BarValueAxis.
  if (orientation === "horizontal") return null;
  const ticks = niceTicks(yScale as never, numTicks);
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : undefined;
  return (
    <g className="chart-y-axis" aria-hidden>
      {ticks.map((t) => {
        const y = yScale(t);
        if (y == null || !Number.isFinite(y) || y < -1 || y > innerHeight + 1) return null;
        return (
          <text className={TEXT_CLASS} key={t} x={-10} y={y} dy="0.32em" textAnchor="end">
            {formatTick(t, format, step)}
          </text>
        );
      })}
      <AxisTitle text={title} x={-margin.left + 12} y={innerHeight / 2} rotate />
    </g>
  );
}
YAxis.displayName = "YAxis";

/* ---------------- time / categorical x axis (bottom) ---------------- */

export interface XAxisProps {
  labels: string[];
  xIsDate: boolean;
  locale: Locale;
  granularity: DateGranularity;
  spanMs: number;
  /** Minimum px between two labels before thinning kicks in. */
  minGap?: number;
  angle?: 0 | 45 | 90;
  title?: string;
}

export function XAxis({ labels, xIsDate, locale, granularity, spanMs, minGap = 56, angle = 0, title = "" }: XAxisProps) {
  const { xScale, innerWidth, innerHeight, renderData, data, xAccessor, margin } = useChartStable();
  const source = data.length > 0 ? data : renderData;
  const points = source.map((d, i) => ({
    x: xScale(xAccessor(d)) ?? 0,
    label: xIsDate ? formatDate(xAccessor(d), locale, granularity, spanMs) : (labels[i] ?? String(d.x ?? "")),
  }));
  const every = Math.max(1, Math.ceil((points.length * minGap) / Math.max(innerWidth, 1)));
  const shown = points.filter((_, i) => i % every === 0 || (every > 1 && i === points.length - 1 && (points.length - 1) % every > every / 2));
  // Collapse repeated date labels (e.g. monthly data labelled by year).
  const dedup = shown.filter((p, i) => i === 0 || p.label !== shown[i - 1].label);
  return (
    <g className="chart-x-axis" aria-hidden>
      {dedup.map((p, i) => {
        const anchor = p.x < 6 ? "start" : p.x > innerWidth - 6 ? "end" : "middle";
        return (
          <Tick key={`${p.label}-${i}`} x={p.x} y={innerHeight + 18} angle={angle} anchor={anchor}>
            {p.label}
          </Tick>
        );
      })}
      <AxisTitle text={title} x={innerWidth / 2} y={innerHeight + margin.bottom - 6} />
    </g>
  );
}
XAxis.displayName = "XAxis";

/* ---------------- bar category axis (bottom, vertical bars) ---------------- */

export function BarXAxis({ angle = 0, title = "" }: { angle?: 0 | 45 | 90; title?: string } = {}) {
  const { barScale, barXAccessor, data, innerHeight, innerWidth, orientation, margin } = useChartStable();
  if (!barScale || !barXAccessor || orientation === "horizontal") return null;
  const bw = barScale.bandwidth();
  // Düz yazı etiket bandına sığmak zorunda; eğik yazıda kısaltmaya gerek yok,
  // aşağı doğru yeri var (kenar boşluğu `tickOverhang` ile büyütülüyor).
  const maxChars = angle === 0 ? Math.max(3, Math.floor((barScale.step() || 60) / 6.2)) : 28;
  return (
    <g className="chart-bar-x-axis" aria-hidden>
      {data.map((d, i) => {
        const label = barXAccessor(d);
        const x = (barScale(label) ?? 0) + bw / 2;
        if (x < 0 || x > innerWidth) return null;
        const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
        return (
          <Tick key={`${label}-${i}`} x={x} y={innerHeight + 18} angle={angle}>
            <title>{label}</title>
            {text}
          </Tick>
        );
      })}
      <AxisTitle text={title} x={innerWidth / 2} y={innerHeight + margin.bottom - 6} />
    </g>
  );
}
BarXAxis.displayName = "BarXAxis";

/* ---------------- value axis along the bottom (horizontal bars) ---------------- */

export interface BarValueAxisProps {
  numTicks?: number;
  format: NumberFormatSpec;
  title?: string;
}

export function BarValueAxis({ numTicks = 5, format, title = "" }: BarValueAxisProps) {
  const { orientation, innerHeight, innerWidth, margin } = useChartStable();
  const valueScale = useYScale();
  if (orientation !== "horizontal") return null;
  const ticks = niceTicks(valueScale as never, numTicks);
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : undefined;
  return (
    <g className="chart-bar-value-axis" aria-hidden>
      {ticks.map((t) => {
        const x = valueScale(t);
        if (x == null || !Number.isFinite(x) || x < -1 || x > innerWidth + 1) return null;
        const anchor = x < 6 ? "start" : x > innerWidth - 6 ? "end" : "middle";
        return (
          <text className={TEXT_CLASS} key={t} x={x} y={innerHeight + 18} textAnchor={anchor}>
            {formatTick(t, format, step)}
          </text>
        );
      })}
      <AxisTitle text={title} x={innerWidth / 2} y={innerHeight + margin.bottom - 6} />
    </g>
  );
}
BarValueAxis.displayName = "XAxis";
