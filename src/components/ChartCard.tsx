import { curveLinear, curveMonotoneX, curveNatural, curveStepAfter } from "@visx/curve";
import { MotionConfig } from "motion/react";
import { forwardRef, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { DecorLayer } from "@/decor/DecorLayer";

import { Area } from "@/charts/area";
import { AreaChart } from "@/charts/area-chart";
import { Bar } from "@/charts/bar";
import { BarChart } from "@/charts/bar-chart";
import { BarYAxis } from "@/charts/bar-y-axis";
import { Grid } from "@/charts/grid";
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  type HeatmapLevelColors,
} from "@/charts/heatmap";
import { Ring } from "@/charts/ring";
import { RingChart } from "@/charts/ring-chart";
import { useRingHover, useRingStable } from "@/charts/ring-context";
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "@/charts/sankey";
import { StaticChartPreviewProvider } from "@/charts/static-chart-preview-context";
import { ChartTooltip, TooltipContent } from "@/charts/tooltip";
import { AccentBar, CardDecor } from "@/decor";
import { BarValueAxis, BarXAxis, XAxis, YAxis, resolveAngle, tickOverhang } from "@/ext/axes";
import { ReferenceLines } from "@/ext/reference-lines";
import { HeatmapValueLabels, RingValueLabels } from "@/ext/ring-value-labels";
import { BarValueLabels, PointValueLabels } from "@/ext/value-labels";
import { toCartesian, toHeatmap, toRing, toSankey, type CartesianModel } from "@/lib/adapters";
import { formatDateLong, formatNumber, type NumberFormatSpec } from "@/lib/format";
import { getPalette, seriesColor, type Palette } from "@/lib/palettes";
import type { SlotKey } from "@/decor/model";
import { dataShape, type ChartSpec, type Theme, type ValueLabels } from "@/lib/spec";
import { WaterfallViz, FunnelViz, MarimekkoViz } from "@/viz/columns";
import { HierarchyViz } from "@/viz/hierarchy";
import { MapViz } from "@/viz/map";
import { PictogramViz } from "@/viz/pictogram";
import { GaugeViz, RadarViz } from "@/viz/radial";
import { RelationViz } from "@/viz/relation";
import { SlopeViz } from "@/viz/slope";
import { WithLegend } from "@/viz/with-legend";
import { XYViz } from "@/viz/xy";

export interface ChartCardProps {
  spec: ChartSpec;
  theme: Theme;
  /** User-defined palettes; the built-in four need no help. */
  palettes?: Palette[];
  /** Export mode: no animation, no reveal clip, no hover. */
  static?: boolean;
  transparent?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** Static (export) renders: no reveal, no stagger — the final frame immediately. */
const INSTANT = { type: "tween", duration: 0, delay: 0 } as const;

const CURVES = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStepAfter,
  natural: curveNatural,
};

/**
 * The slide card: title block, chart, legend, note. This is the exact DOM
 * that gets rasterised — the stage and the offscreen export render the same
 * component with the same pixel size.
 */
