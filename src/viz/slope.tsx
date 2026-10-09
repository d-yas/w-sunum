import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useMemo } from "react";

import { toCartesian } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { enGenis, olcMetin, olcSatir, satirYuksekligi } from "@/lib/olcu";
import { anahtarla } from "@/lib/sira";
import { Empty, Reveal, VIZ, VizFrame, ellipsize, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

/**
 * Eğim grafiği — Flourish "Slope chart". Kartezyen tablonun her *sütunu* bir
 * durak, her *satırı* bir çizgidir; yani sütun grafiğinin devriği. İki sütunla
 * klasik önce/sonra, üç ve fazlasıyla çok duraklı bump chart olur.
 */
export function SlopeViz({ spec, colors, isStatic }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toCartesian(spec), [spec]);
  const stops = model.series.length;

  if (stops < 2 || model.labels.length === 0) {
    return <Empty text="Eğim grafiği en az iki değer sütunu ister (örn. Birim ; 2023 ; 2025)." />;
  }

  // Satır = çizgi. Renk sırası satır sırasıdır.
  const lines = model.labels.map((label, ri) => ({
    label,
    values: model.series.map((s) => s.values[ri] ?? 0),
    color: colors[ri % colors.length],
  }));

  const anahtarlar = anahtarla(lines.map((l) => l.label));
  const durakAnahtarlari = anahtarla(model.series.map((s) => s.name));
  const all = lines.flatMap((l) => l.values);
  const valueTextRaw = (v: number) => formatNumber(v, o.format);
  const items = lines.map((l) => ({
    label: l.label,
    value: l.values[l.values.length - 1] - l.values[0],
    color: l.color,
  }));

  return (
    <WithLegend spec={spec} items={o.legend ? items : []}>
      <VizFrame>
        {({ width, height }) => {
          // Uçlardaki metin "etiket + değer" (ya da "değer + etiket"); ikisi
          // **aynı satırda** yazıldığı için ayrılan yer ikisinin toplamı.
          // Eskiden `labelW` genişliğe oranlıydı ve kısaltma hedefi sihirli
          // bir `-52` idi: ölçülen metin ayrılan yerden uzun olabiliyordu.
          const degerPx = o.slopeValues ? enGenis(all.map(valueTextRaw), 11.5, 600) + olcMetin(" ", 11.5, 600) : 0;
          const adPx = o.slopeLabels ? enGenis(lines.map((l) => l.label), 11.5, 600) : 0;
          const ucPay = o.slopeDots + 10;
          const labelW = o.slopeLabels || o.slopeValues ? Math.min(width * 0.3, Math.max(70, Math.ceil(adPx + degerPx + ucPay))) : 12;
          // Durak adları üstte, uçtaki çizgilerin etiketi altta kalabiliyor:
          // ikisi de ölçülüyor.
          const margin = {
            top: o.xAxis ? Math.ceil(10 + satirYuksekligi(12)) : 8,
            right: labelW,
            bottom: Math.max(8, Math.ceil(0.34 * 11.5 + olcSatir(11.5, 600).in) + 4),
            left: labelW,
          };
          const iw = width - margin.left - margin.right;
          const ih = height - margin.top - margin.bottom;
          if (iw <= 20 || ih <= 20) return null;

          const ys = scaleLinear<number>({
            domain: [o.yMin ?? Math.min(...all), o.yMax ?? Math.max(...all)],
            range: [ih, 0],
            nice: true,
          });
          const x = (i: number) => (stops === 1 ? iw / 2 : (i / (stops - 1)) * iw);

          const valueText = valueTextRaw;

          return (
            <Group top={margin.top} left={margin.left}>
              {/* durak eksenleri */}
              <g className={VIZ.grid}>
                {model.series.map((_, i) => (
                  <line key={i} x1={x(i)} x2={x(i)} y1={0} y2={ih} />
                ))}
              </g>
              {o.xAxis &&
                model.series.map((s, i) => (
                  <text
                    key={`h${i}`}
                    className={VIZ.strong}
                    data-seri={durakAnahtarlari[i]}
                    x={x(i)}
                    y={-10}
                    textAnchor={i === 0 ? "start" : i === stops - 1 ? "end" : "middle"}
                    fontSize={12}
                  >
                    {s.name}
                  </text>
                ))}

              <Reveal isStatic={isStatic} animate={o.animate}>
                {lines.map((l, li) => {
                  const d = l.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${ys(v).toFixed(2)}`).join(" ");
                  return (
                    <g key={li} data-oge={anahtarlar[li]}>
                      <path d={d} fill="none" stroke={l.color} strokeWidth={o.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                      {o.slopeDots > 0 &&
                        l.values.map((v, i) => <circle key={i} cx={x(i)} cy={ys(v)} r={o.slopeDots} fill={l.color} />)}
                    </g>
                  );
                })}
              </Reveal>

              {/* uç etiketleri: solda ad, sağda ad + değer */}
              {o.slopeLabels &&
                lines.map((l, li) => (
                  <g key={`lb${li}`} data-oge={anahtarlar[li]}>
                    <text
                      className={VIZ.strong}
                      x={-o.slopeDots - 8}
                      y={ys(l.values[0])}
                      dy="0.34em"
                      textAnchor="end"
                      fontSize={11.5}
                      fill={l.color}
                    >
                      {o.slopeValues ? `${ellipsize(l.label, 11.5, labelW - ucPay - degerPx, 600)} ${valueText(l.values[0])}` : ellipsize(l.label, 11.5, labelW - ucPay, 600)}
                    </text>
                    <text
                      className={VIZ.strong}
                      x={iw + o.slopeDots + 8}
                      y={ys(l.values[stops - 1])}
                      dy="0.34em"
                      textAnchor="start"
                      fontSize={11.5}
                      fill={l.color}
                    >
                      {o.slopeValues ? `${valueText(l.values[stops - 1])} ${ellipsize(l.label, 11.5, labelW - ucPay - degerPx, 600)}` : ellipsize(l.label, 11.5, labelW - ucPay, 600)}
                    </text>
                  </g>
                ))}
            </Group>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}
