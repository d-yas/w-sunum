/**
 * Categorical slot → CSS variable.
 *
 * The palette has four validated slots and a mono "Diğer" fifth. Callers
 * must have already folded anything past the fourth into one bucket — this
 * deliberately does NOT cycle, because a repeated hue would say "same
 * category" about two different things.
 */
export function seriesColor(index: number): string {
  return index < 4 ? `var(--chart-${index + 1})` : "var(--chart-5)";
}