export const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(function ChartCard(
  { spec, theme, palettes = [], static: isStatic = false, transparent = false, style, className },
  ref
) {
  const { options: o } = spec;
  const palette = getPalette(spec.paletteId, palettes);
  const seriesCount = useMemo(() => countSeries(spec), [spec]);
  const colors = useMemo(
    () => Array.from({ length: Math.max(seriesCount, 8) }, (_, i) => seriesColor(i, spec.colors, palette, theme)),
    [seriesCount, spec.colors, palette, theme]
  );

  const cssVars: Record<string, string> = {};
  colors.slice(0, 8).forEach((c, i) => {
    cssVars[`--chart-${i + 1}`] = c;
    cssVars[`--series-${i + 1}`] = c;
  });

  const body = (
    <ChartBody spec={spec} colors={colors} isStatic={isStatic} theme={theme} />
  );

  // One prefix per rendered instance. The stage card and the offscreen export
  // card are alive at the same time, and url(#id) resolves per *document*, so
  // pattern and gradient ids must not collide between the two.
  const decorUid = `d${useId().replace(/:/g, "")}`;
  const decorProps = { decor: spec.decor, w: o.width, h: o.height, uid: decorUid, colors, theme } as const;

  /**
   * Free layout: a slot with a saved box becomes absolutely positioned, and
   * everything else keeps the flow layout it always had.
   *
   * Boxes are in card space — measured from the card's outer edge, the same
   * coordinates decoration uses. No padding correction is needed: the card has
   * no border, so its padding box and its border box are the same rectangle,
   * and left:0 lands on the card's own edge.
   */
  const hiddenSlot = (key: SlotKey) => spec.yerlesim.serbest && spec.yerlesim.gizli.includes(key);
  const slot = (key: SlotKey, flow: CSSProperties): CSSProperties => {
    const box = spec.yerlesim.serbest ? spec.yerlesim.kutular[key] : undefined;
    if (!box) return flow;
    return {
      ...flow,
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      flex: "none",
      margin: 0,
      overflow: "hidden",
    };
  };

  return (
    <div
      ref={ref}
      className={`slide-card ${className ?? ""}`}
      data-transparent={transparent ? "true" : undefined}
      data-theme={theme}
      style={{
        width: o.width,
        height: o.height,
        padding: o.padding,
        ...cssVars,
        ...style,
      }}
    >
      <CardDecor width={o.width} height={o.height} options={o} colors={colors} />
      <DecorLayer {...decorProps} phase="arka" />
      {(spec.title || spec.subtitle) && !hiddenSlot("baslik") && (
        <header
          data-slot="baslik"
          style={slot("baslik", {
            position: "relative",
            zIndex: 1,
            marginBottom: o.chartInset + 4,
            display: o.decorAccentBar ? "flex" : undefined,
            gap: o.decorAccentBar ? 10 : undefined,
            alignItems: o.decorAccentBar ? "stretch" : undefined,
          })}
        >
          {o.decorAccentBar && (
            <AccentBar color={colors[0]} height={o.titleSize * (spec.subtitle ? 1.9 : 1.3)} />
          )}
          <div>
            {spec.title && (
              <div className="slide-title" style={{ fontSize: o.titleSize }}>
                {spec.title}
              </div>
            )}
            {spec.subtitle && (
              <div className="slide-subtitle" style={{ fontSize: Math.round(o.titleSize * 0.6), marginTop: 4 }}>
                {spec.subtitle}
              </div>
            )}
          </div>
        </header>
      )}
      {!hiddenSlot("grafik") && (
      <div data-slot="grafik" style={slot("grafik", { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" })}>
        {isStatic && spec.kind !== "sankey" ? (
          <MotionConfig reducedMotion="always">
            <StaticChartPreviewProvider>{body}</StaticChartPreviewProvider>
          </MotionConfig>
        ) : (
          body
        )}
      </div>
      )}
      <DecorLayer {...decorProps} phase="on" />
      {spec.note && !hiddenSlot("dipnot") && (
        <footer
          className="slide-note"
          data-slot="dipnot"
          style={slot("dipnot", { position: "relative", zIndex: 1, fontSize: Math.max(10, Math.round(o.titleSize * 0.5)), marginTop: o.chartInset })}
        >
          {spec.note}
        </footer>
      )}
    </div>
  );
});

/** Kaç renk gerekiyor — palet bu sayıya göre açılır. */
/**
 * "auto" değer etiketi ayarını türün kendi geleneğine çevir.
 *
 * Şelale ve piktogram sayıyı hep yazıyordu, diğerleri hiç yazmıyordu. `auto`
 * o davranışı koruyor; kullanıcı `none` diyerek şelaleyi de susturabiliyor,
 * `outside`/`inside` diyerek sütunu da konuşturabiliyor. Varsayılanın hiçbir
 * kartın görünümünü değiştirmemesi kasıtlı.
 */
function labelMode(spec: ChartSpec): Exclude<ValueLabels, "auto"> {
  const v = spec.options.valueLabels;
  if (v !== "auto") return v;
  return spec.kind === "waterfall" || spec.kind === "pictogram" ? "outside" : "none";
}

function countSeries(spec: ChartSpec): number {
  switch (dataShape(spec.kind)) {
    case "categoryValue":
      return spec.data.rows.filter((r) => (r[0] ?? "").trim()).length;
    case "flow":
      return new Set(spec.data.rows.flatMap((r) => [r[0], r[1]]).map((s) => (s ?? "").trim()).filter(Boolean)).size;
    case "hierarchy":
      // Renk ana gruplara dağıtılır.
      return new Set(spec.data.rows.map((r) => (r[0] ?? "").trim()).filter(Boolean)).size;
    case "xy":
      return new Set(spec.data.rows.map((r) => (r[4] ?? "").trim()).filter(Boolean)).size || 1;
    case "calendar":
    case "region":
      return 1;
    default:
      // Eğim grafiğinde çizgi satırdır, seri değil.
      if (spec.kind === "slope") return Math.max(1, spec.data.rows.filter((r) => (r[0] ?? "").trim()).length);
      // Renk kategoriye bağlıyken palet seri değil satır sayısınca açılmalı,
      // yoksa dördüncü çubuktan sonra renkler başa dönüyor.
      if (spec.options.colorBy === "category" && spec.data.columns.length === 2)
        return Math.max(1, spec.data.rows.filter((r) => (r[0] ?? "").trim()).length);
      return Math.max(1, spec.data.columns.length - 1);
  }
}

/* ------------------------------------------------------------------ */

interface BodyProps {
  spec: ChartSpec;
  colors: string[];
  isStatic: boolean;
  theme: Theme;
}

function ChartBody({ spec, colors, isStatic, theme }: BodyProps) {
  const viz = { spec, colors, isStatic, theme };
  switch (spec.kind) {
    case "line":
    case "area":
      return <CartesianTime spec={spec} colors={colors} isStatic={isStatic} />;
    case "bar":
    case "barH":
      return <Bars spec={spec} colors={colors} isStatic={isStatic} />;
    case "ring":
      return <Rings spec={spec} colors={colors} isStatic={isStatic} />;
    case "heatmap":
      return <Heat spec={spec} colors={colors} isStatic={isStatic} theme={theme} />;
    case "sankey":
      return <Flow spec={spec} colors={colors} isStatic={isStatic} />;

    /* src/viz/ — Flourish karşılıkları */
    case "treemap":
    case "sunburst":
    case "pack":
      return <HierarchyViz {...viz} />;
    case "scatter":
    case "bubble":
      return <XYViz {...viz} />;
    case "chord":
    case "network":
    case "arc":
      return <RelationViz {...viz} />;
    case "radar":
      return <RadarViz {...viz} />;
    case "gauge":
      return <GaugeViz {...viz} />;
    case "slope":
      return <SlopeViz {...viz} />;
    case "waterfall":
      return <WaterfallViz {...viz} />;
    case "funnel":
      return <FunnelViz {...viz} />;
    case "marimekko":
      return <MarimekkoViz {...viz} />;
    case "pictogram":
      return <PictogramViz {...viz} />;
    case "map":
      return <MapViz {...viz} />;
  }
}

const FILL = "absolute inset-0 h-full w-full";

/* ---------------- line / area ---------------- */

function CartesianTime({ spec, colors, isStatic }: Omit<BodyProps, "theme">) {
  const { options: o } = spec;
  const model = useMemo(() => toCartesian(spec), [spec]);
  const items = model.series.map((s, i) => ({ label: s.name, value: s.total, color: colors[i] }));
  const isArea = spec.kind === "area";
  // Dates drive spacing whenever they parse; the axis shows the user's own
  // labels unless they explicitly asked for date formatting.
  const formatAsDate = model.xIsDate && o.xMode === "date";
  const longest = model.labels.reduce((a, l) => Math.max(a, l.length), 0);
  // Tarih ekseninde etiketler kendiliğinden seyreltiliyor (XAxis minGap), o
  // yüzden eğmeye gerek yok; eğik yazı yalnız kategorik eksende iş görüyor.
  const slotGuess = Math.max(12, (o.width - o.padding * 2 - 80) / Math.max(1, model.labels.length));
  const angle = formatAsDate ? 0 : resolveAngle(o.xTickAngle, slotGuess, longest);
  const pointMode = labelMode(spec);
  const margin = {
    top: 12 + (pointMode === "none" ? 0 : o.valueLabelSize + 6),
    right: 16,
    bottom: (o.xAxis ? 30 + tickOverhang(angle, longest) : 8) + (o.xTitle ? 16 : 0),
    left: (o.yAxis ? leftMargin(model, o) : 8) + (o.yTitle ? 16 : 0),
  };

  return (
    <WithLegend spec={spec} items={items}>
      <AreaChart
        data={model.rows}
        xDataKey="date"
        aspectRatio="auto"
        className={FILL}
        margin={margin}
        animationDuration={isStatic || !o.animate ? 0 : 1100}
        enterTransition={isStatic ? INSTANT : undefined}
        revealSignature={`${spec.id}-${spec.kind}`}
        yDomain={[o.yMin, o.yMax]}
      >
        {o.grid && <Grid horizontal vertical={o.gridVertical} numTicksRows={o.yTicks} numTicksColumns={Math.min(12, model.rows.length)} />}
        {o.yAxis && <YAxis numTicks={o.yTicks} format={o.format} title={o.yTitle} />}
        {o.xAxis && (
          <XAxis
            labels={model.labels}
            xIsDate={formatAsDate}
            locale={o.format.locale}
            granularity={o.dateGranularity}
            spanMs={model.spanMs}
            angle={angle}
            title={o.xTitle}
          />
        )}
        <ReferenceLines lines={o.refLines} format={o.format} />
        {pointMode !== "none" && (
          <PointValueLabels
            series={model.series.map((s) => ({ key: s.key }))}
            which={o.valueLabelPoints}
            format={o.format}
            size={o.valueLabelSize}
          />
        )}
        {model.series.map((s, i) => (
          <Area
            key={s.key}
            dataKey={s.key}
            stroke={colors[i]}
            fill={colors[i]}
            fillOpacity={isArea ? o.areaOpacity : 0}
            // Gradyan açıkken dolgu tabana doğru saydamlaşır; kapalıyken düz
            // bir renk olur. Bklit'te "bitiş opaklığı" tersten ifade edildiği
            // için açık hâl 0, kapalı hâl dolgunun kendi opaklığı.
            gradientToOpacity={o.areaGradient ? 0 : o.areaOpacity}
            strokeWidth={o.strokeWidth}
            curve={CURVES[o.curve]}
            showMarkers={o.showMarkers}
            animate={!isStatic && o.animate}
            // Tahmin kesiği: kullanıcı 1 tabanlı satır numarası yazıyor,
            // Bklit 0 tabanlı dizin bekliyor.
            dashFromIndex={o.forecastFrom == null ? undefined : Math.max(0, o.forecastFrom - 1)}
          />
        ))}
        {!isStatic && o.hover && (
          <ChartTooltip
            showDatePill={false}
            content={({ point }) => (
              <TooltipContent
                title={formatAsDate ? formatDateLong(point.date as Date, o.format.locale) : String(point.x ?? "")}
                rows={model.series.map((s, i) => ({
                  label: s.name,
                  value: formatNumber(Number(point[s.key] ?? 0), o.format),
                  color: colors[i],
                }))}
              />
            )}
          />
        )}
      </AreaChart>
    </WithLegend>
  );
}

function leftMargin(model: CartesianModel, o: ChartSpec["options"]): number {
  let max = 0;
  for (const s of model.series) for (const v of s.values) if (v != null && Math.abs(v) > max) max = Math.abs(v);
  const sample = formatNumber(max * 1.1, o.format);
  return Math.min(120, Math.max(40, sample.length * 7.2 + 18));
}

/* ---------------- bars ---------------- */

function Bars({ spec, colors, isStatic }: Omit<BodyProps, "theme">) {
  const { options: o } = spec;
  const model = useMemo(() => toCartesian(spec), [spec]);
  const horizontal = spec.kind === "barH";
  // Tek serili bir grafikte renk kategoriye bağlanabiliyor; o zaman gösterge de
  // serileri değil kategorileri listeler, yoksa tek bir kutuyla kalır.
  const byCategory = o.colorBy === "category" && model.series.length === 1;
  const items = byCategory
    ? model.labels.map((label, i) => ({ label, value: Number(model.rows[i]?.[model.series[0].key] ?? 0), color: colors[i % colors.length] }))
    : model.series.map((s, i) => ({ label: s.name, value: s.total, color: colors[i] }));
  const longest = model.labels.reduce((a, l) => Math.max(a, l.length), 0);
  // Etiket açısı kenar boşluğunu belirliyor, kenar boşluğu da bandı: ikisi
  // birbirine bağlı. Döngüyü kesmek için açı bandın *kenar boşluğundan
  // bağımsız* kaba tahminiyle çözülüyor (çizim genişliği eksi sol/sağ pay),
  // sonra boşluk ona göre büyütülüyor.
  const slotGuess = Math.max(12, (o.width - o.padding * 2 - 80) / Math.max(1, model.labels.length));
  const angle = horizontal ? 0 : resolveAngle(o.xTickAngle, slotGuess, longest);
  const mode = labelMode(spec);
  const xBand = o.xAxis ? 30 + tickOverhang(angle, longest) : 8;
  const margin = horizontal
    ? {
        top: 8,
        right: 16,
        bottom: (o.xAxis ? 30 : 8) + (o.xTitle ? 16 : 0),
        left: Math.min(160, Math.max(56, longest * 7 + 16)) + (o.yTitle ? 16 : 0),
      }
    : {
        top: 12,
        right: 16,
        bottom: xBand + (o.xTitle ? 16 : 0),
        left: (o.yAxis ? leftMargin(model, o) : 8) + (o.yTitle ? 16 : 0),
      };
  // Dışarıdaki etiket çubuğun tepesinin üstüne yazılıyor; üst kenar boşluğu
  // büyümezse en yüksek çubuğun etiketi çizim alanının dışında kalıyor.
  if (mode === "outside") {
    if (horizontal) margin.right += o.valueLabelSize * 2.6;
    else margin.top += o.valueLabelSize + 6;
  }

  return (
    <WithLegend spec={spec} items={items}>
      <BarChart
        data={model.rows}
        xDataKey="x"
        aspectRatio="auto"
        className={FILL}
        margin={margin}
        orientation={horizontal ? "horizontal" : "vertical"}
        stacked={o.stacked}
        stackGap={o.stacked ? 2 : 0}
        barGap={o.barGap}
        barWidth={o.barWidth ?? undefined}
        animationDuration={isStatic || !o.animate ? 0 : 1100}
        enterTransition={isStatic ? INSTANT : undefined}
        revealSignature={`${spec.id}-${spec.kind}-${o.stacked}`}
        valueDomain={[o.yMin, o.yMax]}
      >
        {o.grid && (
          <Grid
            horizontal={!horizontal}
            vertical={horizontal || o.gridVertical}
            numTicksRows={o.yTicks}
            numTicksColumns={o.yTicks}
          />
        )}
        {model.series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={colors[i]}
            // Bklit sayısal `lineCap`i olduğu gibi yarıçap sayar; bir çubuğun
            // yarısını aşan yarıçap SVG'de kapsülü bozuyor, o yüzden kırpılır.
            lineCap={Math.min(o.barRadius, (o.barWidth ?? 40) / 2)}
            fadedOpacity={0.25}
            highlightCategories={o.highlight}
            fillFor={byCategory ? (_c, bi) => colors[bi % colors.length] : undefined}
          />
        ))}
        <ReferenceLines lines={o.refLines} format={o.format} />
        {mode !== "none" && (
          <BarValueLabels
            series={model.series.map((s, i) => ({ key: s.key, color: byCategory ? colors[0] : colors[i] }))}
            mode={mode}
            format={o.format}
            size={o.valueLabelSize}
            stackGap={o.stacked ? 2 : 0}
            highlight={o.highlight}
          />
        )}
        {horizontal ? (
          <>
            <BarYAxis />
            {o.xAxis && <BarValueAxis numTicks={o.yTicks} format={o.format} title={o.xTitle} />}
          </>
        ) : (
          <>
            {o.yAxis && <YAxis numTicks={o.yTicks} format={o.format} title={o.yTitle} />}
            {o.xAxis && <BarXAxis angle={angle} title={o.xTitle} />}
          </>
        )}
        {!isStatic && o.hover && (
          <ChartTooltip
            showDatePill={false}
            content={({ point }) => (
              <TooltipContent
                title={String(point.x ?? "")}
                rows={model.series.map((s, i) => ({
                  label: s.name,
                  value: formatNumber(Number(point[s.key] ?? 0), o.format),
                  color: colors[i],
                }))}
              />
            )}
          />
        )}
      </BarChart>
    </WithLegend>
  );
}

/* ---------------- rings ---------------- */

function Rings({ spec, colors, isStatic }: Omit<BodyProps, "theme">) {
  const { options: o } = spec;
  const model = useMemo(() => toRing(spec, colors), [spec, colors]);
  const [hovered, setHovered] = useState<number | null>(null);
  const items = model.data.map((d) => ({ label: d.label, value: d.value, color: d.color ?? colors[0], maxValue: d.maxValue }));
  // With hover off the ring keeps its own state but never reports it, so the
  // centre label stays on the total and no segment dims.
  const hoverOn = !isStatic && o.hover;
  const live = hoverOn ? hovered : null;
  const onHover = hoverOn ? setHovered : undefined;

  return (
    <WithLegend spec={spec} items={items} hoveredIndex={live} onHoverChange={onHover}>
      <div className={FILL} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ height: "100%", aspectRatio: "1 / 1", maxWidth: "100%", position: "relative", ["--border" as string]: "var(--ring-track)" }}>
        <RingChart
          data={model.data}
          className="h-full w-full max-h-full"
          strokeWidth={o.ringStroke}
          ringGap={o.ringGap}
          baseInnerRadius={Math.max(28, 90 - model.data.length * 6)}
          animationDuration={isStatic || !o.animate ? 0 : 1100}
          enterTransition={isStatic ? INSTANT : undefined}
          hoveredIndex={live}
          onHoverChange={onHover}
          startAngle={0}
          endAngle={Math.PI * 2}
        >
          {model.data.map((d, i) => (
            <Ring key={`${d.label}-${i}`} index={i} color={d.color} animate={!isStatic && o.animate} />
          ))}
          {labelMode(spec) !== "none" && <RingValueLabels format={o.format} share={o.ringShare} size={o.valueLabelSize} />}
          {o.ringCenter && (
            // Plain text instead of NumberFlow: its shadow DOM would not survive
            // the PNG serialisation, and a slide never needs the number to roll.
            <PlainRingCenter defaultLabel={o.ringCenterLabel || "Toplam"} titleSize={o.titleSize} format={o.format} />
          )}
        </RingChart>
        </div>
      </div>
    </WithLegend>
  );
}

