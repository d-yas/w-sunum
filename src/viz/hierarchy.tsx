import { Group } from "@visx/group";
import { Pack, Partition, Treemap, hierarchy, treemapSquarify } from "@visx/hierarchy";
import { arc as d3arc } from "d3-shape";
import { useMemo } from "react";

import { toHierarchy, type HierarchyDatum } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { Empty, Reveal, VIZ, VizFrame, contrastText, ellipsize, mix, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

/**
 * Flourish'in "Hierarchy" ailesi: ağaç haritası, güneş patlaması ve daire
 * yığını. Üçü de aynı `Ana grup ; Alt grup ; Değer` tablosunu okur, yalnız
 * yerleşim değişir — tür değiştirince veri korunur.
 */
export function HierarchyViz({ spec, colors, isStatic, theme }: VizProps) {
  const o = spec.options;
  const model = useMemo(() => toHierarchy(spec), [spec]);

  const root = useMemo(
    () =>
      hierarchy<HierarchyDatum>(model.root)
        .sum((d) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [model]
  );

  if (model.leaves === 0) {
    return <Empty text="Ana grup, alt grup ve pozitif bir değer girin (örn. Yazılım ; Lisans ; 420)." />;
  }

  const items = model.groups.map((g, i) => ({
    label: g,
    value: root.children?.find((c) => c.data.name === g)?.value ?? 0,
    color: colors[i % colors.length],
  }));

  /** Aynı dalın yaprakları ana renkten zemine doğru kademelenir. */
  const shadeOf = (base: string, index: number, count: number) => {
    if (o.hierarchyColorDepth === 1) return base;
    const t = count <= 1 ? 0 : (index / (count - 1)) * 0.45;
    return mix(base, theme === "dark" ? "#0b0b0b" : "#ffffff", t);
  };

  return (
    <WithLegend spec={spec} items={items}>
      <VizFrame>
        {({ width, height }) => (
          <Reveal isStatic={isStatic} animate={o.animate}>
            {spec.kind === "treemap" && (
              <TreemapBody
                {...{ width, height, root, model, o, colors, shadeOf }}
                format={(v: number) => formatNumber(v, o.format)}
              />
            )}
            {spec.kind === "sunburst" && (
              <SunburstBody
                {...{ width, height, root, model, o, colors, shadeOf }}
                format={(v: number) => formatNumber(v, o.format)}
              />
            )}
            {spec.kind === "pack" && (
              <PackBody
                {...{ width, height, root, model, o, colors, shadeOf }}
                format={(v: number) => formatNumber(v, o.format)}
              />
            )}
          </Reveal>
        )}
      </VizFrame>
    </WithLegend>
  );
}

type Root = ReturnType<typeof hierarchy<HierarchyDatum>>;

interface BodyProps {
  width: number;
  height: number;
  root: Root;
  model: ReturnType<typeof toHierarchy>;
  o: VizProps["spec"]["options"];
  colors: string[];
  shadeOf: (base: string, index: number, count: number) => string;
  format: (v: number) => string;
}

/** Ana grubun palet sırası — renk buradan çözülür. */
function groupIndexOf(node: { ancestors: () => { depth: number; data: HierarchyDatum }[] }, groups: string[]): number {
  const top = node.ancestors().find((a) => a.depth === 1);
  const i = top ? groups.indexOf(top.data.name) : -1;
  return i < 0 ? 0 : i;
}

/* ---------------- ağaç haritası ---------------- */

function TreemapBody({ width, height, root, model, o, colors, shadeOf, format }: BodyProps) {
  const header = o.hierarchyLabels ? 17 : o.hierarchyPad;
  return (
    <Treemap<HierarchyDatum>
      root={root}
      size={[width, height]}
      tile={treemapSquarify}
      round
      paddingInner={o.hierarchyPad}
      paddingOuter={0}
      paddingTop={header}
    >
      {(tree) => (
        <Group>
          {/* Dal başlıkları en altta; yapraklar üstüne çizilir. */}
          {o.hierarchyLabels &&
            tree
              .descendants()
              .filter((n) => n.depth === 1 && n.children)
              .map((n) => (
                <text
                  key={`h-${n.data.name}`}
                  className={VIZ.strong}
                  x={n.x0 + 2}
                  y={n.y0 + 12}
                  fontSize={12}
                >
                  {ellipsize(n.data.name, 12, n.x1 - n.x0 - 4)}
                </text>
              ))}
          {tree.leaves().map((leaf, i) => {
            const w = leaf.x1 - leaf.x0;
            const h = leaf.y1 - leaf.y0;
            if (w < 1 || h < 1) return null;
            const gi = groupIndexOf(leaf, model.groups);
            const siblings = leaf.parent?.children?.length ?? 1;
            const idx = leaf.parent?.children?.indexOf(leaf) ?? 0;
            const fill = shadeOf(colors[gi % colors.length], idx, siblings);
            const ink = contrastText(fill);
            const showLabel = o.hierarchyLabels && w > 44 && h > 22;
            const showValue = o.hierarchyValues && w > 44 && h > 34;
            return (
              <Group key={`l-${i}`} top={leaf.y0} left={leaf.x0}>
                <rect width={w} height={h} rx={2} fill={fill} />
                {showLabel && (
                  <text x={6} y={15} fontSize={11.5} fontWeight={600} fill={ink}>
                    {ellipsize(leaf.data.name, 11.5, w - 12)}
                  </text>
                )}
                {showValue && (
                  <text x={6} y={30} fontSize={11} fill={ink} fillOpacity={0.82} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {format(leaf.value ?? 0)}
                  </text>
                )}
              </Group>
            );
          })}
        </Group>
      )}
    </Treemap>
  );
}

/* ---------------- güneş patlaması ---------------- */

function SunburstBody({ width, height, root, model, o, colors, shadeOf, format }: BodyProps) {
  const outer = Math.min(width, height) / 2 - 2;
  const inner = (outer * o.sunburstInner) / 100;
  const band = outer - inner;
  if (band <= 4) return null;

  const depth = Math.max(1, root.height);
  const arcGen = d3arc<{ x0: number; x1: number; r0: number; r1: number }>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.r0)
    .outerRadius((d) => d.r1)
    .padAngle(0.004)
    .cornerRadius(1.5);

  return (
    <Partition<HierarchyDatum> root={root} size={[2 * Math.PI, band]}>
      {(part) => (
        <Group top={height / 2} left={width / 2}>
          {part
            .descendants()
            .filter((n) => n.depth > 0)
            .map((n, i) => {
              // Tek çocuklu daldan yaprağa dönmüş düğümler dış halkaya taşar.
              const isShortLeaf = !n.children && n.depth < depth;
              const r0 = inner + (n.y0 / band) * band;
              const r1 = isShortLeaf ? inner + band : inner + (n.y1 / band) * band;
              const gi = groupIndexOf(n, model.groups);
              const siblings = n.parent?.children?.length ?? 1;
              const idx = n.parent?.children?.indexOf(n) ?? 0;
              const fill = n.depth === 1 ? colors[gi % colors.length] : shadeOf(colors[gi % colors.length], idx, siblings);
              const d = arcGen({ x0: n.x0, x1: n.x1, r0, r1 });
              if (!d) return null;

              const angle = (n.x0 + n.x1) / 2;
              const sweep = n.x1 - n.x0;
              const rMid = (r0 + r1) / 2;
              // Dilim yayı etiketi taşıyacak kadar genişse ortasına yazılır.
              const showLabel = o.hierarchyLabels && sweep * rMid > 42 && r1 - r0 > 16;
              const deg = (angle * 180) / Math.PI - 90;
              const flip = deg > 90 || deg < -90;
              const ink = contrastText(fill);
              return (
                <g key={`a-${i}`}>
                  <path d={d} fill={fill} />
                  {showLabel && (
                    <text
                      transform={`rotate(${deg}) translate(${rMid} 0) rotate(${flip ? 180 : 0})`}
                      textAnchor="middle"
                      dy="0.34em"
                      fontSize={11}
                      fontWeight={n.depth === 1 ? 600 : 400}
                      fill={ink}
                    >
                      {ellipsize(n.data.name, 11, (r1 - r0) * 0.95)}
                    </text>
                  )}
                </g>
              );
            })}
          {o.hierarchyValues && inner > 26 && (
            <text className={VIZ.value} textAnchor="middle" dy="0.34em" fontSize={Math.min(22, inner * 0.42)} fontWeight={700}>
              {format(root.value ?? 0)}
            </text>
          )}
        </Group>
      )}
    </Partition>
  );
}

/* ---------------- daire yığını ---------------- */

function PackBody({ width, height, root, model, o, colors, shadeOf, format }: BodyProps) {
  const size = Math.min(width, height);
  return (
    <Pack<HierarchyDatum> root={root} size={[size, size]} padding={o.hierarchyPad + 1}>
      {(pack) => (
        <Group top={(height - size) / 2} left={(width - size) / 2}>
          {pack
            .descendants()
            .filter((n) => n.depth > 0)
            .map((n, i) => {
              const gi = groupIndexOf(n, model.groups);
              const base = colors[gi % colors.length];
              const siblings = n.parent?.children?.length ?? 1;
              const idx = n.parent?.children?.indexOf(n) ?? 0;
              const isBranch = Boolean(n.children);
              const fill = isBranch ? "none" : shadeOf(base, idx, siblings);
              const showLabel = o.hierarchyLabels && !isBranch && n.r > 22;
              const showValue = o.hierarchyValues && !isBranch && n.r > 32;
              return (
                <g key={`p-${i}`}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill={fill}
                    stroke={isBranch ? base : "none"}
                    strokeOpacity={isBranch ? 0.45 : undefined}
                    strokeDasharray={isBranch ? "3 3" : undefined}
                  />
                  {showLabel && (
                    <text
                      x={n.x}
                      y={n.y}
                      textAnchor="middle"
                      dy={showValue ? "-0.1em" : "0.34em"}
                      fontSize={11.5}
                      fontWeight={600}
                      fill={contrastText(fill)}
                    >
                      {ellipsize(n.data.name, 11.5, n.r * 1.7)}
                    </text>
                  )}
                  {showValue && (
                    <text
                      x={n.x}
                      y={n.y}
                      textAnchor="middle"
                      dy="1.15em"
                      fontSize={10.5}
                      fill={contrastText(fill)}
                      fillOpacity={0.82}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {format(n.value ?? 0)}
                    </text>
                  )}
                </g>
              );
            })}
        </Group>
      )}
    </Pack>
  );
}
