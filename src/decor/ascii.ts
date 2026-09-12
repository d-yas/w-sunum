/**
 * Temel ASCII / Unicode glif setleri ve metin tabanlı mini görselleştirmeler.
 *
 * Dekor paketinin yazı tarafı: kutu çizgileri, blok gölgeler, oklar, madde
 * imleri. Hepsi düz metin olduğu için PNG dışa aktarımında yazı tipiyle birlikte
 * serileştirilir — SVG'ye gömülü glif gerekmez. Sistem yazı yığını bu blokları
 * (U+2500–U+259F) taşır; egzotik sembol kullanılmaz.
 */

export const ASCII = {
  /** Gölge blokları — açıktan koyuya. */
  shades: ["░", "▒", "▓", "█"],
  /** Sekiz kademeli dikey blok — metin içi sparkline. */
  sparks: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"],
  /** Sekiz kademeli yatay blok — metin içi bar. */
  bars: ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"],
  /** Tek çizgi kutu. */
  box: { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘", lt: "├", rt: "┤", tt: "┬", bt: "┴", x: "┼" },
  /** Yuvarlatılmış kutu. */
  boxRound: { h: "─", v: "│", tl: "╭", tr: "╮", bl: "╰", br: "╯" },
  /** Çift çizgi kutu. */
  boxDouble: { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" },
  /** Kalın kutu. */
  boxHeavy: { h: "━", v: "┃", tl: "┏", tr: "┓", bl: "┗", br: "┛" },
  arrows: {
    left: "←",
    up: "↑",
    right: "→",
    down: "↓",
    leftRight: "↔",
    upDown: "↕",
    upLeft: "↖",
    upRight: "↗",
    downRight: "↘",
    downLeft: "↙",
    doubleRight: "⇒",
    longRight: "⟶",
    triRight: "►",
    triLeft: "◄",
    triUp: "▲",
    triDown: "▼",
  },
  bullets: ["•", "◦", "‣", "▪", "▫", "◆", "◇", "●", "○", "◉"],
  marks: { check: "✓", cross: "✗", times: "×", plus: "+", minus: "−", pm: "±", approx: "≈", ne: "≠", le: "≤", ge: "≥" },
  /** Nokta dizisi — içindekiler tablosu ya da ayraç. */
  leader: "·",
} as const;

export type AsciiBoxStyle = "single" | "round" | "double" | "heavy";

const BOX_STYLES: Record<AsciiBoxStyle, { h: string; v: string; tl: string; tr: string; bl: string; br: string }> = {
  single: ASCII.box,
  round: ASCII.boxRound,
  double: ASCII.boxDouble,
  heavy: ASCII.boxHeavy,
};

/** Oranı (0–1) `width` karakterlik bloklu bir çubuğa çevirir. */
export function asciiBar(ratio: number, width = 12): string {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const total = r * width;
  const full = Math.floor(total);
  const rest = total - full;
  const partial = rest > 0.05 ? ASCII.bars[Math.min(7, Math.max(0, Math.round(rest * 8) - 1))] : "";
  return ("█".repeat(full) + partial).padEnd(width, " ");
}

/** Sayı dizisini tek satırlık blok sparkline'a çevirir. */
export function asciiSparkline(values: number[]): string {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return "";
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo;
  return values
    .map((v) => {
      if (!Number.isFinite(v)) return " ";
      const t = span === 0 ? 0.5 : (v - lo) / span;
      return ASCII.sparks[Math.min(7, Math.max(0, Math.round(t * 7)))];
    })
    .join("");
}

/** Satırları çerçeveye alır; en uzun satıra göre hizalar. */
export function asciiBox(lines: string[], style: AsciiBoxStyle = "round", pad = 1): string[] {
  const s = BOX_STYLES[style];
  const width = lines.reduce((a, l) => Math.max(a, [...l].length), 0) + pad * 2;
  const bar = s.h.repeat(width);
  const gap = " ".repeat(pad);
  return [
    s.tl + bar + s.tr,
    ...lines.map((l) => s.v + gap + l.padEnd(width - pad * 2, " ") + gap + s.v),
    s.bl + bar + s.br,
  ];
}

/** "Etiket ···· 42" biçiminde nokta dolgulu satır. */
export function asciiLeader(left: string, right: string, width = 32): string {
  const gap = Math.max(1, width - [...left].length - [...right].length);
  return left + ASCII.leader.repeat(gap) + right;
}

/** Gölge bloklarından `rows × cols` boyutunda dokusal bir desen üretir. */
export function asciiField(rows: number, cols: number, seed = 1): string[] {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => {
      const r = rand();
      return r < 0.55 ? " " : ASCII.shades[Math.min(3, Math.floor((r - 0.55) * 9))];
    }).join("")
  );
}