/**
 * Ring centre as plain text. Bklit's RingCenter renders the number through
 * NumberFlow (a custom element with shadow DOM) whenever nothing is hovered,
 * and shadow DOM does not survive the PNG serialisation. RingChart lays any
 * non-Ring child over the SVG, so this drops straight into the same slot.
 */
function PlainRingCenter({ defaultLabel, titleSize, format }: { defaultLabel: string; titleSize: number; format: NumberFormatSpec }) {
  const { data, totalValue, baseInnerRadius } = useRingStable();
  const { hoveredIndex } = useRingHover();
  const hovered = hoveredIndex == null ? null : data[hoveredIndex];
  const value = hovered ? hovered.value : totalValue;
  const label = hovered ? hovered.label : defaultLabel;
  const size = Math.max(40, baseInnerRadius * 2 - 16);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        lineHeight: 1.1,
        overflow: "hidden",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: Math.min(Math.round(titleSize * 1.15), size / 3.2), fontVariantNumeric: "tabular-nums", color: "var(--ink-primary)" }}>
        {formatNumber(value, format)}
      </div>
      <div style={{ fontSize: Math.round(titleSize * 0.55), marginTop: 4, color: "var(--ink-muted)" }}>{label}</div>
    </div>
  );
}
// RingChart routes children into the HTML overlay by this displayName.
PlainRingCenter.displayName = "RingCenter";

