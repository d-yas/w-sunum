import { emptyDecor, emptyLayout, type CardLayout, type DecorState } from "@/decor/model";
import type { PptxSlideSize } from "./pptx";

import type { Palette } from "./palettes";

import { DEFAULT_FORMAT, type DateGranularity, type NumberFormatSpec } from "./format";

export type ChartKind =
  // kartezyen
  | "line"
  | "area"
  | "bar"
  | "barH"
  | "slope"
  | "radar"
  | "marimekko"
  // kategori + değer
  | "ring"
  | "gauge"
  | "funnel"
  | "waterfall"
  | "pictogram"
  // hiyerarşi
  | "treemap"
  | "sunburst"
  | "pack"
  // dağılım
  | "scatter"
  | "bubble"
  // ilişki / akış
  | "sankey"
  | "chord"
  | "network"
  | "arc"
  // özel
  | "heatmap"
  | "map";

export type Theme = "light" | "dark";
export type CurveKind = "linear" | "monotone" | "step" | "natural";
export type XMode = "auto" | "category" | "date";
export type LegendPosition = "bottom" | "right" | "top";

/** Dekor katmanı — kart arka planı ve vurgular. */
export type DecorPattern = "none" | "dots" | "grid" | "halftone" | "diagonal" | "waves" | "ascii";
export type DecorBloom = "none" | "topRight" | "bottomLeft" | "center" | "corners";
export type DecorGradient = "none" | "soft" | "vivid" | "edge" | "wash";

export type FunnelShape = "funnel" | "pyramid" | "bar";
export type MapProjection = "mercator" | "naturalEarth" | "equalEarth" | "orthographic";
export type MapScope = "world" | "europe" | "asia" | "africa" | "americas" | "turkeyRegion" | "turkeyProvinces";
export type MapMode = "choropleth" | "bubble";
export type GlyphKind = "circle" | "square" | "diamond" | "triangle" | "star" | "cross" | "wye";

/** Kategori eksenindeki etiket açısı; "auto" sığmayınca kendisi eğer. */
export type TickAngle = "auto" | 0 | 45 | 90;
/** Değer etiketi yerleşimi. "auto" = türün kendi geleneği. */
export type ValueLabels = "auto" | "none" | "inside" | "outside";
export type ColorBy = "series" | "category";
export type SortOrder = "none" | "asc" | "desc";

/**
 * Değer eksenine çizilen yatay (yatay çubukta dikey) çizgi — hedef, eşik,
 * ortalama. Dekor okundan farkı: kart uzayında değil **veri uzayında** durur,
 * veri değişince yerini korur.
 */
export interface RefLine {
  id: string;
  value: number;
  label: string;
  /** Boş = temanın ikinci mürekkep rengi. */
  color: string;
  dash: boolean;
}

/**
 * Tablonun biçimi. Aynı biçimdeki türler arasında geçerken kullanıcının verisi
 * korunur; biçim değişince örnek veri yüklenir.
 */
export type DataShape = "cartesian" | "categoryValue" | "hierarchy" | "xy" | "flow" | "calendar" | "region";

/** Raw table as typed by the user — strings, parsed at render time. */
export interface TableData {
  columns: string[];
  rows: string[][];
}

export interface ChartOptions {
  legend: boolean;
  legendValues: boolean;
  legendPosition: LegendPosition;
  grid: boolean;
  gridVertical: boolean;
  xAxis: boolean;
  yAxis: boolean;
  yTicks: number;
  yMin: number | null;
  yMax: number | null;
  stacked: boolean;
  barWidth: number | null;
  barGap: number;
  curve: CurveKind;
  showMarkers: boolean;
  strokeWidth: number;
  areaOpacity: number;
  xMode: XMode;
  dateGranularity: DateGranularity;
  ringStroke: number;
  ringGap: number;
  ringCenter: boolean;
  ringCenterLabel: string;
  ringShare: boolean;
  heatmapWeekStart: 0 | 1;
  heatmapLegend: boolean;
  sankeyNodeWidth: number;
  sankeyNodePadding: number;
  sankeyUnit: string;
  sankeyValueLabels: boolean;

