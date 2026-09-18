import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

// Ham metin olarak gömülür: tek dosyada tek string sabiti olur (nesne
// literaline göre hem küçük hem de tsc'nin 108 KB'lık JSON'u tip olarak
// çözmesine gerek kalmaz). Ayrıştırma ilk kullanımda bir kez yapılır.
import topologyText from "world-atlas/countries-110m.json?raw";
// Türkiye'nin illeri aynı yolla: `scripts/gen-tr-il.mjs` üretiyor, kimlik
// plaka kodu, ad Türkçe yazımıyla. (≈62 KB)
import provinceText from "./tr-il.json?raw";
import { NUMERIC_TO_ALPHA2 } from "./country-codes";
import type { MapScope } from "./spec";

export interface CountryProps {
  /** Natural Earth'ün İngilizce adı; il haritasında Türkçe il adı. */
  name: string;
}

export type CountryFeature = Feature<Geometry, CountryProps> & { id?: string | number };

/**
 * world-atlas 110m ülke sınırları. TopoJSON tek dosyaya gömülüdür (≈108 KB);
 * dönüşüm ilk kullanımda bir kez yapılır.
 */
let cached: CountryFeature[] | null = null;

export function countryFeatures(): CountryFeature[] {
  if (!cached) {
    const topo = JSON.parse(topologyText) as Topology;
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, CountryProps>;
    cached = fc.features as CountryFeature[];
  }
  return cached;
}

/**
 * Türkiye'nin 81 ili. Sınırlar tek dosyaya gömülüdür; dönüşüm ilk kullanımda
 * bir kez yapılır.
 */
let cachedIl: CountryFeature[] | null = null;

export function provinceFeatures(): CountryFeature[] {
  if (!cachedIl) {
    const topo = JSON.parse(provinceText) as Topology;
    const fc = feature(topo, topo.objects.iller) as unknown as FeatureCollection<Geometry, CountryProps>;
    cachedIl = fc.features as CountryFeature[];
  }
  return cachedIl;
}

/* ------------------------------------------------------------------ */
/* Ad / kod çözümleme                                                   */
/* ------------------------------------------------------------------ */

/**
 * Türkçe harfleri sadeleştirip noktalama ve boşluğu atar. "Çekya", "cekya",
 * "ÇEKYA" ve "Çek­ya" aynı anahtara düşer.
 */
