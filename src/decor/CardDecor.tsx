import { useId } from "react";

import type { ChartOptions } from "@/lib/spec";
import { Bloom } from "./bloom";
import { DecorGradientDef } from "./gradients";
import { DecorPatternDef } from "./patterns";

export interface CardDecorProps {
  width: number;
  height: number;
  options: ChartOptions;
  /** Kartın çözülmüş seri renkleri. */
  colors: string[];
}

/**
 * Kartın arkasındaki dekor katmanı: gradyan yıkama, doku deseni ve bloom.
 * İçeriğin altında, `pointer-events: none` ile durur.
 *
 * `data-decor` işareti önemli: "SVG indir" kart içindeki ilk `<svg>`'yi alır,
 * o seçici bu katmanı atlamak zorunda (bkz. App.tsx).
 */
export function CardDecor({ width, height, options: o, colors }: CardDecorProps) {
  const uid = useId().replace(/:/g, "");
  const gradient = o.decorGradient === "none" ? null : o.decorGradient;
  const pattern = o.decorPattern === "none" ? null : o.decorPattern;
  const hasBloom = o.decorBloom !== "none";
  if (!gradient && !pattern && !hasBloom) return null;

  const gid = `dg-${uid}`;
  const pid = `dp-${uid}`;
  const from = colors[0] ?? "#2a78d6";
  const to = colors[2] ?? colors[1] ?? from;
  const bloomColor = colors[Math.max(0, Math.min(colors.length - 1, o.decorBloomSeries))] ?? from;
  const short = Math.min(width, height);

  return (
    <svg
      data-decor="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        {gradient && <DecorGradientDef id={gid} kind={gradient} from={from} to={to} />}
        {pattern && <DecorPatternDef id={pid} kind={pattern} color={from} size={pattern === "ascii" ? 20 : 22} />}
      </defs>

      {gradient && <rect width={width} height={height} fill={`url(#${gid})`} />}
      {pattern && <rect width={width} height={height} fill={`url(#${pid})`} opacity={o.decorPatternOpacity} />}

      {o.decorBloom === "topRight" && (
        <Bloom cx={width * 0.94} cy={height * 0.04} r={short * 0.62} color={bloomColor} shape="glow" />
      )}
      {o.decorBloom === "bottomLeft" && (
        <Bloom cx={width * 0.04} cy={height * 0.98} r={short * 0.62} color={bloomColor} shape="glow" />
      )}
      {o.decorBloom === "center" && (
        <Bloom cx={width / 2} cy={height / 2} r={short * 0.78} color={bloomColor} shape="rings" opacity={0.22} count={7} />
      )}
      {o.decorBloom === "corners" && (
        <>
          <Bloom cx={width * 0.97} cy={height * 0.03} r={short * 0.5} color={bloomColor} shape="petals" opacity={0.24} count={6} rotate={18} />
          <Bloom cx={width * 0.03} cy={height * 0.97} r={short * 0.44} color={colors[1] ?? bloomColor} shape="glow" opacity={0.26} />
        </>
      )}
    </svg>
  );
}

/** Başlığın soluna konan ince renk çubuğu — kurum şablonlarındaki vurgu. */
export function AccentBar({ color, height }: { color: string; height: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 4,
        height,
        borderRadius: 2,
        background: color,
        flex: "0 0 auto",
      }}
    />
  );
}
