import { CustomProjection } from "@visx/geo";
import { Group } from "@visx/group";
import { scaleSqrt } from "@visx/scale";
import { geoEqualEarth, geoMercator, geoNaturalEarth1, geoOrthographic } from "d3-geo";
import { useMemo } from "react";

import { toRegion } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { regionSource, scopeExtent, type CountryFeature } from "@/lib/geo";
import { Empty, Reveal, VIZ, VizFrame, contrastText, ellipsize, mix, type VizProps } from "./common";
import { WithLegend } from "./with-legend";

const PROJECTIONS = {
  mercator: geoMercator,
  naturalEarth: geoNaturalEarth1,
  equalEarth: geoEqualEarth,
  orthographic: geoOrthographic,
};

/**
 * Flourish'in "Projection map" ailesi: choropleth (bölge boyama) ve kabarcık
 * haritası. Sınırlar tek dosyaya gömülü TopoJSON'dan gelir — dünya için
 * `world-atlas` 110m, "Türkiye (iller)" kapsamı için 81 ilin kendi tablosu.
 * Ad çözümlemesi kapsamla birlikte değişiyor: dünyada "Almanya / Germany / DE /
 * 276", illerde "İstanbul / 34 / TR-34".
 */
export function MapViz({ spec, colors, isStatic, theme }: VizProps) {
  const o = spec.options;
  const kaynak = useMemo(() => regionSource(o.mapScope), [o.mapScope]);
  const features = kaynak.features;
  const model = useMemo(() => toRegion(spec, kaynak.resolve), [spec, kaynak]);

  // Tablo tamamen boşken çizecek bir şey yok; yönerge gösteriliyor.
  //
  // Ama satırlar **varsa** harita çiziliyor, hiçbiri eşleşmese bile: kapsamı
  // "Türkiye (iller)" yapan kullanıcının elinde ülke adları kalmış olabilir ve
  // o durumda tek bir uyarı cümlesi göstermek "iller gelmedi" gibi okunuyordu.
  // Boş boyalı harita ile altındaki uyarı birlikte hem neyin çizileceğini hem
  // de ne yazılması gerektiğini söylüyor.
  if (model.count === 0 && model.unmatched.length === 0) {
    return <Empty text={kaynak.ipucu} />;
  }
  const bosVeri = model.count === 0;

  const base = colors[0];
  const empty = theme === "dark" ? "#26261f" : "#e8e8e4";
  const border = theme === "dark" ? "#0b0b0b" : "#ffffff";
  const span = model.max - model.min;

  /** Choropleth kademesi: değeri kart zemininden ana renge doğru taşır. */
  const fillFor = (id: string | undefined) => {
    if (id == null) return empty;
    const v = model.byId.get(String(id));
    if (v == null) return empty;
    const t = span <= 0 ? 1 : (v - model.min) / span;
    // Tabanda %18'den başla: en küçük değer de zeminden ayrışsın.
    return mix(theme === "dark" ? "#0b0b0b" : "#ffffff", base, 0.18 + t * 0.82);
  };

  // Sıralı ölçeğin göstergesi: en küçükten en büyüğe beş kademe.
  const legendSteps = 5;
  const items = Array.from({ length: legendSteps }, (_, i) => {
    const t = i / (legendSteps - 1);
    return {
      label: formatNumber(model.min + span * t, o.format),
      value: model.min + span * t,
      color: mix(theme === "dark" ? "#0b0b0b" : "#ffffff", base, 0.18 + t * 0.82),
    };
  });

  return (
    <WithLegend spec={spec} items={o.mapMode === "choropleth" && !bosVeri ? items : []}>
      <VizFrame clip>
        {({ width, height }) => {
          const rs = scaleSqrt<number>({ domain: [0, model.max], range: [2, o.mapBubbleMax] });
          const fit = scopeExtent(o.mapScope);
          return (
            <Reveal isStatic={isStatic} animate={o.animate}>
              <CustomProjection<CountryFeature>
                data={features}
                projection={PROJECTIONS[o.mapProjection]}
                fitExtent={[
                  [
                    [4, 4],
                    [width - 4, height - 4],
                  ],
                  // fitExtent GeoJSON Feature bekler; kapsam penceresi bir dikdörtgen.
                  fit as never,
                ]}
              >
                {({ features: shapes, path }) => (
                  <Group>
                    {shapes.map(({ feature: f, path: d, index }) => {
                      if (!d) return null;
                      const value = f.id == null ? undefined : model.byId.get(String(f.id));
                      return (
                        <path
                          key={`c${index}`}
                          d={d}
                          fill={o.mapMode === "choropleth" ? fillFor(f.id == null ? undefined : String(f.id)) : empty}
                          stroke={border}
                          strokeWidth={0.5}
                          fillOpacity={o.mapMode === "bubble" && value != null ? 0.85 : 1}
                        />
                      );
                    })}

                    {o.mapMode === "bubble" &&
                      shapes.map(({ feature: f, index }) => {
                        if (f.id == null) return null;
                        const value = model.byId.get(String(f.id));
                        if (value == null) return null;
                        const c = path.centroid(f);
                        if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
                        return (
                          <circle
                            key={`b${index}`}
                            cx={c[0]}
                            cy={c[1]}
                            r={rs(value)}
                            fill={base}
                            fillOpacity={0.7}
                            stroke={base}
                            strokeWidth={1}
                          />
                        );
                      })}

                    {o.mapLabels &&
                      shapes.map(({ feature: f, index }) => {
                        if (f.id == null) return null;
                        const value = model.byId.get(String(f.id));
                        if (value == null) return null;
                        const c = path.centroid(f);
                        if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
                        const fill =
                          o.mapMode === "choropleth" ? contrastText(fillFor(String(f.id))) : "var(--ink-primary)";
                        return (
                          <text
                            key={`t${index}`}
                            x={c[0]}
                            y={c[1]}
                            textAnchor="middle"
                            dy="0.34em"
                            fontSize={10}
                            fontWeight={600}
                            fill={fill}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatNumber(value, o.format)}
                          </text>
                        );
                      })}
                  </Group>
                )}
              </CustomProjection>

              {model.unmatched.length > 0 && (
                <text className={VIZ.label} x={2} y={height - 2} fontSize={10}>
                  {ellipsize(
                    bosVeri
                      ? `Hiçbiri eşleşmedi (${model.unmatched.slice(0, 3).join(", ")}). ${kaynak.tanimsiz}`
                      : `Eşleşmeyen: ${model.unmatched.join(", ")}`,
                    10,
                    width - 8
                  )}
                </text>
              )}
            </Reveal>
          );
        }}
      </VizFrame>
    </WithLegend>
  );
}