  /* --- hiyerarşi: treemap / sunburst / pack --- */
  hierarchyLabels: boolean;
  hierarchyValues: boolean;
  hierarchyPad: number;
  /** Sunburst iç boşluk yarıçapı, dış yarıçapın yüzdesi. */
  sunburstInner: number;
  /** Renk grubu: 0 = kök altındaki dal, 1 = yaprağın kendisi. */
  hierarchyColorDepth: 0 | 1;

  /* --- dağılım: scatter / bubble --- */
  pointSize: number;
  pointOpacity: number;
  pointLabels: boolean;
  pointGlyph: GlyphKind;
  bubbleMax: number;
  trendLine: boolean;
  quadrants: boolean;

  /* --- ilişki: chord / network / arc --- */
  nodeLabels: boolean;
  chordPad: number;
  chordThickness: number;
  linkOpacity: number;
  networkCharge: number;
  networkNodeSize: number;
  arcHeight: number;

  /* --- radar --- */
  radarFill: number;
  radarLevels: number;
  radarDots: boolean;
  radarStraight: boolean;

  /* --- slope --- */
  slopeLabels: boolean;
  slopeValues: boolean;
  slopeDots: number;

  /* --- gauge --- */
  gaugeMin: number;
  gaugeMax: number;
  gaugeSweep: number;
  gaugeThickness: number;
  gaugeTicks: number;
  gaugeNeedle: boolean;

  /* --- waterfall --- */
  waterfallConnectors: boolean;
  waterfallTotal: boolean;
  waterfallTotalLabel: string;

  /* --- funnel --- */
  funnelShape: FunnelShape;
  funnelGap: number;
  funnelDropLabels: boolean;

  /* --- marimekko --- */
  mekkoLabels: boolean;
  mekkoGap: number;

  /* --- pictogram --- */
  pictoUnit: number;
  pictoIcon: string;
  pictoPerRow: number;
  pictoGap: number;

  /* --- harita --- */
  mapProjection: MapProjection;
  mapScope: MapScope;
  mapMode: MapMode;
  mapLabels: boolean;
  mapGraticule: boolean;
  mapBubbleMax: number;

  /* --- çubuklar ve vurgu (bar / barH / şelale / marimekko / ağaç haritası) --- */
  /** Köşe yarıçapı (px). 0 = keskin. */
  barRadius: number;
  /** Tek serili bir grafikte rengi seriye mi kategoriye mi bağla. */
  colorBy: ColorBy;
  /** Vurgulanan kategori adları; gerisi soluklaşır. Boş = hepsi tam. */
  highlight: string[];
  /** Kategorileri değere göre sırala (tek seri, halka, huni, piktogram). */
  sort: SortOrder;

  /* --- eksenler --- */
  xTitle: string;
  yTitle: string;
  xTickAngle: TickAngle;

  /* --- değer etiketleri --- */
  valueLabels: ValueLabels;
  /** Çizgi/alanda her noktaya mı yalnız sona mı. */
  valueLabelPoints: "all" | "last";
  valueLabelSize: number;

  /* --- açıklama katmanı --- */
  refLines: RefLine[];
  /** Bu satırdan sonrası kesikli çizilir (1 tabanlı; null = kapalı). */
  forecastFrom: number | null;
  /** Alan dolgusu tabana doğru saydamlaşsın mı. */
  areaGradient: boolean;

  decorPattern: DecorPattern;
  decorPatternOpacity: number;
  decorBloom: DecorBloom;
  decorBloomSeries: number;
  decorGradient: DecorGradient;
  decorAccentBar: boolean;

  format: NumberFormatSpec;
  animate: boolean;
  /** Tooltips and hover highlighting on the live card. Exports never hover. */
  hover: boolean;
  width: number;
  height: number;
  padding: number;
  titleSize: number;
  chartInset: number;
  /**
   * Kartın zemini. Boş = temanın kart rengi. Somut bir değer yazılır (hex),
   * CSS değişkeni değil: aynı DOM dışa aktarılıyor ve dışa aktarım hesaplanmış
   * stili gömerken özel özellikleri düşürüyor.
   */
  cardBackground: string;
}

export interface ChartSpec {
  id: string;
  name: string;
  kind: ChartKind;
  title: string;
  subtitle: string;
  note: string;
  data: TableData;
  paletteId: string;
  colors: string[];
  options: ChartOptions;
  /** Textures, lights, frames and placed objects — see src/decor. */
  decor: DecorState;
  /** Hand-placed boxes for the card's own title, chart and note. */
  yerlesim: CardLayout;
}

