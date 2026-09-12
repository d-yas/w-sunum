/**
 * Gradyan hazır ayarları. Renkler grafiğin paletinden gelir, tema
 * token'larından değil — böylece kartın dekoru serilerle aynı renk ailesinde
 * kalır.
 *
 * `color-mix()` ya da `filter` kullanılmaz: PNG dışa aktarımı klonlanmış DOM'u
 * rasterlar ve düz `stop-color` her yerde aynı çıkar.
 */

export type GradientKind = "soft" | "vivid" | "edge" | "wash";

export interface DecorGradientDefProps {
  id: string;
  kind: GradientKind;
  /** Birincil renk — genelde birinci seri. */
  from: string;
  /** İkincil renk — genelde ikinci ya da üçüncü seri. */
  to: string;
}

export function DecorGradientDef({ id, kind, from, to }: DecorGradientDefProps) {
  switch (kind) {
    // Köşeden köşeye çok hafif bir renk sızması.
    case "soft":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} stopOpacity={0.14} />
          <stop offset="55%" stopColor={from} stopOpacity={0.03} />
          <stop offset="100%" stopColor={to} stopOpacity={0.1} />
        </linearGradient>
      );
    // Belirgin, iki renkli köşegen.
    case "vivid":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} stopOpacity={0.34} />
          <stop offset="100%" stopColor={to} stopOpacity={0.26} />
        </linearGradient>
      );
    // Yalnız alt kenarda biriken bir taban.
    case "edge":
      return (
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={from} stopOpacity={0.28} />
          <stop offset="38%" stopColor={from} stopOpacity={0.05} />
          <stop offset="100%" stopColor={from} stopOpacity={0} />
        </linearGradient>
      );
    // Merkezden dışa açılan geniş yıkama.
    case "wash":
      return (
        <radialGradient id={id} cx="50%" cy="0%" r="120%">
          <stop offset="0%" stopColor={from} stopOpacity={0.24} />
          <stop offset="60%" stopColor={to} stopOpacity={0.08} />
          <stop offset="100%" stopColor={to} stopOpacity={0} />
        </radialGradient>
      );
  }
}

export const GRADIENT_LABELS: Record<GradientKind, string> = {
  soft: "Yumuşak",
  vivid: "Canlı",
  edge: "Taban",
  wash: "Yıkama",
};
