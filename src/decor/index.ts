/**
 * Karta gömülü dekor katmanı — SVG'nin içine giren, grafiğin kendisi
 * olmayan görsel malzeme. Elle yerleştirilen dekor nesneleri ayrı bir
 * sistemdir, bkz. `decor/registry.ts`.
 *
 * - `bloom`    ışıma, yaprak, patlama, halka
 * - `gradients` palete bağlı gradyan hazır ayarları
 * - `patterns` nokta, ızgara, yarım ton, çapraz, dalga, ASCII dokusu
 * - `ascii`    kutu çizgileri, blok gölgeler, metin içi bar ve sparkline
 *
 * Hepsi çevrimdışı: dış istek yok, yazı tipi indirmesi yok, `currentColor` ve
 * palet renkleriyle çalışır.
 */
export { ASCII, asciiBar, asciiBox, asciiField, asciiLeader, asciiSparkline, type AsciiBoxStyle } from "./ascii";
export { BLOOM_SHAPES, Bloom, type BloomProps, type BloomShape } from "./bloom";
export { AccentBar, CardDecor } from "./CardDecor";
export { DecorGradientDef, GRADIENT_LABELS, type GradientKind } from "./gradients";
export { DecorPatternDef, PATTERN_LABELS, type PatternKind } from "./patterns";
