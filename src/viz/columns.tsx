import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useMemo } from "react";

import { toCartesian, toCategoryValue, toWaterfall } from "@/lib/adapters";
import { formatNumber, formatTick } from "@/lib/format";
import { Empty, Reveal, VIZ, VizFrame, contrastText, ellipsize, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

/* ================================================================== */
/* Şelale — Flourish "Waterfall"                                       */
/* ================================================================== */

/**
 * Her kalem bir öncekinin bittiği yerden başlar; artı yeşil değil, paletin
 * ilk rengi, eksi ise ikinci rengidir — kartın renk körlüğü doğrulanmış
 * paletinden çıkmamak için.
 */
export function WaterfallViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toWaterfall(spec), [spec]);

  if (model.steps.length === 0) {
    return <Empty text="Kalem ve değer girin; eksi değer düşüş olarak çizilir (örn. Kayıp ; -310)." />;
  }

  const up = colors[0];
  const down = colors[1] ?? colors[0];
  const total = colors[2] ?? colors[0];
  const items = [
    { label: "Artış", value: model.steps.filter((s) => s.kind === "increase").length, color: up },
    { label: "Azalış", value: model.steps.filter((s) => s.kind === "decrease").length, color: down },
    ...(o.waterfallTotal ? [{ label: o.waterfallTotalLabel || "Toplam", value: 1, color: total }] : []),
  ];

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) => {
          const margin = { top: 16, right: 10, bottom: o.xAxis ? 34 : 8, left: o.yAxis ? 54 : 8 };
          const iw = width - margin.left - margin.right;
          const ih = height - margin.top - margin.bottom;
          if (iw <= 10 || ih <= 10) return null;

          const ys = scaleLinear<number>({
            domain: [o.yMin ?? Math.min(0, model.min), o.yMax ?? model.max * 1.06],
            range: [ih, 0],
            nice: true,
          });
          const n = model.steps.length;
          const slot = iw / n;
          const bw = o.barWidth ?? slot * (1 - Math.min(0.8, o.barGap));
          const ticks = ys.ticks(o.yTicks);
          const zero = ys(0);

          return (
            <Group top={margin.top} left={margin.left}>
              {o.grid && (
                <g className={VIZ.grid}>
                  {ticks.map((t) => (
                    <line key={t} x1={0} x2={iw} y1={ys(t)} y2={ys(t)} />
                  ))}
                </g>
              )}
              <line className={VIZ.hair} x1={0} x2={iw} y1={zero} y2={zero} />

              <Reveal isStatic={isStatic} animate={o.animate}>
                {model.steps.map((s, i) => {
                  const cx = slot * i + slot / 2;
                  const y0 = ys(Math.max(s.start, s.end));
                  const y1 = ys(Math.min(s.start, s.end));
                  const h = Math.max(1, y1 - y0);
                  const fill = s.kind === "total" ? total : s.kind === "increase" ? up : down;
                  const label = formatNumber(s.value, o.format);
                  const inside = h > 22 && bw > 34;
                  return (
                    <g key={i}>
                      {o.waterfallConnectors && i > 0 && (
                        <line
                          className={VIZ.hair}
                          x1={slot * (i - 1) + slot / 2 + bw / 2}
                          x2={cx - bw / 2}
                          y1={ys(model.steps[i - 1].kind === "total" ? model.steps[i - 1].end : model.steps[i - 1].end)}
                          y2={ys(s.kind === "total" ? s.end : s.start)}
                          strokeDasharray="3 3"
                        />
                      )}
                      <rect x={cx - bw / 2} y={y0} width={bw} height={h} rx={2} fill={fill} />
                      <text
                        x={cx}
                        y={inside ? y0 + h / 2 : y0 - 5}
                        textAnchor="middle"
                        dy={inside ? "0.34em" : undefined}
                        fontSize={11}
                        fontWeight={600}
                        className={inside ? undefined : VIZ.value}
                        fill={inside ? contrastText(fill) : undefined}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </Reveal>

              {o.yAxis &&
                ticks.map((t) => (
                  <text key={`y${t}`} className={VIZ.label} x={-8} y={ys(t)} dy="0.32em" textAnchor="end">
                    {formatTick(t, o.format, ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : undefined)}
                  </text>
                ))}
              {o.xAxis &&
                model.steps.map((s, i) => (
                  <text
                    key={`x${i}`}
                    className={VIZ.label}
                    transform={`translate(${slot * i + slot / 2} ${ih + 8}) rotate(${slot < 66 ? 30 : 0})`}
                    textAnchor={slot < 66 ? "start" : "middle"}
                    dy={slot < 66 ? "0.32em" : "0.9em"}
                  >
                    {ellipsize(s.label, 11, slot < 66 ? margin.bottom * 1.9 : slot)}
                  </text>
                ))}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}

/* ================================================================== */
/* Huni — Flourish "Funnel"                                            */
/* ================================================================== */

export function FunnelViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCategoryValue(spec), [spec]);

  if (model.items.length === 0) {
    return <Empty text="Aşama ve değer girin (örn. Ziyaret ; 12400)." />;
  }

  const items = model.items.map((it, i) => ({ label: it.label, value: it.value, color: colors[i % colors.length] }));
  const first = model.items[0].value || 1;

  return (
    <WithLegend spec={spec} items={o.legend ? items : []}>
      <VizFrame>
        {({ width, height }) => {
          const labelW = Math.min(190, Math.max(96, width * 0.24));
          const valueW = 84;
          const iw = width - labelW - valueW;
          const n = model.items.length;
          const rowH = height / n;
          const bodyH = rowH - o.funnelGap;
          if (iw <= 20 || bodyH <= 2) return null;

          // Huni: her satırın genişliği kendi payı, ortalanır. Piramit: en
          // geniş üstte olacak biçimde sıralı daralma. Bar: klasik yatay çubuk.
          const widthOf = (i: number) => {
            if (o.funnelShape === "bar") return (model.items[i].value / (model.max || 1)) * iw;
            if (o.funnelShape === "pyramid") return (iw * (n - i)) / n;
            return (model.items[i].value / first) * iw;
          };

          return (
            <Group left={labelW}>
              <Reveal isStatic={isStatic} animate={o.animate}>
                {model.items.map((it, i) => {
                  const w = Math.max(2, widthOf(i));
                  const wNext = i + 1 < n ? Math.max(2, widthOf(i + 1)) : w;
                  const y = i * rowH;
                  const centred = o.funnelShape !== "bar";
                  const x0 = centred ? (iw - w) / 2 : 0;
                  const x1 = centred ? (iw - wNext) / 2 : 0;
                  const fill = colors[i % colors.length];
                  // Kenarları bir sonraki aşamaya doğru daralan yamuk.
                  const d = centred
                    ? `M${x0},${y} L${x0 + w},${y} L${x1 + wNext},${y + bodyH} L${x1},${y + bodyH} Z`
                    : `M0,${y} L${w},${y} L${w},${y + bodyH} L0,${y + bodyH} Z`;
                  const drop = i > 0 ? model.items[i].value / (model.items[i - 1].value || 1) : 1;
                  return (
                    <g key={i}>
                      <path d={d} fill={fill} />
                      <text className={VIZ.strong} x={-10} y={y + bodyH / 2} dy="0.34em" textAnchor="end" fontSize={12}>
                        {ellipsize(it.label, 12, labelW - 14)}
                      </text>
                      <text
                        className={VIZ.value}
                        x={iw + 10}
                        y={y + bodyH / 2}
                        dy={o.funnelDropLabels && i > 0 ? "-0.1em" : "0.34em"}
                        fontSize={12}
                        fontWeight={600}
                      >
                        {formatNumber(it.value, o.format)}
                      </text>
                      {o.funnelDropLabels && i > 0 && (
                        <text className={VIZ.label} x={iw + 10} y={y + bodyH / 2} dy="1.15em" fontSize={10.5}>
                          {`%${Math.round(drop * 100)}`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </Reveal>
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}

/* ================================================================== */
/* Marimekko — Flourish "Marimekko / Mekko"                            */
/* ================================================================== */

/**
 * Sütun genişliği satırın toplamına, dilim yüksekliği o satırdaki serinin
 * payına karşılık gelir. Kartezyen tablonun ta kendisi: sütun grafiğinden
 * geçince veri korunur.
 */
export function MarimekkoViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCartesian(spec), [spec]);

  const rows = model.labels.map((label, i) => {
    const parts = model.series.map((s) => Math.max(0, s.values[i] ?? 0));
    return { label, parts, total: parts.reduce((a, v) => a + v, 0) };
  });
  const grandTotal = rows.reduce((a, r) => a + r.total, 0);

  if (rows.length === 0 || grandTotal <= 0) {
    return <Empty text="Kategori satırları ve en az bir sayısal seri sütunu girin." />;
  }

  const items = model.series.map((s, i) => ({ label: s.name, value: s.total, color: colors[i] }));

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) => {
          const margin = { top: o.xAxis ? 20 : 4, right: 2, bottom: 4, left: o.yAxis ? 36 : 2 };
          const iw = width - margin.left - margin.right;
          const ih = height - margin.top - margin.bottom;
          if (iw <= 20 || ih <= 20) return null;

          const gaps = o.mekkoGap * (rows.length - 1);
          const usable = Math.max(10, iw - gaps);
          let x = 0;

          return (
            <Group top={margin.top} left={margin.left}>
              <Reveal isStatic={isStatic} animate={o.animate}>
                {rows.map((row, ri) => {
                  const w = (row.total / grandTotal) * usable;
                  const left = x;
                  x += w + o.mekkoGap;
                  let y = 0;
                  return (
                    <g key={ri}>
                      {row.parts.map((v, si) => {
                        const h = row.total === 0 ? 0 : (v / row.total) * ih;
                        const top = y;
                        y += h;
                        if (h < 0.5 || w < 0.5) return null;
                        const fill = colors[si];
                        const share = row.total === 0 ? 0 : v / row.total;
                        const showLabel = o.mekkoLabels && h > 16 && w > 40;
                        return (
                          <g key={si}>
                            <rect x={left} y={top} width={w} height={h} fill={fill} />
                            {showLabel && (
                              <text
                                x={left + w / 2}
                                y={top + h / 2}
                                textAnchor="middle"
                                dy="0.34em"
                                fontSize={11}
                                fontWeight={600}
                                fill={contrastText(fill)}
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {`%${Math.round(share * 100)}`}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      {o.xAxis && (
                        <text
                          className={VIZ.strong}
                          x={left + w / 2}
                          y={-6}
                          textAnchor="middle"
                          fontSize={11}
                        >
                          {ellipsize(row.label, 11, w)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </Reveal>
              {o.yAxis &&
                [0, 25, 50, 75, 100].map((p) => (
                  <text key={p} className={VIZ.label} x={-8} y={ih * (1 - p / 100)} dy="0.32em" textAnchor="end">
                    {`%${p}`}
                  </text>
                ))}
              {o.legendValues && (
                <text className={VIZ.label} x={iw} y={ih + 2} dy="0.9em" textAnchor="end" fontSize={10.5}>
                  {`Sütun genişliği = kategori toplamı · Genel toplam ${formatNumber(grandTotal, o.format)}`}
                </text>
              )}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}