/* ---------------- heatmap ---------------- */

function Heat({ spec, colors, isStatic }: BodyProps) {
  const { options: o } = spec;
  const model = useMemo(() => toHeatmap(spec), [spec]);
  const base = colors[0];
  const levels: HeatmapLevelColors = [
    "var(--chart-segment-background)",
    `color-mix(in oklab, ${base} 30%, var(--card))`,
    `color-mix(in oklab, ${base} 55%, var(--card))`,
    `color-mix(in oklab, ${base} 80%, var(--card))`,
    base,
  ];
  if (model.columns.length === 0) {
    return <Empty text="Tarih + değer satırları girin (örn. 2025-03-14 ; 5)." />;
  }
  const label = (count: number) => `${formatNumber(count, o.format)}`;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: o.chartInset }}>
      <HeatmapChart
        data={model.columns}
        layout="fluid"
        gap={2}
        weekStartDay={o.heatmapWeekStart}
        levelColors={levels}
        margin={{ top: 20, right: 4, bottom: 4, left: 30 }}
        animationDuration={isStatic || !o.animate ? 0 : 900}
        enterTransition={isStatic ? INSTANT : undefined}
        animate={!isStatic && o.animate}
        className="w-full"
      >
        <HeatmapYAxis labelFormat="initial" />
        <HeatmapXAxis />
        <HeatmapCells />
        {labelMode(spec) !== "none" && <HeatmapValueLabels format={o.format} size={o.valueLabelSize} />}
        {!isStatic && o.hover && <HeatmapTooltip formatLabel={(count) => label(count)} />}
      </HeatmapChart>
      {o.heatmapLegend && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <HeatmapLegend lessLabel="Az" moreLabel="Çok" levelStyles={levels.map((c) => ({ color: c })) as never} />
        </div>
      )}
    </div>
  );
}

