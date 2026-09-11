export interface Palette {
  id: string;
  name: string;
  note: string;
  light: string[];
  dark: string[];
}

/**
 * Categorical palettes. Order matters — it is the colour-blind-safety
 * mechanism (adjacent pairs validated), never a cosmetic sequence.
 */
export const PALETTES: Palette[] = [
  {
    id: "varsayilan",
    name: "Varsayılan",
    note: "Doğrulanmış 8 renk; bitişik çiftler renk körlüğüne dayanıklı.",
    light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
    dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  },
  {
    id: "mavi-tonlar",
    name: "Mavi tonlar",
    note: "Tek renk, koyudan açığa. Sıralı kategoriler (kademeler) için.",
    light: ["#0d366b", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef"],
    dark: ["#b7d3f6", "#86b6ef", "#5598e7", "#256abf", "#184f95"],
  },
  {
    id: "gri",
    name: "Gri + vurgu",
    note: "Tek vurgu + griler. Griler bilerek ayırt edilmez; 'biz ve diğerleri' anlatısı için.",
    light: ["#2a78d6", "#9a9994", "#b8b7b1", "#d0cfc9", "#7a7975", "#5e5d59"],
    dark: ["#3987e5", "#8b8a85", "#6e6d68", "#55544f", "#a8a7a1", "#c3c2b7"],
  },
  {
    id: "sicak",
    name: "Sıcak",
    note: "Turuncu açılış, sıcak tonlar; bitişik çiftler doğrulanmış.",
    light: ["#eb6834", "#4a3aa7", "#eda100", "#e87ba4", "#2a78d6", "#e34948"],
    dark: ["#d95926", "#9085e9", "#c98500", "#d55181", "#3987e5", "#e66767"],
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Resolve the colour of series `i` — custom override first, then palette. */
export function seriesColor(i: number, custom: string[], palette: Palette, theme: "light" | "dark"): string {
  const c = custom[i];
  if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  const list = theme === "dark" ? palette.dark : palette.light;
  return list[i % list.length] ?? list[0];
}
