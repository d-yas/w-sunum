import { Chord, Ribbon } from "@visx/chord";
import { Group } from "@visx/group";
import { Arc } from "@visx/shape";
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useMemo } from "react";

import { toFlow } from "@/lib/adapters";
import { Empty, Reveal, VIZ, VizFrame, ellipsize, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

/**
 * Flourish'in ilişki şablonları: Chord, Network ve Arc. Üçü de Sankey ile aynı
 * `Kaynak ; Hedef ; Değer` tablosunu okur, bu yüzden dördü arasında tür
 * değiştirmek veriyi bozmaz.
 */
export function RelationViz(props: VizProps) {
  const { spec, colors } = props;
  const model = useMemo(() => toFlow(spec), [spec]);

  if (model.links.length === 0) {
    return <Empty text="Kaynak ; Hedef ; Değer satırları girin (örn. Satış ; Pazarlama ; 38)." />;
  }

  const items = model.names.map((n, i) => ({
    label: n,
    value: model.totals[i],
    color: colors[i % colors.length],
  }));

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) =>
          spec.kind === "chord" ? (
            <ChordBody {...props} model={model} width={width} height={height} />
          ) : spec.kind === "network" ? (
            <NetworkBody {...props} model={model} width={width} height={height} />
          ) : (
            <ArcBody {...props} model={model} width={width} height={height} />
          )
        }
      </VizFrame>
    </WithLegend>
  );
}

type Model = ReturnType<typeof toFlow>;
type BodyProps = VizProps & { model: Model; width: number; height: number };

/* ---------------- akor ---------------- */

function ChordBody({ spec, colors, isStatic, model, width, height }: BodyProps) {
  const o = spec.options;
  const outer = Math.min(width, height) / 2 - (o.nodeLabels ? 68 : 6);
  if (outer < 20) return null;
  const inner = outer - o.chordThickness;

  return (
    <Group top={height / 2} left={width / 2}>
      <Chord matrix={model.matrix} padAngle={o.chordPad} sortSubgroups={(a, b) => b - a}>
        {({ chords }) => (
          <Reveal isStatic={isStatic} animate={o.animate}>
            {/* Şeritler önce: gruplar üstlerinde kalsın. */}
            {chords.map((chord, i) => (
              <Ribbon
                key={`r${i}`}
                chord={chord}
                radius={inner}
                fill={colors[chord.source.index % colors.length]}
                fillOpacity={o.linkOpacity}
                stroke={colors[chord.source.index % colors.length]}
                strokeOpacity={o.linkOpacity * 0.5}
              />
            ))}
            {chords.groups.map((group, i) => {
              const angle = (group.startAngle + group.endAngle) / 2;
              const deg = (angle * 180) / Math.PI - 90;
              const flip = angle > Math.PI;
              return (
                <g key={`g${i}`}>
                  <Arc
                    data={group}
                    startAngle={group.startAngle}
                    endAngle={group.endAngle}
                    innerRadius={inner}
                    outerRadius={outer}
                    fill={colors[i % colors.length]}
                  />
                  {o.nodeLabels && (
                    <text
                      className={VIZ.strong}
                      transform={`rotate(${deg}) translate(${outer + 8} 0) ${flip ? "rotate(180)" : ""}`}
                      textAnchor={flip ? "end" : "start"}
                      dy="0.34em"
                      fontSize={11.5}
                    >
                      {ellipsize(model.names[i] ?? "", 11.5, 62)}
                    </text>
                  )}
                </g>
              );
            })}
          </Reveal>
        )}
      </Chord>
    </Group>
  );
}

/* ---------------- ağ ---------------- */

interface SimNode extends SimulationNodeDatum {
  id: number;
  name: string;
  total: number;
}

/**
 * Kuvvet yerleşimi bir kere, senkron olarak çözülür (`simulation.tick()`).
 * Canlı bir simülasyon çalıştırmak PNG dışa aktarımını belirsiz kılardı —
 * kart hangi karede rasterlanırsa düğümler orada donardı. Sabit tohum ve sabit
 * adım sayısıyla aynı veri her zaman aynı yerleşimi verir.
 */