export type ExportBackground = "theme" | "transparent";

export interface Workspace {
  version: 1;
  theme: Theme;
  activeId: string;
  charts: ChartSpec[];
  /** User-defined palettes, offered alongside the built-in four. */
  palettes: Palette[];
  export: {
    scale: 1 | 2 | 3 | 4;
    background: ExportBackground;
    /**
     * PPTX'e gömülen resmin ölçeği. PNG'den ayrı: bir slayt 13 inç genişliğinde
     * yansıtılıyor, yani 2× bile yaklaşık 144 DPI — projeksiyonda yumuşak
     * görünüyor. Varsayılan 3.
     */
    pptxScale: 2 | 3 | 4;
    /** Slayt ölçüsü. */
    pptxSlayt: PptxSlideSize;
  };
}

export const KIND_LABELS: Record<ChartKind, string> = {
  bar: "Sütun",
  barH: "Yatay çubuk",
  line: "Çizgi",
  area: "Alan",
  slope: "Eğim",
  radar: "Radar",
  marimekko: "Marimekko",
  ring: "Halka",
  gauge: "Gösterge",
  funnel: "Huni",
  waterfall: "Şelale",
  pictogram: "Piktogram",
  treemap: "Ağaç haritası",
  sunburst: "Güneş patlaması",
  pack: "Daire yığını",
  scatter: "Dağılım",
  bubble: "Balon",
  sankey: "Akış (Sankey)",
  chord: "Akor",
  network: "Ağ",
  arc: "Yay",
  heatmap: "Isı takvimi",
  map: "Harita",
};

/** Sol paneldeki tür seçicinin grupları. */
export const KIND_GROUPS: { title: string; kinds: ChartKind[] }[] = [
  { title: "Karşılaştırma", kinds: ["bar", "barH", "marimekko", "waterfall", "funnel"] },
  { title: "Zaman ve eğilim", kinds: ["line", "area", "slope", "heatmap"] },
  { title: "Pay ve bileşim", kinds: ["ring", "gauge", "treemap", "sunburst", "pack", "pictogram"] },
  { title: "İlişki ve dağılım", kinds: ["scatter", "bubble", "radar", "sankey", "chord", "network", "arc"] },
  { title: "Coğrafya", kinds: ["map"] },
];

const SHAPES: Record<ChartKind, DataShape> = {
  line: "cartesian",
  area: "cartesian",
  bar: "cartesian",
  barH: "cartesian",
  slope: "cartesian",
  radar: "cartesian",
  marimekko: "cartesian",
  ring: "categoryValue",
  gauge: "categoryValue",
  funnel: "categoryValue",
  waterfall: "categoryValue",
  pictogram: "categoryValue",
  treemap: "hierarchy",
  sunburst: "hierarchy",
  pack: "hierarchy",
  scatter: "xy",
  bubble: "xy",
  sankey: "flow",
  chord: "flow",
  network: "flow",
  arc: "flow",
  heatmap: "calendar",
  map: "region",
};

export function dataShape(kind: ChartKind): DataShape {
  return SHAPES[kind];
}

