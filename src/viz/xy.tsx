import { Group } from "@visx/group";
import { GlyphCircle, GlyphCross, GlyphDiamond, GlyphSquare, GlyphStar, GlyphTriangle, GlyphWye } from "@visx/glyph";
import { scaleLinear, scaleSqrt } from "@visx/scale";
import { useMemo } from "react";

import { toXY } from "@/lib/adapters";
import { formatNumber, formatTick } from "@/lib/format";
import { enGenis, olcSatir, satirYuksekligi } from "@/lib/olcu";
import type { GlyphKind } from "@/lib/spec";
import { Empty, Reveal, VIZ, VizFrame, ellipsize, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

const GLYPHS = {
  circle: GlyphCircle,
  square: GlyphSquare,
  diamond: GlyphDiamond,
  triangle: GlyphTriangle,
  star: GlyphStar,
  cross: GlyphCross,
  wye: GlyphWye,
} satisfies Record<GlyphKind, unknown>;

/**
 * Flourish'in "Scatter" ve "Bubble" şablonları. Aynı tabloyu okur; balonda
 * dördüncü sütun (Boyut) yarıçapa, dağılımda sabit noktaya karşılık gelir.
 * Beşinci sütun (Grup) renk serisini belirler.
 */
export function XYViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toXY(spec), [spec]);
  const isBubble = spec.kind === "bubble";

  if (model.points.length === 0) {
    return <Empty text="Etiket, X ve Y sütunlarını doldurun (örn. Marmara ; 82 ; 74)." />;
  }

  const grouped = model.groups[0] !== "" || model.groups.length > 1;
  const items = grouped
    ? model.groups.map((g, i) => ({
        label: g || "Diğer",
        value: model.points.filter((p) => p.group === g).length,
        color: colors[i % colors.length],
      }))
    : [];

  const fmt = (v: number) => formatNumber(v, o.format);

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) => {
          // Kenar boşluğu üç şeyin en büyüğü: eksen etiketi, noktanın yarıçapı
          // ve nokta etiketinin yarısı. Yarıçap eskiden hiç sayılmıyordu —
          // `bubbleMax` 34 iken kenardaki balonun yarısı dışarıda kalıyordu.
          const rMax = isBubble ? o.bubbleMax : Math.max(3, o.pointSize ?? 6);
          const etiketYari = o.pointLabels ? Math.min(110, enGenis(model.points.map((p) => p.label ?? ""), 10.5)) / 2 : 0;
          // Eksen etiketleri için aday sayılar: ölçek `nice()` uyguladığı için
          // ekranda görünecek olanlar bunlar. Kutuyu kurmadan önce kaba bir
          // iç ölçüyle bir kez tahmin ediyoruz.
          const kabaIw = Math.max(40, width - 60);
          const kabaIh = Math.max(40, height - 50);
          const xAday = scaleLinear<number>({ domain: model.xDomain, range: [0, kabaIw], nice: true })
            .ticks(Math.max(2, Math.min(10, Math.round(kabaIw / 90))))
            .map(fmt);
          const yAday = scaleLinear<number>({ domain: model.yDomain, range: [kabaIh, 0], nice: true }).ticks(o.yTicks).map(fmt);
          const eksenAdi = Math.ceil(satirYuksekligi(11, 600)) + 4;
          const margin = {
            top: Math.ceil(Math.max(10, rMax, o.pointLabels ? rMax + 4 + olcSatir(10.5).cik : 0)),
            right: Math.ceil(Math.max(14, rMax, etiketYari)),
            bottom: Math.ceil(Math.max(o.xAxis ? 14 + satirYuksekligi(11) : 8, rMax)) + (o.xTitle ? eksenAdi : 0),
            left: Math.ceil(Math.max(o.yAxis ? 8 + enGenis(yAday, 11) : 8, rMax, etiketYari)) + (o.yTitle ? eksenAdi : 0),
          };
          // Yatay eksenin uçtaki etiketi de ortalı yazılıyor; yarısı dışarı
          // taşmasın.
          if (o.xAxis) {
            const uc = Math.ceil(enGenis(xAday, 11) / 2);
            margin.right = Math.max(margin.right, uc);
            margin.left = Math.max(margin.left, uc);
          }
          const iw = width - margin.left - margin.right;
          const ih = height - margin.top - margin.bottom;
          if (iw <= 10 || ih <= 10) return null;

          const xs = scaleLinear<number>({ domain: model.xDomain, range: [0, iw], nice: true });
          const ys = scaleLinear<number>({ domain: model.yDomain, range: [ih, 0], nice: true });
          const rs = scaleSqrt<number>({ domain: [0, model.sizeMax], range: [3, o.bubbleMax] });

          const xTicks = xs.ticks(Math.max(2, Math.min(10, Math.round(iw / 90))));
          const yTicks = ys.ticks(o.yTicks);
          const xMid = (model.xDomain[0] + model.xDomain[1]) / 2;
          const yMid = (model.yDomain[0] + model.yDomain[1]) / 2;

          return (
            <Group top={margin.top} left={margin.left}>
              {o.grid && (
                <g className={VIZ.grid}>
                  {yTicks.map((t) => (
                    <line key={`gy${t}`} x1={0} x2={iw} y1={ys(t)} y2={ys(t)} />
                  ))}
                  {o.gridVertical && xTicks.map((t) => <line key={`gx${t}`} y1={0} y2={ih} x1={xs(t)} x2={xs(t)} />)}
                </g>
              )}

              {o.quadrants && (
                <g className={VIZ.hair} strokeDasharray="4 4">
                  <line x1={xs(xMid)} x2={xs(xMid)} y1={0} y2={ih} />
                  <line y1={ys(yMid)} y2={ys(yMid)} x1={0} x2={iw} />
                </g>
              )}

              {o.trendLine && model.trend && (
                <line
                  x1={0}
                  y1={ys(model.trend.slope * model.xDomain[0] + model.trend.intercept)}
                  x2={iw}
                  y2={ys(model.trend.slope * model.xDomain[1] + model.trend.intercept)}
                  stroke={colors[0]}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity={0.7}
                />
              )}

              <Reveal isStatic={isStatic} animate={o.animate}>
                {model.points.map((p, i) => {
                  const gi = Math.max(0, model.groups.indexOf(p.group));
                  const color = colors[gi % colors.length];
                  const r = isBubble ? rs(p.size) : o.pointSize;
                  const Glyph = GLYPHS[o.pointGlyph];
                  return (
                    <g key={`p${i}`}>
                      <Glyph
                        left={xs(p.x)}
                        top={ys(p.y)}
                        // visx boyutu alan olarak alır; yarıçapı alana çeviriyoruz.
                        size={Math.PI * r * r}
                        fill={color}
                        fillOpacity={o.pointOpacity}
                        stroke={color}
                        strokeWidth={1}
                      />
                      {o.pointLabels && p.label && (
                        <text
                          className={VIZ.label}
                          x={xs(p.x)}
                          y={ys(p.y) - r - 4}
                          textAnchor="middle"
                          fontSize={10.5}
                        >
                          {ellipsize(p.label, 10.5, 110)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </Reveal>

              {/* eksenler */}
              <line className={VIZ.hair} x1={0} x2={iw} y1={ih} y2={ih} />
              {o.yAxis &&
                yTicks.map((t) => (
                  <text key={`ty${t}`} className={VIZ.label} x={-8} y={ys(t)} dy="0.32em" textAnchor="end">
                    {formatTick(t, o.format, yTicks.length > 1 ? Math.abs(yTicks[1] - yTicks[0]) : undefined)}
                  </text>
                ))}
              {o.xAxis &&
                xTicks.map((t) => (
                  <text key={`tx${t}`} className={VIZ.label} x={xs(t)} y={ih + 16} textAnchor="middle">
                    {formatTick(t, o.format, xTicks.length > 1 ? Math.abs(xTicks[1] - xTicks[0]) : undefined)}
                  </text>
                ))}
              {o.xTitle && (
                <text className={VIZ.strong} x={iw / 2} y={ih + margin.bottom - 2} textAnchor="middle" fontSize={11}>
                  {o.xTitle}
                </text>
              )}
              {o.yTitle && (
                <text
                  className={VIZ.strong}
                  transform={`translate(${-margin.left + 12} ${ih / 2}) rotate(-90)`}
                  textAnchor="middle"
                  fontSize={11}
                >
                  {o.yTitle}
                </text>
              )}
              {o.trendLine && model.trend && (
                <text className={VIZ.label} x={iw} y={-1} textAnchor="end" fontSize={10.5}>
                  {`R² = ${model.trend.r2.toFixed(2)}`}
                </text>
              )}
              {isBubble && o.legendValues && (
                <text className={VIZ.label} x={0} y={-1} fontSize={10.5}>
                  {`En büyük balon: ${fmt(model.sizeMax)}`}
                </text>
              )}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}