function normalize(s: string): string {
  return s
    .replace(/[İIı]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Yaygın kısaltmalar ve gündelik adlar — Intl'in vermediği yazımlar. */
const ALIASES: Record<string, string> = {
  turkiye: "TR",
  turkey: "TR",
  tur: "TR",
  abd: "US",
  usa: "US",
  amerika: "US",
  birlesikdevletler: "US",
  ingiltere: "GB",
  uk: "GB",
  britanya: "GB",
  buyukbritanya: "GB",
  hollanda: "NL",
  felemenk: "NL",
  almanya: "DE",
  cekcumhuriyeti: "CZ",
  cekya: "CZ",
  guneykore: "KR",
  kuzeykore: "KP",
  rusya: "RU",
  rusyafederasyonu: "RU",
  iran: "IR",
  suriye: "SY",
  bae: "AE",
  kktc: "CY",
  vatikan: "VA",
  bosnahersek: "BA",
  makedonya: "MK",
  kuzeymakedonya: "MK",
  fildisisahili: "CI",
  yenizelanda: "NZ",
  gunefrika: "ZA",
  guneyafrika: "ZA",
};

let resolver: Map<string, string> | null = null;

/**
 * Kullanıcının yazdığı ülke adı ya da kodu → world-atlas numeric id.
 * Kabul edilenler: ISO numeric ("792"), alpha-2 ("TR"), Türkçe ad ("Türkiye"),
 * İngilizce ad ("Turkey") ve Natural Earth adı. Türkçe/İngilizce adlar
 * tarayıcının kendi `Intl.DisplayNames`'inden gelir — tabloya gömülü değildir,
 * bu yüzden çevrimdışı çalışır ve dosyayı büyütmez.
 */
function buildResolver(): Map<string, string> {
  const map = new Map<string, string>();
  const put = (key: string, id: string) => {
    const k = normalize(key);
    if (k && !map.has(k)) map.set(k, id);
  };

  let trNames: Intl.DisplayNames | null = null;
  let enNames: Intl.DisplayNames | null = null;
  try {
    trNames = new Intl.DisplayNames(["tr"], { type: "region" });
    enNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    /* Intl.DisplayNames yoksa ad eşlemesi Natural Earth adlarıyla sınırlı kalır. */
  }

  const alpha2ToId = new Map<string, string>();
  for (const [id, alpha2] of NUMERIC_TO_ALPHA2) {
    put(id, id);
    if (!alpha2) continue;
    alpha2ToId.set(alpha2, id);
    put(alpha2, id);
    for (const names of [trNames, enNames]) {
      if (!names) continue;
      try {
        const n = names.of(alpha2);
        if (n && n !== alpha2) put(n, id);
      } catch {
        /* geçersiz kod */
      }
    }
  }

  // Natural Earth'ün kendi (kısaltılmış) adları da kabul edilsin.
  for (const f of countryFeatures()) {
    if (f.id == null) continue;
    put(f.properties.name, String(f.id));
  }

  for (const [alias, alpha2] of Object.entries(ALIASES)) {
    const id = alpha2ToId.get(alpha2);
    if (id) put(alias, id);
  }

  return map;
}

export function resolveCountry(key: string): string | null {
  if (!resolver) resolver = buildResolver();
  return resolver.get(normalize(key)) ?? null;
}

/**
 * İl adlarının gündelik yazımları. Resmî ad tablodan geliyor; burada yalnız
 * kısaltmalar ve eski adlar var.
 */
const IL_ALIASES: Record<string, string> = {
  afyon: "03",
  maras: "46",
  kmaras: "46",
  urfa: "63",
  antep: "27",
  icel: "33",
};

let ilResolver: Map<string, string> | null = null;

function buildIlResolver(): Map<string, string> {
  const map = new Map<string, string>();
  const put = (key: string, id: string) => {
    const k = normalize(key);
    if (k && !map.has(k)) map.set(k, id);
  };
  for (const f of provinceFeatures()) {
    if (f.id == null) continue;
    const id = String(f.id);
    put(id, id);
    // Baştaki sıfırsız plaka: kullanıcı "6" yazdığında Ankara.
    put(String(Number(id)), id);
    put(`tr${id}`, id);
    put(f.properties.name, id);
  }
  for (const [alias, id] of Object.entries(IL_ALIASES)) put(alias, id);
  return map;
}

/**
 * Kullanıcının yazdığı il adı ya da plaka kodu → geometri kimliği.
 * Kabul edilenler: "İstanbul", "istanbul", "34", "TR-34", "Afyon".
 */
export function resolveProvince(key: string): string | null {
  if (!ilResolver) ilResolver = buildIlResolver();
  return ilResolver.get(normalize(key)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Görünüm pencereleri                                                  */
/* ------------------------------------------------------------------ */

/**
 * Kapsam bir coğrafi pencere olarak tanımlanır; harita bu pencereye sığdırılır
 * ve dışarıda kalan ülkeler kırpılır. Böylece hiçbir ülke "kayıp" olmaz,
 * yalnızca kadraj değişir.
 */
const SCOPE_BOUNDS: Record<MapScope, [[number, number], [number, number]]> = {
  world: [
    [-180, -60],
    [180, 84],
  ],
  // 16:9 karta göre ayarlı: enlem aralığı dar tutulur, çünkü sığdırma
  // neredeyse hep yükseklikle sınırlanıyor ve geniş enlem kadrajı küçültüyor.
  europe: [
    [-14, 34],
    [46, 68],
  ],
  asia: [
    [25, -12],
    [150, 60],
  ],
  africa: [
    [-20, -36],
    [54, 38],
  ],
  americas: [
    [-170, -56],
    [-32, 72],
  ],
  turkeyRegion: [
    [18, 30],
    [56, 49],
  ],
  // Yalnız Türkiye: sınırın birkaç derece dışı pay bırakılıyor, yoksa Hatay ve
  // Edirne kartın kenarına yapışıyor.
  turkeyProvinces: [
    [25.2, 35.4],
    [45.2, 42.6],
  ],
};

export const SCOPE_LABELS: Record<MapScope, string> = {
  world: "Dünya",
  europe: "Avrupa",
  asia: "Asya",
  africa: "Afrika",
  americas: "Amerika",
  turkeyRegion: "Türkiye ve çevresi",
  turkeyProvinces: "Türkiye (iller)",
};

/**
 * Bir kapsamın hangi sınırlardan çizileceği. Harita iki kaynaktan besleniyor —
 * dünya ülkeleri ve Türkiye'nin illeri — ve tek fark hangi tabloya bakıldığı.
 */
export function regionSource(scope: MapScope): {
  features: CountryFeature[];
  resolve: (key: string) => string | null;
  /** Tablo boşken gösterilen yönerge. */
  ipucu: string;
  /** Eşleşmeyen satırlar için açıklama. */
  tanimsiz: string;
} {
  if (scope === "turkeyProvinces") {
    return {
      features: provinceFeatures(),
      resolve: resolveProvince,
      ipucu: "İl ve değer girin (örn. İstanbul ; 540).",
      tanimsiz: "İl adı ya da plaka kodu (İstanbul / 34) yazabilirsiniz.",
    };
  }
  return {
    features: countryFeatures(),
    resolve: resolveCountry,
    ipucu: "Ülke ve değer girin (örn. Türkiye ; 540).",
    tanimsiz: "Türkçe ad, İngilizce ad ya da ISO kodu (TR / 792) yazabilirsiniz.",
  };
}

/**
 * Kapsam penceresini `fitExtent` için GeoJSON dikdörtgenine çevirir.
 *
 * Halka **saat yönünde** sarılır. d3-geo çokgeni küre üstünde yorumlar ve ters
 * sarımı "kürenin bu kutu dışında kalan kısmı" diye okur; o zaman sınırlayıcı
 * kutu tüm dünya olur ve yakınlaştırma hiç uygulanmaz.
 */
export function scopeExtent(scope: MapScope): Feature<Geometry, Record<string, never>> {
  const [[x0, y0], [x1, y1]] = SCOPE_BOUNDS[scope];
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x0, y0],
          [x0, y1],
          [x1, y1],
          [x1, y0],
          [x0, y0],
        ],
      ],
    },
  };
}
