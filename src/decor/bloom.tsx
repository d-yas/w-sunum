import { useId } from "react";

/**
 * "Bloom" — bir rengin arkada yumuşak bir ışıma bırakması. Kurum slaytlarında
 * boş köşeyi doldurmak ve grafiğin ana rengini kartın geneline taşımak için
 * kullanılır.
 *
 * Hepsi saf SVG: radyal gradyan + şekil. `filter: blur()` bilerek kullanılmaz —
 * PNG dışa aktarımı `<foreignObject>` üzerinden gittiği için filtreler
 * tarayıcılar arasında farklı çözünürlükte rasterlanır; gradyan her yerde aynı
 * çıkar.
 */

export type BloomShape = "glow" | "petals" | "burst" | "rings" | "orb";

export interface BloomProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  shape?: BloomShape;
  opacity?: number;
  /** Yaprak / ışın sayısı. */
  count?: number;
  rotate?: number;
}

export function Bloom({ cx, cy, r, color, shape = "glow", opacity = 0.35, count = 8, rotate = 0 }: BloomProps) {
  const uid = useId().replace(/:/g, "");
  const gid = `bloom-${uid}`;

  const fade = (
    <radialGradient id={gid}>
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="45%" stopColor={color} stopOpacity={opacity * 0.55} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );

  if (shape === "glow" || shape === "orb") {
    return (
      <g>
        <defs>{fade}</defs>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
        {shape === "orb" && <circle cx={cx} cy={cy} r={r * 0.22} fill={color} fillOpacity={opacity * 0.9} />}
      </g>
    );
  }

  if (shape === "rings") {
    return (
      <g>
        {Array.from({ length: count }, (_, i) => {
          const t = (i + 1) / count;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r * t}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(0.6, r * 0.012)}
              strokeOpacity={opacity * (1 - t) * 1.6}
            />
          );
        })}
      </g>
    );
  }

  if (shape === "burst") {
    return (
      <g>
        <defs>{fade}</defs>
        <circle cx={cx} cy={cy} r={r * 0.9} fill={`url(#${gid})`} />
        {Array.from({ length: count * 2 }, (_, i) => {
          const a = rotate * (Math.PI / 180) + (i / (count * 2)) * Math.PI * 2;
          const inner = r * 0.18;
          const outer = r * (i % 2 === 0 ? 1 : 0.62);
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cy + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * outer}
              y2={cy + Math.sin(a) * outer}
              stroke={color}
              strokeWidth={Math.max(0.8, r * 0.018)}
              strokeOpacity={opacity * 0.8}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    );
  }

  // petals — kesişen elips yaprakları, çiçek benzeri açılım
  return (
    <g>
      <defs>{fade}</defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
        {Array.from({ length: count }, (_, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={-r * 0.42}
            rx={r * 0.2}
            ry={r * 0.44}
            fill={color}
            fillOpacity={opacity * 0.45}
            transform={`rotate(${(i / count) * 360})`}
          />
        ))}
      </g>
    </g>
  );
}

export const BLOOM_SHAPES: { id: BloomShape; label: string }[] = [
  { id: "glow", label: "Işıma" },
  { id: "orb", label: "Küre" },
  { id: "petals", label: "Yaprak" },
  { id: "burst", label: "Patlama" },
  { id: "rings", label: "Halkalar" },
];