function useForceLayout(model: Model, width: number, height: number, charge: number): SimNode[] {
  return useMemo(() => {
    const nodes: SimNode[] = model.names.map((name, id) => ({
      id,
      name,
      total: model.totals[id],
      // Deterministik başlangıç: çember üstünde eşit aralıklı.
      x: width / 2 + Math.cos((id / model.names.length) * Math.PI * 2) * Math.min(width, height) * 0.3,
      y: height / 2 + Math.sin((id / model.names.length) * Math.PI * 2) * Math.min(width, height) * 0.3,
    }));
    const links: SimulationLinkDatum<SimNode>[] = model.links.map((l) => ({ source: l.source, target: l.target }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimulationLinkDatum<SimNode>>(links).id((d) => d.id).distance(Math.min(width, height) * 0.24))
      .force("charge", forceManyBody().strength(charge))
      .force("center", forceCenter(width / 2, height / 2))
      .force("x", forceX(width / 2).strength(0.05))
      .force("y", forceY(height / 2).strength(0.08))
      .stop();
    sim.tick(320);
    return nodes;
  }, [model, width, height, charge]);
}

function NetworkBody({ spec, colors, isStatic, model, width, height }: BodyProps) {
  const o = spec.options;
  const pad = o.networkNodeSize * 2 + (o.nodeLabels ? 34 : 6);
  const nodes = useForceLayout(model, width, height, o.networkCharge);
  if (width < 40 || height < 40) return null;

  // Yerleşimi kadraja sığdır: kuvvet çözümü kart oranını bilmiyor.
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const k = Math.min((width - pad * 2) / Math.max(1, x1 - x0), (height - pad * 2) / Math.max(1, y1 - y0), 1.6);
  const px = (x: number) => (x - (x0 + x1) / 2) * k + width / 2;
  const py = (y: number) => (y - (y0 + y1) / 2) * k + height / 2;

  const maxTotal = Math.max(1, ...model.totals);
  const nodeR = (i: number) => o.networkNodeSize * (0.55 + 0.75 * Math.sqrt(model.totals[i] / maxTotal));

  return (
    <Reveal isStatic={isStatic} animate={o.animate}>
      {model.links.map((l, i) => {
        const a = nodes[l.source];
        const b = nodes[l.target];
        return (
          <line
            key={`l${i}`}
            x1={px(a.x ?? 0)}
            y1={py(a.y ?? 0)}
            x2={px(b.x ?? 0)}
            y2={py(b.y ?? 0)}
            stroke={colors[l.source % colors.length]}
            strokeOpacity={o.linkOpacity}
            strokeWidth={1 + (l.value / model.maxValue) * 6}
            strokeLinecap="round"
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={px(n.x ?? 0)} cy={py(n.y ?? 0)} r={nodeR(i)} fill={colors[i % colors.length]} />
          {o.nodeLabels && (
            <text
              className={VIZ.strong}
              x={px(n.x ?? 0)}
              y={py(n.y ?? 0) - nodeR(i) - 5}
              textAnchor="middle"
              fontSize={11.5}
            >
              {ellipsize(n.name, 11.5, 96)}
            </text>
          )}
        </g>
      ))}
    </Reveal>
  );
}

/* ---------------- yay ---------------- */

function ArcBody({ spec, colors, isStatic, model, width, height }: BodyProps) {
  const o = spec.options;
  const labelH = o.nodeLabels ? 40 : 10;
  const baseY = height - labelH;
  const n = model.names.length;
  if (n < 2 || baseY < 20) return null;

  const pad = 24;
  const step = (width - pad * 2) / Math.max(1, n - 1);
  const x = (i: number) => pad + i * step;
  const maxTotal = Math.max(1, ...model.totals);
  const maxArc = baseY * o.arcHeight;

  return (
    <Reveal isStatic={isStatic} animate={o.animate}>
      <line className={VIZ.hair} x1={pad - 8} x2={width - pad + 8} y1={baseY} y2={baseY} />
      {model.links.map((l, i) => {
        const x1 = x(l.source);
        const x2 = x(l.target);
        const span = Math.abs(x2 - x1);
        // Yayın yüksekliği açıklığa orantılı; en geniş bağlantı tavana değer.
        const h = Math.min(maxArc, (span / Math.max(1, width - pad * 2)) * maxArc * 1.6 + 18);
        return (
          <path
            key={`a${i}`}
            d={`M${x1},${baseY} A${span / 2},${h} 0 0,${x2 > x1 ? 1 : 0} ${x2},${baseY}`}
            fill="none"
            stroke={colors[l.source % colors.length]}
            strokeOpacity={o.linkOpacity}
            strokeWidth={1 + (l.value / model.maxValue) * 7}
            strokeLinecap="round"
          />
        );
      })}
      {model.names.map((name, i) => (
        <g key={`p${i}`}>
          <circle
            cx={x(i)}
            cy={baseY}
            r={4 + Math.sqrt(model.totals[i] / maxTotal) * 5}
            fill={colors[i % colors.length]}
          />
          {o.nodeLabels && (
            <text
              className={VIZ.strong}
              transform={`translate(${x(i)} ${baseY + 12}) rotate(${n > 8 ? 38 : 0})`}
              textAnchor={n > 8 ? "start" : "middle"}
              dy={n > 8 ? "0.32em" : "0.7em"}
              fontSize={11}
            >
              {ellipsize(name, 11, n > 8 ? labelH * 1.8 : step)}
            </text>
          )}
        </g>
      ))}
    </Reveal>
  );
}
