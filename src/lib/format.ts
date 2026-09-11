export type Locale = "tr-TR" | "en-US";

export interface NumberFormatSpec {
  locale: Locale;
  decimals: number;
  prefix: string;
  suffix: string;
  compact: boolean;
}

export const DEFAULT_FORMAT: NumberFormatSpec = {
  locale: "tr-TR",
  decimals: 0,
  prefix: "",
  suffix: "",
  compact: false,
};

const cache = new Map<string, Intl.NumberFormat>();

function getFormatter(spec: NumberFormatSpec, decimals: number) {
  const key = `${spec.locale}|${decimals}|${spec.compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(spec.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
      notation: spec.compact ? "compact" : "standard",
    });
    cache.set(key, f);
  }
  return f;
}

/** Format a value with the chart's number spec (prefix/suffix included). */
export function formatNumber(value: number, spec: NumberFormatSpec): string {
  if (!Number.isFinite(value)) return "–";
  return `${spec.prefix}${getFormatter(spec, spec.decimals).format(value)}${spec.suffix}`;
}

/** Axis ticks: allow a few more decimals when the step is fractional. */
export function formatTick(value: number, spec: NumberFormatSpec, step?: number): string {
  let decimals = spec.decimals;
  if (step != null && step > 0 && step < 1) {
    // Enough places to print the step exactly (0.25 → 2), capped at 4.
    const places = (step.toFixed(6).replace(/0+$/, "").split(".")[1] ?? "").length;
    decimals = Math.max(decimals, Math.min(4, places));
  }
  return `${spec.prefix}${getFormatter(spec, decimals).format(value)}${spec.suffix}`;
}

export type DateGranularity = "auto" | "day" | "month" | "quarter" | "year";

export function formatDate(d: Date, locale: Locale, granularity: DateGranularity, spanMs?: number): string {
  let g = granularity;
  if (g === "auto") {
    const span = spanMs ?? 0;
    const day = 86_400_000;
    if (span > 3 * 365 * day) g = "year";
    else if (span > 120 * day) g = "month";
    else g = "day";
  }
  switch (g) {
    case "year":
      return String(d.getFullYear());
    case "quarter":
      return `${locale === "tr-TR" ? "Ç" : "Q"}${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    case "month":
      return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(d);
    default:
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
  }
}

export function formatDateLong(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}
