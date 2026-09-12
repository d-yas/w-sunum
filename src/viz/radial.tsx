import { Group } from "@visx/group";
import { arc as d3arc } from "d3-shape";
import { useMemo } from "react";

import { toCartesian, toCategoryValue } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { Empty, Reveal, VIZ, VizFrame, ellipsize, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

/* ================================================================== */
/* Radar — Flourish "Radar chart"                                      */
/* ================================================================== */

/**
 * Kartezyen tabloyu kutupsal eksene açar: her satır bir eksen, her sütun bir
 * seri. Bu yüzden sütun/çizgi ile radar arasında tür değiştirmek veriyi bozmaz.
 */
export function RadarViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCartesian(spec), [spec]);
  const axes = model.labels.length;

  if (axes < 3 || model.series.length === 0) {
    return <Empty text="Radar en az üç eksen ister: üç ya da daha çok satır girin." />;
  }

  const dataMax = model.series.reduce(
    (a, s) => Math.max(a, ...s.values.map((v) => Math.abs(v ?? 0))),
    0
  );
  const max = o.yMax ?? (dataMax > 0 ? dataMax : 1);
  const items = model.series.map((s, i) => ({ label: s.name, value: s.total, color: colors[i] }));

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) => {
          const labelPad = o.xAxis ? 56 : 10;
          const r = Math.min(width, height) / 2 - labelPad;
          if (r < 20) return null;
          // Tepe noktadan başla, saat yönünde ilerle.
          const angle = (i: number) => (i / axes) * Math.PI * 2 - Math.PI / 2;
          const point = (i: number, value: number): [number, number] => {
            const rr = (Math.max(0, value) / max) * r;
            return [Math.cos(angle(i)) * rr, Math.sin(angle(i)) * rr];
          };
          const ringPath = (t: number) =>
            model.labels
              .map((_, i) => {
                const [x, y] = [Math.cos(angle(i)) * r * t, Math.sin(angle(i)) * r * t];
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ") + " Z";

          return (
            <Group top={height / 2} left={width / 2}>
              {/* ızgara */}
              {o.grid && (
                <g className={VIZ.grid}>
                  {Array.from({ length: o.radarLevels }, (_, li) => {
                    const t = (li + 1) / o.radarLevels;
                    return o.radarStraight ? (
                      <path key={`r${li}`} d={ringPath(t)} />
                    ) : (
                      <circle key={`r${li}`} r={r * t} />
                    );
                  })}
                  {model.labels.map((_, i) => (
                    <line key={`s${i}`} x1={0} y1={0} x2={Math.cos(angle(i)) * r} y2={Math.sin(angle(i)) * r} />
                  ))}
                </g>
              )}

              {/* seriler */}
              <Reveal isStatic={isStatic} animate={o.animate}>
                {model.series.map((s, si) => {
                  const d =
                    s.values
                      .map((v, i) => {
                        const [x, y] = point(i, v ?? 0);
                        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
                      })
                      .join(" ") + " Z";
                  return (
                    <g key={s.key}>
                      <path d={d} fill={colors[si]} fillOpacity={o.radarFill} stroke={colors[si]} strokeWidth={o.strokeWidth} strokeLinejoin="round" />
                      {o.radarDots &&
                        s.values.map((v, i) => {
                          const [x, y] = point(i, v ?? 0);
                          return <circle key={i} cx={x} cy={y} r={o.strokeWidth + 1.4} fill={colors[si]} />;
                        })}
                    </g>
                  );
                })}
              </Reveal>

              {/* eksen etiketleri */}
              {o.xAxis &&
                model.labels.map((label, i) => {
                  const a = angle(i);
                  const x = Math.cos(a) * (r + 14);
                  const y = Math.sin(a) * (r + 14);
                  const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
                  return (
                    <text key={`ax${i}`} className={VIZ.strong} x={x} y={y} textAnchor={anchor} dy="0.34em" fontSize={11.5}>
                      {ellipsize(label, 11.5, labelPad - 4)}
                    </text>
                  );
                })}
              {/* en dış halkanın değeri */}
              {o.yAxis && (
                <text className={VIZ.label} x={3} y={-r} dy="-0.4em" fontSize={10.5}>
                  {formatNumber(max, o.format)}
                </text>
              )}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}

/* ================================================================== */
/* Gösterge — Flourish "Gauge"                                         */
/* ================================================================== */

/**
 * Yarım/üç-çeyrek daire gösterge. Birden çok satır girilirse eş merkezli
 * halkalara açılır; tek satır klasik tek göstergedir.
 */
export function GaugeViz({ spec, colors, isStatic, theme }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCategoryValue(spec), [spec]);

  if (model.items.length === 0) {
    return <Empty text="Etiket ve değer girin (örn. Hedef gerçekleşme ; 72 ; 100)." />;
  }

  const items = model.items.map((it, i) => ({
    label: it.label,
    value: it.value,
    maxValue: it.target ?? o.gaugeMax,
    color: colors[i % colors.length],
  }));

  const sweep = (Math.min(350, Math.max(90, o.gaugeSweep)) * Math.PI) / 180;
  const start = -sweep / 2;
  const end = sweep / 2;
  const single = model.items.length === 1;

  const arcGen = d3arc<{ a0: number; a1: number; r0: number; r1: number }>()
    .startAngle((d) => d.a0)
    .endAngle((d) => d.a1)
    .innerRadius((d) => d.r0)
    .outerRadius((d) => d.r1)
    .cornerRadius(o.gaugeThickness / 2);

  return (
    <WithLegend spec={spec} items={single ? [] : items}>
      <VizFrame>
        {({ width, height }) => {
          // Yay tam daire değilse merkez aşağı kayar; boşluğu değer yazısı alır.
          const openBottom = sweep < Math.PI * 1.75;
          const cy = openBottom ? height * 0.62 : height / 2;
          const outer = Math.min(width / 2, openBottom ? cy : height / 2) - 8;
          if (outer < 24) return null;
          const gap = 6;
          const thickness = single
            ? Math.min(o.gaugeThickness, outer * 0.5)
            : Math.max(6, Math.min(o.gaugeThickness, (outer * 0.72) / model.items.length - gap));

          const tickValues = Array.from({ length: o.gaugeTicks + 1 }, (_, i) => o.gaugeMin + ((o.gaugeMax - o.gaugeMin) * i) / o.gaugeTicks);

          return (
            <Group top={cy} left={width / 2}>
              <Reveal isStatic={isStatic} animate={o.animate}>
                {model.items.map((it, i) => {
                  const r1 = outer - i * (thickness + gap);
                  const r0 = r1 - thickness;
                  if (r0 < 4) return null;
                  const lo = o.gaugeMin;
                  const hi = it.target != null && it.target > lo ? it.target : o.gaugeMax;
                  const t = hi === lo ? 0 : Math.max(0, Math.min(1, (it.value - lo) / (hi - lo)));
                  const track = arcGen({ a0: start, a1: end, r0, r1 });
                  const fill = arcGen({ a0: start, a1: start + (end - start) * t, r0, r1 });
                  return (
                    <g key={`g${i}`}>
                      {track && <path className={VIZ.track} d={track} />}
                      {fill && t > 0 && <path d={fill} fill={colors[i % colors.length]} />}
                      {o.gaugeNeedle && single && (
                        <g transform={`rotate(${((start + (end - start) * t) * 180) / Math.PI})`}>
                          <line y1={0} y2={-r1 - 4} stroke="var(--ink-primary)" strokeWidth={2} strokeLinecap="round" />
                          <circle r={4} fill="var(--ink-primary)" />
                        </g>
                      )}
                    </g>
                  );
                })}
              </Reveal>

              {/* skala */}
              {o.xAxis &&
                single &&
                tickValues.map((v, i) => {
                  const t = i / o.gaugeTicks;
                  const a = start + (end - start) * t - Math.PI / 2;
                  const rr = outer + 12;
                  return (
                    <text
                      key={`t${i}`}
                      className={VIZ.label}
                      x={Math.cos(a) * rr}
                      y={Math.sin(a) * rr}
                      textAnchor="middle"
                      dy="0.34em"
                      fontSize={10.5}
                    >
                      {formatNumber(v, o.format)}
                    </text>
                  );
                })}

              {single && (
                <g>
                  <text
                    className={VIZ.value}
                    textAnchor="middle"
                    y={openBottom ? 4 : 0}
                    fontSize={Math.min(46, outer * 0.42)}
                    fontWeight={700}
                  >
                    {formatNumber(model.items[0].value, o.format)}
                  </text>
                  <text
                    className={VIZ.label}
                    textAnchor="middle"
                    y={(openBottom ? 4 : 0) + Math.min(30, outer * 0.28)}
                    fontSize={Math.min(15, outer * 0.14)}
                  >
                    {ellipsize(model.items[0].label, 13, outer * 1.8)}
                  </text>
                </g>
              )}
              {!single &&
                o.legendValues === false &&
                model.items.map((it, i) => {
                  const r1 = outer - i * (thickness + gap);
                  return (
                    <text
                      key={`lb${i}`}
                      className={VIZ.label}
                      x={0}
                      y={-r1 + thickness / 2}
                      dy="0.34em"
                      textAnchor="middle"
                      fontSize={10}
                      fill={theme === "dark" ? "#ffffff" : "#141413"}
                    >
                      {formatNumber(it.value, o.format)}
                    </text>
                  );
                })}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}