/* ---------------- sankey ---------------- */

function Flow({ spec, colors, isStatic }: Omit<BodyProps, "theme">) {
  const { options: o } = spec;
  const model = useMemo(() => toSankey(spec), [spec]);
  if (model.data.links.length === 0) {
    return <Empty text="Kaynak ; Hedef ; Değer satırları girin." />;
  }
  const nodeColor = (_n: unknown, i: number) => colors[i % colors.length];
  // Outside labels sit left of source nodes and right of outcome nodes; the
  // margin has to make room for the longest name (plus its value line).
  const labelWidth = (cat: string) =>
    model.data.nodes.filter((n) => n.category === cat).reduce((a, n) => Math.max(a, n.name.length), 0) * 7.5 + 24;
  const margin = {
    top: 8,
    bottom: 8,
    left: Math.min(240, Math.max(16, labelWidth("source"))),
    right: Math.min(240, Math.max(16, labelWidth("outcome"))),
  };
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <SankeyChart
        data={model.data}
        aspectRatio="auto"
        className={FILL}
        nodeWidth={o.sankeyNodeWidth}
        nodePadding={o.sankeyNodePadding}
        margin={margin}
        // The link reveal is a motion value driven by the enter tween; with a
        // zero duration it never reaches 1. The export waits for it instead.
        animationDuration={isStatic ? 400 : o.animate ? 1100 : 400}
        enterTransition={isStatic ? INSTANT : undefined}
      >
        <SankeyLink getNodeColor={nodeColor} />
        <SankeyNode getNodeColor={nodeColor} showValueLabels={o.sankeyValueLabels} valueUnit={o.sankeyUnit || undefined} />
        {!isStatic && o.hover && <SankeyTooltip formatValue={(v) => formatNumber(v, o.format)} />}
      </SankeyChart>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-[13px] text-muted-foreground" style={{ flex: 1 }}>
      {text}
    </div>
  );
}
