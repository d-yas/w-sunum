import { PatternCircles, PatternLines, PatternWaves } from "@visx/pattern";

import { ASCII } from "./ascii";

/**
 * Doku desenleri. Nokta, ızgara ve dalga `@visx/pattern` üstünden gelir
 * (zaten kurulu); yarım ton ve ASCII dokusu burada üretilir.
 *
 * Hepsi `<defs>` içine bir `<pattern>` koyar; çağıran taraf `url(#id)` ile
 * doldurur.
 */

export type PatternKind = "dots" | "grid" | "halftone" | "diagonal" | "waves" | "ascii";

export interface DecorPatternDefProps {
  id: string;
  kind: PatternKind;
  color: string;
  /** Desen hücresinin kenarı, piksel. */
  size?: number;
}

export function DecorPatternDef({ id, kind, color, size = 22 }: DecorPatternDefProps) {
  switch (kind) {
    case "dots":
      return <PatternCircles id={id} width={size} height={size} radius={Math.max(1, size * 0.075)} fill={color} complement={false} />;
    case "grid":
      return (
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M${size},0 L0,0 0,${size}`} fill="none" stroke={color} strokeWidth={1} />
        </pattern>
      );
    case "diagonal":
      return <PatternLines id={id} width={size * 0.4} height={size * 0.4} stroke={color} strokeWidth={1} orientation={["diagonal"]} />;
    case "waves":
      return <PatternWaves id={id} width={size} height={size} stroke={color} strokeWidth={1} />;
    case "halftone":
      return <HalftoneDef id={id} color={color} size={size} />;
    case "ascii":
      return <AsciiDef id={id} color={color} size={size} />;
  }
}

/**
 * Yarım ton: hücre içinde büyüyen nokta. Tek bir `<pattern>` sabit boyutta
 * olduğu için gradyan etkisi, deseni bir maske gradyanıyla soldurarak elde
 * edilir (`DecorPatternFill` bunu yapar).
 */
function HalftoneDef({ id, color, size }: { id: string; color: string; size: number }) {
  const r = size * 0.16;
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
      <circle cx={size * 0.25} cy={size * 0.25} r={r} fill={color} />
      <circle cx={size * 0.75} cy={size * 0.75} r={r * 0.62} fill={color} />
      <circle cx={size * 0.75} cy={size * 0.25} r={r * 0.34} fill={color} />
      <circle cx={size * 0.25} cy={size * 0.75} r={r * 0.34} fill={color} />
    </pattern>
  );
}

/** Gölge bloklarından oluşan metin dokusu — dekor paketinin ASCII yüzü. */
function AsciiDef({ id, color, size }: { id: string; color: string; size: number }) {
  const cell = size * 0.86;
  const glyphs = [ASCII.shades[0], ASCII.shades[1], ASCII.shades[0], ASCII.shades[2]];
  return (
    <pattern id={id} width={size * 2} height={size * 2} patternUnits="userSpaceOnUse">
      {glyphs.map((g, i) => (
        <text
          key={i}
          x={(i % 2) * size}
          y={Math.floor(i / 2) * size + cell}
          fill={color}
          fontSize={cell}
          fontFamily="Consolas, 'Courier New', monospace"
        >
          {g}
        </text>
      ))}
    </pattern>
  );
}

export const PATTERN_LABELS: Record<PatternKind, string> = {
  dots: "Nokta",
  grid: "Izgara",
  halftone: "Yarım ton",
  diagonal: "Çapraz",
  waves: "Dalga",
  ascii: "ASCII",
};