export const DEFAULT_OPTIONS: ChartOptions = {
  legend: true,
  legendValues: false,
  legendPosition: "bottom",
  grid: true,
  gridVertical: false,
  xAxis: true,
  yAxis: true,
  yTicks: 5,
  yMin: null,
  yMax: null,
  stacked: false,
  barWidth: null,
  barGap: 0.35,
  curve: "monotone",
  showMarkers: false,
  strokeWidth: 2,
  areaOpacity: 0.25,
  xMode: "auto",
  dateGranularity: "auto",
  ringStroke: 16,
  ringGap: 6,
  ringCenter: true,
  ringCenterLabel: "Toplam",
  ringShare: true,
  heatmapWeekStart: 1,
  heatmapLegend: true,
  sankeyNodeWidth: 16,
  sankeyNodePadding: 24,
  sankeyUnit: "",
  sankeyValueLabels: true,

  hierarchyLabels: true,
  hierarchyValues: true,
  hierarchyPad: 3,
  sunburstInner: 32,
  hierarchyColorDepth: 0,

  pointSize: 7,
  pointOpacity: 0.85,
  pointLabels: false,
  pointGlyph: "circle",
  bubbleMax: 46,
  trendLine: false,
  quadrants: false,

  nodeLabels: true,
  chordPad: 0.04,
  chordThickness: 14,
  linkOpacity: 0.5,
  networkCharge: -260,
  networkNodeSize: 9,
  arcHeight: 0.62,

  radarFill: 0.18,
  radarLevels: 4,
  radarDots: true,
  radarStraight: true,

  slopeLabels: true,
  slopeValues: true,
  slopeDots: 5,

  gaugeMin: 0,
  gaugeMax: 100,
  gaugeSweep: 250,
  gaugeThickness: 26,
  gaugeTicks: 5,
  gaugeNeedle: false,

  waterfallConnectors: true,
  waterfallTotal: true,
  waterfallTotalLabel: "Toplam",

  funnelShape: "funnel",
  funnelGap: 6,
  funnelDropLabels: true,

  mekkoLabels: true,
  mekkoGap: 3,

  pictoUnit: 10,
  pictoIcon: "person",
  pictoPerRow: 10,
  pictoGap: 4,

  mapProjection: "naturalEarth",
  mapScope: "world",
  mapMode: "choropleth",
  mapLabels: false,
  mapGraticule: false,
  mapBubbleMax: 34,

  barRadius: 8,
  colorBy: "series",
  highlight: [],
  sort: "none",

  xTitle: "",
  yTitle: "",
  xTickAngle: "auto",

  valueLabels: "auto",
  valueLabelPoints: "all",
  valueLabelSize: 11,

  refLines: [],
  forecastFrom: null,
  areaGradient: true,

  decorPattern: "none",
  decorPatternOpacity: 0.5,
  decorBloom: "none",
  decorBloomSeries: 0,
  decorGradient: "none",
  decorAccentBar: false,

  format: DEFAULT_FORMAT,
  animate: true,
  hover: true,
  width: 960,
  height: 540,
  padding: 32,
  titleSize: 22,
  chartInset: 8,
  cardBackground: "",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/* ------------------------------------------------------------------ */
/* Sample data per chart kind                                           */
/* ------------------------------------------------------------------ */

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function sampleData(kind: ChartKind): TableData {
  switch (kind) {
    case "line":
    case "area":
      return {
        columns: ["Ay", "Gelir", "Gider"],
        rows: MONTHS.map((m, i) => [
          `${m} 2025`,
          String(Math.round(120 + i * 9 + Math.sin(i / 1.7) * 18)),
          String(Math.round(90 + i * 5 + Math.cos(i / 2.1) * 12)),
        ]),
      };
    case "bar":
      return {
        columns: ["Çeyrek", "Ürün A", "Ürün B", "Ürün C"],
        rows: [
          ["Ç1 2025", "420", "310", "180"],
          ["Ç2 2025", "465", "340", "210"],
          ["Ç3 2025", "510", "295", "260"],
          ["Ç4 2025", "580", "360", "300"],
        ],
      };
    case "barH":
      return {
        columns: ["Birim", "Tamamlanan", "Devam eden"],
        rows: [
          ["Satış", "82", "18"],
          ["Pazarlama", "64", "30"],
          ["Operasyon", "71", "12"],
          ["Finans", "90", "6"],
          ["İK", "55", "25"],
        ],
      };
    case "slope":
      return {
        columns: ["Birim", "2023", "2025"],
        rows: [
          ["Satış", "62", "88"],
          ["Pazarlama", "48", "41"],
          ["Operasyon", "70", "76"],
          ["Finans", "35", "58"],
          ["İK", "44", "39"],
        ],
      };
    case "radar":
      return {
        columns: ["Yetkinlik", "Ekip A", "Ekip B"],
        rows: [
          ["Hız", "78", "62"],
          ["Kalite", "85", "74"],
          ["Maliyet", "56", "80"],
          ["Kapsam", "70", "58"],
          ["Memnuniyet", "88", "66"],
          ["Yenilik", "62", "84"],
        ],
      };
    case "marimekko":
      return {
        columns: ["Bölge", "Kurumsal", "KOBİ", "Bireysel"],
        rows: [
          ["Marmara", "420", "260", "180"],
          ["İç Anadolu", "230", "190", "140"],
          ["Ege", "180", "150", "120"],
          ["Akdeniz", "120", "110", "95"],
        ],
      };
    case "gauge":
      return { columns: ["Etiket", "Değer", "Hedef"], rows: [["Hedef gerçekleşme", "72", "100"]] };
    case "ring":
      return {
        columns: ["Etiket", "Değer", "Hedef"],
        rows: [
          ["Türkiye", "540", ""],
          ["Avrupa", "320", ""],
          ["Orta Doğu", "180", ""],
          ["Diğer", "95", ""],
        ],
      };
    case "funnel":
      return {
        columns: ["Aşama", "Değer"],
        rows: [
          ["Ziyaret", "12400"],
          ["Kayıt", "5200"],
          ["Deneme", "2100"],
          ["Teklif", "820"],
          ["Satış", "310"],
        ],
      };
    case "waterfall":
      return {
        columns: ["Kalem", "Değer"],
        rows: [
          ["Açılış", "1200"],
          ["Yeni müşteri", "480"],
          ["Büyüme", "260"],
          ["Fiyat etkisi", "-140"],
          ["Kayıp", "-310"],
        ],
      };
    case "pictogram":
      return {
        columns: ["Etiket", "Değer"],
        rows: [
          ["Uzaktan", "420"],
          ["Hibrit", "310"],
          ["Ofiste", "180"],
        ],
      };
    case "treemap":
    case "sunburst":
    case "pack":
      return {
        columns: ["Ana grup", "Alt grup", "Değer"],
        rows: [
          ["Yazılım", "Lisans", "420"],
          ["Yazılım", "Bakım", "180"],
          ["Yazılım", "Danışmanlık", "140"],
          ["Donanım", "Sunucu", "260"],
          ["Donanım", "Ağ", "120"],
          ["Donanım", "İstemci", "95"],
          ["Hizmet", "Eğitim", "150"],
          ["Hizmet", "Destek", "210"],
        ],
      };
    case "scatter":
    case "bubble":
      return {
        columns: ["Etiket", "X", "Y", "Boyut", "Grup"],
        rows: [
          ["Marmara", "82", "74", "420", "Batı"],
          ["Ege", "68", "66", "260", "Batı"],
          ["Akdeniz", "61", "58", "210", "Batı"],
          ["İç Anadolu", "55", "62", "300", "Orta"],
          ["Karadeniz", "47", "51", "160", "Orta"],
          ["Doğu Anadolu", "34", "38", "90", "Doğu"],
          ["Güneydoğu", "39", "44", "130", "Doğu"],
        ],
      };
    case "heatmap": {
      const rows: string[][] = [];
      const start = new Date(2025, 0, 1);
      for (let i = 0; i < 365; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dow = d.getDay();
        const base = dow === 0 || dow === 6 ? 0.15 : 1;
        const v = Math.random() < 0.18 ? 0 : Math.round(base * (2 + Math.random() * 10));
        rows.push([iso(d), String(v)]);
      }
      return { columns: ["Tarih", "Değer"], rows };
    }
    case "sankey":
      return {
        columns: ["Kaynak", "Hedef", "Değer"],
        rows: [
          ["Web", "Kayıt", "420"],
          ["Mobil", "Kayıt", "310"],
          ["Referans", "Kayıt", "120"],
          ["Kayıt", "Deneme", "560"],
          ["Kayıt", "Ayrıldı", "290"],
          ["Deneme", "Ücretli", "240"],
          ["Deneme", "Ayrıldı", "320"],
        ],
      };
    case "chord":
    case "network":
    case "arc":
      return {
        columns: ["Kaynak", "Hedef", "Değer"],
        rows: [
          ["Satış", "Pazarlama", "38"],
          ["Satış", "Operasyon", "24"],
          ["Satış", "Finans", "16"],
          ["Pazarlama", "Ürün", "31"],
          ["Pazarlama", "Operasyon", "12"],
          ["Operasyon", "Finans", "27"],
          ["Operasyon", "Ürün", "19"],
          ["Ürün", "Finans", "9"],
          ["Finans", "İK", "14"],
          ["İK", "Satış", "11"],
        ],
      };
    case "map":
      return {
        columns: ["Ülke", "Değer"],
        rows: [
          ["Türkiye", "540"],
          ["Almanya", "410"],
          ["Fransa", "260"],
          ["İtalya", "230"],
          ["İspanya", "180"],
          ["Polonya", "140"],
          ["Hollanda", "120"],
          ["Romanya", "95"],
          ["Yunanistan", "70"],
          ["Bulgaristan", "55"],
        ],
      };
  }
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TITLES: Record<ChartKind, [string, string]> = {
  line: ["Aylık gelir ve gider", "2025, bin ₺"],
  area: ["Aylık gelir ve gider", "2025, bin ₺"],
  bar: ["Çeyreklik satış", "Ürün bazında, adet"],
  barH: ["Birim bazında görev durumu", "2025 Ç3 sonu"],
  slope: ["İki yıl arasındaki değişim", "2023 → 2025, puan"],
  radar: ["Ekip yetkinlik profili", "100 üzerinden"],
  marimekko: ["Bölge ve segment kırılımı", "Sütun genişliği = bölge büyüklüğü"],
  ring: ["Bölgesel dağılım", "Gelir payı, %"],
  gauge: ["Hedef gerçekleşme", "Yıl sonu hedefine göre"],
  funnel: ["Satış hunisi", "Aşama bazında adet"],
  waterfall: ["Gelir köprüsü", "Açılıştan kapanışa, bin ₺"],
  pictogram: ["Çalışma düzeni", "Her simge 10 kişi"],
  treemap: ["Harcama kırılımı", "Ana grup ve alt kalem"],
  sunburst: ["Harcama kırılımı", "İç halka ana grup"],
  pack: ["Harcama kırılımı", "Daire alanı = tutar"],
  scatter: ["Bölge karşılaştırması", "X ve Y ekseni puan"],
  bubble: ["Bölge karşılaştırması", "Balon boyutu = büyüklük"],
  sankey: ["Kullanıcı akışı", "Kanaldan dönüşüme"],
  chord: ["Birimler arası etkileşim", "Karşılıklı iş hacmi"],
  network: ["Birim ağı", "Bağlantı kalınlığı = hacim"],
  arc: ["Birim bağlantıları", "Yay kalınlığı = hacim"],
  heatmap: ["Günlük aktivite", "2025 takvimi"],
  map: ["Ülke bazında dağılım", "Avrupa ve Türkiye"],
};

/**
 * "Türkiye (iller)" kapsamının örnek tablosu. Ülke örneğiyle aynı işi görüyor:
 * kapsamı değiştiren kullanıcı boş bir haritayla kalmasın.
 */
export function provinceSample(): TableData {
  return {
    columns: ["İl", "Değer"],
    rows: [
      ["İstanbul", "540"],
      ["Ankara", "310"],
      ["İzmir", "265"],
      ["Bursa", "180"],
      ["Antalya", "165"],
      ["Konya", "120"],
      ["Adana", "115"],
      ["Gaziantep", "95"],
      ["Kayseri", "70"],
      ["Trabzon", "45"],
    ],
  };
}

/**
 * Kapsam değişince tabloyu uyarla.
 *
 * Yalnız **el değmemiş örnek tablo** değiştirilir: ülke örneğinden il
 * kapsamına geçen kullanıcı il örneğini görür, kendi verisini girmiş olan
 * kullanıcı verisini korur. Ölçüt tek: tablo, o kapsamın örneğiyle birebir
 * aynı mı.
 */
export function mapDataForScope(data: TableData, scope: MapScope): TableData {
  const il = scope === "turkeyProvinces";
  const ayni = (a: TableData, b: TableData) =>
    JSON.stringify(a.columns) === JSON.stringify(b.columns) && JSON.stringify(a.rows) === JSON.stringify(b.rows);
  if (il && ayni(data, sampleData("map"))) return provinceSample();
  if (!il && ayni(data, provinceSample())) return sampleData("map");
  return data;
}

export function newChart(kind: ChartKind, index = 1): ChartSpec {
  const [title, subtitle] = TITLES[kind];
  const radial = kind === "ring" || kind === "gauge";
  return {
    id: uid(),
    name: `${KIND_LABELS[kind]} ${index}`,
    kind,
    title,
    subtitle,
    note: "",
    data: sampleData(kind),
    paletteId: "varsayilan",
    colors: [],
    decor: emptyDecor(),
    yerlesim: emptyLayout(),
    options: {
      ...DEFAULT_OPTIONS,
      legendPosition: radial ? "right" : DEFAULT_OPTIONS.legendPosition,
      legendValues: radial,
      format: { ...DEFAULT_FORMAT },
      ...(kind === "map" ? { mapScope: "europe" as MapScope } : null),
    },
  };
}

export function defaultWorkspace(): Workspace {
  const first = newChart("bar", 1);
  return {
    version: 1,
    theme: "light",
    activeId: first.id,
    charts: [first],
    palettes: [],
    export: { scale: 2, background: "theme", pptxScale: 3, pptxSlayt: "16:9" },
  };
}

/** Column roles per kind — used by the grid header and the adapters. */
export function columnRoles(kind: ChartKind): { fixed: string[]; seriesLabel: string | null } {
  switch (kind) {
    case "ring":
    case "gauge":
      return { fixed: ["Etiket", "Değer", "Hedef (boş = toplam)"], seriesLabel: null };
    case "funnel":
    case "waterfall":
    case "pictogram":
      return { fixed: ["Etiket", "Değer"], seriesLabel: null };
    case "treemap":
    case "sunburst":
    case "pack":
      return { fixed: ["Ana grup", "Alt grup (boş olabilir)", "Değer"], seriesLabel: null };
    case "scatter":
    case "bubble":
      return { fixed: ["Etiket", "X", "Y", "Boyut", "Grup"], seriesLabel: null };
    case "heatmap":
      return { fixed: ["Tarih", "Değer"], seriesLabel: null };
    case "sankey":
    case "chord":
    case "network":
    case "arc":
      return { fixed: ["Kaynak", "Hedef", "Değer"], seriesLabel: null };
    case "map":
      return { fixed: ["Ülke / il / kod", "Değer"], seriesLabel: null };
    default:
      return { fixed: ["Kategori / Tarih"], seriesLabel: "Seri" };
  }
}

/**
 * Tür değişince tabloyu koru. Aynı veri biçimindeki türler arasında sütunlar
 * hedefin rollerine göre kırpılır ya da tamamlanır; biçim değişirse örnek
 * veri gelir.
 */
export function adaptDataForKind(data: TableData, from: ChartKind, to: ChartKind): TableData {
  if (from === to) return data;
  const target = dataShape(to);
  const source = dataShape(from);

  if (source === target) {
    const roles = columnRoles(to);
    // Kartezyende sütun sayısı serbest — tablo olduğu gibi geçer.
    if (roles.seriesLabel != null) return data;
    const n = roles.fixed.length;
    return {
      columns: roles.fixed.map((r, i) => data.columns[i] ?? r),
      rows: data.rows.map((r) => Array.from({ length: n }, (_, i) => r[i] ?? "")),
    };
  }

  // Kartezyen ↔ kategori+değer: ilk iki sütun taşınır.
  if (source === "cartesian" && target === "categoryValue") {
    const roles = columnRoles(to);
    return {
      columns: roles.fixed,
      rows: data.rows.map((r) => roles.fixed.map((_, i) => (i < 2 ? (r[i] ?? "") : ""))),
    };
  }
  if (source === "categoryValue" && target === "cartesian") {
    return { columns: ["Kategori", "Değer"], rows: data.rows.map((r) => [r[0] ?? "", r[1] ?? ""]) };
  }
  // Kategori+değer → hiyerarşi: tek düzey ağaç.
  if (source === "categoryValue" && target === "hierarchy") {
    return {
      columns: ["Ana grup", "Alt grup (boş olabilir)", "Değer"],
      rows: data.rows.map((r) => [r[0] ?? "", "", r[1] ?? ""]),
    };
  }
  // Hiyerarşi → kategori+değer: yaprak adı + değer.
  if (source === "hierarchy" && target === "categoryValue") {
    const roles = columnRoles(to);
    return {
      columns: roles.fixed,
      rows: data.rows.map((r) =>
        roles.fixed.map((_, i) => (i === 0 ? r[1] || r[0] || "" : i === 1 ? (r[2] ?? "") : ""))
      ),
    };
  }

  return sampleData(to);
}
