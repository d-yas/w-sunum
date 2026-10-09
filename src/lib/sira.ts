/**
 * Grafikte öğelerin sırası — tek yer.
 *
 * Kullanıcı bir grafiğin öğelerini (kategori, aşama, grup, düğüm) ve serilerini
 * üç yoldan dizer: sahnede sürükleyerek, sağ paneldeki "Sıra" listesinde
 * sürükleyerek ya da klavyeyle. Üçü de buradaki fonksiyonlarla `options.sort`
 * ve `options.sira`'ya yazar; çiziciler sıranın nereden geldiğini bilmez,
 * `gorunum()`'ün verdiği tabloyu sırasıyla çizer.
 *
 * **Tablo olduğu gibi kalır.** Sıra grafiğin ayarı: Excel'den yeniden
 * yapıştırılan veri aynı adlar için elle düzeni korur, tablo da kullanıcının
 * yazdığı sırada durur. Bu yüzden elle sıra bir ad listesi, satır numarası değil.
 *
 * **Renk öğeyle gider.** Renk dizisi *kimlik* sırasında kurulur — öğenin kendi
 * adaptör süzgecinden geçmiş tablodaki ilk görünüşü — ve görünüm onu öğelerle
 * aynı permütasyonla dizer. Eskiden renk konuma bağlıydı: taşınan çubuk
 * başka renge bürünüyordu.
 *
 * Kimlik **her türün kendi süzgeciyle** hesaplanır (boş etiket, ≤ 0 değer,
 * kendine akış…): ham tablo satırıyla sayılsa renk seçici yanlış öğeyi
 * boyardı. Süzgeçler `adapters.ts` ile birebir aynı tutulmalı.
 *
 * React'ten bağımsız: `scripts/sira-test.mjs` doğrudan Node'da sınıyor.
 */
import { parseDate, parseNumber } from "./parse";
import { dataShape, type ChartKind, type ChartSpec, type ElleSira, type SortOrder, type TableData } from "./spec";

/** Sıralanabilen boyutlar: ana öğeler, seriler (sütunlar), hiyerarşide grup içi yapraklar. */
export type SiraBoyutu = "oge" | "seri" | "alt";

/** Sahnede sürüklerken hedefin hangi ölçüyle bulunacağı. */
export type Geometri = "x" | "y" | "aci" | "yaricap" | "2b";

export interface SiraOgesi {
  /** Boyut içinde benzersiz: ad, aynı ad yinelenirse `ad#2`, `ad#3`… */
  anahtar: string;
  ad: string;
  /** Değere göre sıralamanın okuduğu sayı; listede de gösterilir. */
  deger: number | null;
  /** Renk kimliği: öğenin kendi süzgecinden geçmiş tablodaki ilk görünüş sırası. */
  kimlik: number;
  /** `alt` boyutunda yaprağın grubu. */
  grup?: string;
  /** Tablodaki satırı (satıra karşılık gelen öğelerde). */
  satir?: number;
}

export interface SiraBoyutBilgisi {
  boyut: SiraBoyutu;
  baslik: string;
  /** Görünen sırada. */
  ogeler: SiraOgesi[];
  /** Bu boyutta seçilebilen modlar; boşsa yalnız elle sıra (seriler, yapraklar). */
  modlar: SortOrder[];
  /** Sahnede sürükleme; `null` = yalnız liste, klavye ve menü. */
  geometri: Geometri | null;
  /** Panelde listenin üstünde görünen kısa açıklama. */
  not?: string;
  /** Sıra bu türde verinin kendisinden geliyor (ör. zaman ekseni) — liste salt okunur. */
  kapali?: boolean;
}

export const SIRA_MODLARI: SortOrder[] = ["none", "desc", "asc", "alpha", "manual"];

export const MOD_ADLARI: Record<SortOrder, string> = {
  none: "Otomatik",
  desc: "Büyükten küçüğe",
  asc: "Küçükten büyüğe",
  alpha: "A→Z",
  manual: "Elle",
};

export const BOS_SIRA: ElleSira = { oge: [], seri: [], alt: {} };

/** Konum değil zaman: bu türlerde tarih ekseni sırayı kendisi belirler. */
const ZAMAN: ChartKind[] = ["line", "area"];
/** Kategori ekseni bant olan kartezyen türler: tarih gibi görünen etiket yalnız varsayılan sıradır. */
const BANT: ChartKind[] = ["bar", "barH", "radar", "marimekko", "slope"];

const temiz = (s: string | undefined) => (s ?? "").trim();

const harfSirasi = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });

/** Aynı ad ikinci kez geçerse `ad#2`, üçüncü kez `ad#3`… Görünen ad değişmez. */
export function anahtarla(adlar: readonly string[]): string[] {
  const sayac = new Map<string, number>();
  return adlar.map((a) => {
    const n = (sayac.get(a) ?? 0) + 1;
    sayac.set(a, n);
    return n === 1 ? a : `${a}#${n}`;
  });
}

/* ------------------------------------------------------------------ */
/* Öğeleri tablodan çıkarmak — her tür kendi süzgeciyle                 */
/* ------------------------------------------------------------------ */

interface Kartezyen {
  ogeler: SiraOgesi[];
  seriler: SiraOgesi[];
}

/** `toCartesian` ile aynı süzgeç: etiketi ya da en az bir değeri olan satır kalır. */
function kartezyen(spec: ChartSpec): Kartezyen {
  const { columns, rows } = spec.data;
  const loc = spec.options.format.locale;
  const satirlar: number[] = [];
  rows.forEach((r, i) => {
    if (temiz(r[0]) !== "" || r.slice(1).some((c) => temiz(c) !== "")) satirlar.push(i);
  });
  const adlar = satirlar.map((ri, k) => temiz(rows[ri][0]) || `#${k + 1}`);
  const anahtarlar = anahtarla(adlar);
  const tekSeri = columns.length === 2;
  const ogeler = satirlar.map((ri, k): SiraOgesi => {
    const r = rows[ri];
    let deger = 0;
    // Eğimde satır bir çizgi: "büyükten küçüğe" son durağın değeri demek.
    if (spec.kind === "slope") deger = parseNumber(r[columns.length - 1], loc) ?? 0;
    else if (tekSeri) deger = parseNumber(r[1], loc) ?? 0;
    else for (let j = 1; j < columns.length; j++) deger += parseNumber(r[j], loc) ?? 0;
    return { anahtar: anahtarlar[k], ad: adlar[k], deger, kimlik: k, satir: ri };
  });
  const seriAdlari = columns.slice(1).map((c, i) => temiz(c) || `Seri ${i + 1}`);
  const seriAnahtarlari = anahtarla(seriAdlari);
  const seriler = seriAdlari.map((ad, i): SiraOgesi => {
    let t = 0;
    for (const x of ogeler) t += parseNumber(rows[x.satir!][i + 1], loc) ?? 0;
    return { anahtar: seriAnahtarlari[i], ad, deger: t, kimlik: i };
  });
  return { ogeler, seriler };
}

/** `toCartesian`'ın `xIsDate` kararı — etiketlerin hepsi tarihse ve kip "Kategori" değilse. */
function tarihEkseni(spec: ChartSpec, adlar: readonly string[]): boolean {
  if (spec.options.xMode === "category") return false;
  return adlar.length > 0 && adlar.every((a) => parseDate(a) != null);
}

function tarihSirasi(ogeler: SiraOgesi[]): SiraOgesi[] {
  return [...ogeler].sort((a, b) => parseDate(a.ad)!.getTime() - parseDate(b.ad)!.getTime());
}

/** `toRing` / `toCategoryValue` süzgeci: etiketi ve sayısal değeri olan satır. */
function kategori(spec: ChartSpec): SiraOgesi[] {
  const loc = spec.options.format.locale;
  const ham: { ad: string; deger: number; satir: number }[] = [];
  spec.data.rows.forEach((r, i) => {
    const ad = temiz(r[0]);
    const deger = parseNumber(r[1], loc);
    if (ad !== "" && deger != null) ham.push({ ad, deger, satir: i });
  });
  const anahtarlar = anahtarla(ham.map((h) => h.ad));
  return ham.map((h, k) => ({ anahtar: anahtarlar[k], ad: h.ad, deger: h.deger, kimlik: k, satir: h.satir }));
}

interface Hiyerarsi {
  gruplar: SiraOgesi[];
  /** Grup anahtarı → yaprakları, tablo sırasında. */
  yapraklar: Map<string, SiraOgesi[]>;
}

/** `toHierarchy` süzgeci: ana grubu ve pozitif değeri olan satır. */
function hiyerarsi(spec: ChartSpec): Hiyerarsi {
  const loc = spec.options.format.locale;
  const gruplar: SiraOgesi[] = [];
  const ham = new Map<string, { ad: string; deger: number; satir: number }[]>();
  spec.data.rows.forEach((r, i) => {
    const grup = temiz(r[0]);
    const deger = parseNumber(r[2], loc);
    if (grup === "" || deger == null || deger <= 0) return;
    let liste = ham.get(grup);
    if (!liste) {
      liste = [];
      ham.set(grup, liste);
      gruplar.push({ anahtar: grup, ad: grup, deger: 0, kimlik: gruplar.length });
    }
    liste.push({ ad: temiz(r[1]) || grup, deger, satir: i });
  });
  const yapraklar = new Map<string, SiraOgesi[]>();
  for (const g of gruplar) {
    const liste = ham.get(g.anahtar)!;
    g.deger = liste.reduce((a, y) => a + y.deger, 0);
    const anahtarlar = anahtarla(liste.map((y) => y.ad));
    yapraklar.set(
      g.anahtar,
      liste.map((y, k) => ({ anahtar: anahtarlar[k], ad: y.ad, deger: y.deger, kimlik: k, grup: g.anahtar, satir: y.satir }))
    );
  }
  return { gruplar, yapraklar };
}

interface Dagilim {
  gruplar: SiraOgesi[];
  /** Satır başına grup anahtarı; geçersiz noktada `null`, grupsuz noktada `""`. */
  satirGrubu: (string | null)[];
}

/** `toXY` süzgeci: X ve Y'si sayı olan satır; grup beşinci sütun. */
function dagilim(spec: ChartSpec): Dagilim {
  const loc = spec.options.format.locale;
  const gruplar: SiraOgesi[] = [];
  const satirGrubu = spec.data.rows.map((r) => {
    if (parseNumber(r[1], loc) == null || parseNumber(r[2], loc) == null) return null;
    const g = temiz(r[4]);
    if (g) {
      const var_ = gruplar.find((x) => x.anahtar === g);
      if (var_) var_.deger = (var_.deger ?? 0) + 1;
      else gruplar.push({ anahtar: g, ad: g, deger: 1, kimlik: gruplar.length });
    }
    return g;
  });
  return { gruplar, satirGrubu };
}

/**
 * `toFlow` / `toSankey` süzgeci; düğümler kaynak-sonra-hedef ilk görünüş
 * sırasında. Değer, grafiğin düğümün yanına yazdığı sayı: sankey'de giren ya
 * da çıkanın büyüğü (d3-sankey'in düğüm değeri), akor/ağ/yayda toplam akış.
 */
function akis(spec: ChartSpec): SiraOgesi[] {
  const loc = spec.options.format.locale;
  const dugumler: SiraOgesi[] = [];
  const yer = new Map<string, { oge: SiraOgesi; giren: number; cikan: number }>();
  const ekle = (ad: string) => {
    let d = yer.get(ad);
    if (!d) {
      d = { oge: { anahtar: ad, ad, deger: 0, kimlik: dugumler.length }, giren: 0, cikan: 0 };
      dugumler.push(d.oge);
      yer.set(ad, d);
    }
    return d;
  };
  for (const r of spec.data.rows) {
    const s = temiz(r[0]);
    const t = temiz(r[1]);
    const v = parseNumber(r[2], loc);
    if (!s || !t || v == null || v <= 0 || s === t) continue;
    ekle(s).cikan += v;
    ekle(t).giren += v;
  }
  for (const d of yer.values()) d.oge.deger = spec.kind === "sankey" ? Math.max(d.giren, d.cikan) : d.giren + d.cikan;
  return dugumler;
}

/* ------------------------------------------------------------------ */
/* Sıralama                                                             */
/* ------------------------------------------------------------------ */

/** Listede olmayanlar kimlik sırasıyla sona; listede olup veride olmayanlar yok sayılır. */
function elleDiz(ogeler: SiraOgesi[], elle: readonly string[]): SiraOgesi[] {
  if (elle.length === 0) return ogeler;
  const yer = new Map(elle.map((k, i) => [k, i] as const));
  const listede = ogeler.filter((o) => yer.has(o.anahtar)).sort((a, b) => yer.get(a.anahtar)! - yer.get(b.anahtar)!);
  return [...listede, ...ogeler.filter((o) => !yer.has(o.anahtar))];
}

/** Kararlı sıralama: eşitler kimlik sırasını korur. */
function diz(ogeler: SiraOgesi[], mod: SortOrder, elle: readonly string[]): SiraOgesi[] {
  switch (mod) {
    case "asc":
      return [...ogeler].sort((a, b) => (a.deger ?? 0) - (b.deger ?? 0));
    case "desc":
      return [...ogeler].sort((a, b) => (b.deger ?? 0) - (a.deger ?? 0));
    case "alpha":
      return [...ogeler].sort((a, b) => harfSirasi(a.ad, b.ad));
    case "manual":
      return elleDiz(ogeler, elle);
    default:
      return ogeler;
  }
}

function kartezyenOgeSirasi(spec: ChartSpec, k: Kartezyen): SiraOgesi[] {
  const tarih = tarihEkseni(spec, k.ogeler.map((x) => x.ad));
  if (tarih && (spec.options.sort === "none" || ZAMAN.includes(spec.kind))) return tarihSirasi(k.ogeler);
  return diz(k.ogeler, spec.options.sort, spec.options.sira.oge);
}

/** Hiyerarşide "Otomatik" bugünkü görüntü: her düzeyde büyükten küçüğe. */
const hiyerarsiModu = (m: SortOrder): SortOrder => (m === "none" ? "desc" : m);

function hiyerarsiGrupSirasi(spec: ChartSpec, h: Hiyerarsi): SiraOgesi[] {
  return diz(h.gruplar, hiyerarsiModu(spec.options.sort), spec.options.sira.oge);
}

function hiyerarsiYaprakSirasi(spec: ChartSpec, h: Hiyerarsi, grup: string): SiraOgesi[] {
  return diz(h.yapraklar.get(grup) ?? [], hiyerarsiModu(spec.options.sort), spec.options.sira.alt[grup] ?? []);
}

/**
 * Şu an çizilen sıra.
 *
 * `olculen`: sankey "Otomatik"te düğümlerin sahnede ölçülen sırası. d3-sankey
 * kesişmeyi azaltırken düğümleri çizim kutusunun boyuna göre diziyor; aynı
 * sırayı kâğıt üstünde üretmek için kutunun ölçüsünü bilmek gerekirdi.
 */
export function gorunenSira(spec: ChartSpec, boyut: SiraBoyutu, olculen?: readonly string[]): SiraOgesi[] {
  const o = spec.options;
  switch (dataShape(spec.kind)) {
    case "cartesian": {
      const k = kartezyen(spec);
      if (boyut === "seri") return elleDiz(k.seriler, o.sira.seri);
      return boyut === "oge" ? kartezyenOgeSirasi(spec, k) : [];
    }
    case "categoryValue":
      return boyut === "oge" ? diz(kategori(spec), o.sort, o.sira.oge) : [];
    case "hierarchy": {
      const h = hiyerarsi(spec);
      const gruplar = hiyerarsiGrupSirasi(spec, h);
      if (boyut === "oge") return gruplar;
      return boyut === "alt" ? gruplar.flatMap((g) => hiyerarsiYaprakSirasi(spec, h, g.anahtar)) : [];
    }
    case "xy":
      return boyut === "oge" ? diz(dagilim(spec).gruplar, o.sort, o.sira.oge) : [];
    case "flow": {
      if (boyut !== "oge") return [];
      const d = akis(spec);
      if (spec.kind === "sankey" && o.sort === "none" && olculen && olculen.length > 0) return elleDiz(d, olculen);
      return diz(d, o.sort, o.sira.oge);
    }
    default:
      return [];
  }
}

/** Bir boyutun öğeleri kimlik (renk) sırasında. */
export function kimlikSirasi(spec: ChartSpec, boyut: SiraBoyutu | null): SiraOgesi[] {
  if (!boyut) return [];
  switch (dataShape(spec.kind)) {
    case "cartesian": {
      const k = kartezyen(spec);
      return boyut === "seri" ? k.seriler : boyut === "oge" ? k.ogeler : [];
    }
    case "categoryValue":
      return boyut === "oge" ? kategori(spec) : [];
    case "hierarchy": {
      const h = hiyerarsi(spec);
      if (boyut === "oge") return h.gruplar;
      return boyut === "alt" ? h.gruplar.flatMap((g) => h.yapraklar.get(g.anahtar) ?? []) : [];
    }
    case "xy":
      return boyut === "oge" ? dagilim(spec).gruplar : [];
    case "flow":
      return boyut === "oge" ? akis(spec) : [];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Renk ve gösterge                                                     */
/* ------------------------------------------------------------------ */

/** Rengi hangi boyut taşıyor — `null`: renk anlamsal (şelale) ya da tek (takvim, harita). */
export function renkBoyutu(spec: ChartSpec): SiraBoyutu | null {
  switch (dataShape(spec.kind)) {
    case "cartesian":
      if (spec.kind === "slope") return "oge";
      if ((spec.kind === "bar" || spec.kind === "barH") && spec.options.colorBy === "category" && spec.data.columns.length === 2) return "oge";
      return "seri";
    case "categoryValue":
      return spec.kind === "waterfall" ? null : "oge";
    case "hierarchy":
    case "flow":
      return "oge";
    case "xy":
      return dagilim(spec).gruplar.length > 0 ? "oge" : null;
    default:
      return null;
  }
}

/** Göstergenin listelediği boyut; göstergesiz türlerde `null`. */
export function gostergeBoyutu(spec: ChartSpec): SiraBoyutu | null {
  if (spec.kind === "pictogram" || spec.kind === "sankey") return null;
  return renkBoyutu(spec);
}

/** Renkler panelinin satır adları — `colors[i]`'nin hangi öğeye ait olduğu. */
export function renkAdlari(spec: ChartSpec): string[] {
  switch (dataShape(spec.kind)) {
    case "calendar":
      return ["Hücre rengi"];
    case "region":
      return ["Yoğunluk"];
    case "xy": {
      const g = dagilim(spec).gruplar;
      return g.length > 0 ? g.map((x) => x.ad) : ["Noktalar"];
    }
    default:
      if (spec.kind === "waterfall") return ["Artış", "Azalış", spec.options.waterfallTotalLabel || "Toplam"];
      return kimlikSirasi(spec, renkBoyutu(spec)).map((x) => x.ad);
  }
}

/** Kimlik sırasındaki renkleri görünen sıraya dizer; `perm[d]` = d. yerdeki öğenin kimliği. */
function renkleriDiz(colors: string[], perm: readonly number[]): string[] {
  if (colors.length === 0) return colors;
  const n = Math.max(colors.length, perm.length);
  return Array.from({ length: n }, (_, d) => colors[(d < perm.length ? perm[d] : d) % colors.length]);
}

/* ------------------------------------------------------------------ */
/* Görünüm — çizicilere giden tablo                                     */
/* ------------------------------------------------------------------ */

export interface Gorunum {
  spec: ChartSpec;
  colors: string[];
}

/**
 * Çizime giden spec ve renkler.
 *
 * Sıra değişmediğinde girdinin kendisi döner — eski kartlar birebir aynı
 * çizilir ve `useMemo` zinciri kırılmaz. Değiştiğinde satırlar (ve sütunlar)
 * görünen sıraya dizilir; çiziciler zaten girdiği sırayla çiziyor. Dayatılan
 * üç sıralama ayrıca ele alınır: bant türlerinde tarih sırası (`xMode`),
 * hiyerarşinin d3 karşılaştırıcısı (`hierarchy.tsx` modu okur) ve sankey'in
 * `nodeSort`u (`ChartCard` `sira.oge`'yi okur).
 */
export function gorunum(spec: ChartSpec, colors: string[]): Gorunum {
  switch (dataShape(spec.kind)) {
    case "cartesian":
      return kartezyenGorunum(spec, colors);
    case "categoryValue":
      return kategoriGorunum(spec, colors);
    case "hierarchy":
      return hiyerarsiGorunum(spec, colors);
    case "xy":
      return dagilimGorunum(spec, colors);
    case "flow":
      return akisGorunum(spec, colors);
    default:
      return { spec, colors };
  }
}

function kartezyenGorunum(spec: ChartSpec, colors: string[]): Gorunum {
  const o = spec.options;
  const k = kartezyen(spec);
  const seriler = elleDiz(k.seriler, o.sira.seri);
  const seriDegisti = seriler.some((s, i) => s.kimlik !== i);
  const zamanKilitli = ZAMAN.includes(spec.kind) && tarihEkseni(spec, k.ogeler.map((x) => x.ad));
  const ogeler = o.sort !== "none" && !zamanKilitli ? diz(k.ogeler, o.sort, o.sira.oge) : null;
  if (!seriDegisti && !ogeler) return { spec, colors };

  const { columns, rows } = spec.data;
  const sutunlar = [0, ...seriler.map((s) => s.kimlik + 1)];
  const satir = (r: string[], ad?: string) => sutunlar.map((c, j) => (j === 0 ? temiz(r[0]) || ad || "" : (r[c] ?? "")));
  const data: TableData = {
    columns: sutunlar.map((c) => columns[c] ?? ""),
    // Etiketsiz satır kimliğindeki `#n` adını taşır; adaptör yeni yerine göre başka numara verirdi.
    rows: ogeler ? ogeler.map((x) => satir(rows[x.satir!], x.ad)) : rows.map((r) => satir(r)),
  };
  // Bant türlerinde tarih gibi görünen etiket yalnız varsayılan sıra: elle sıra onu ezmeli.
  const options = ogeler && BANT.includes(spec.kind) ? { ...o, xMode: "category" as const } : o;
  const perm =
    renkBoyutu(spec) === "oge" ? (ogeler ? ogeler.map((x) => x.kimlik) : null) : seriDegisti ? seriler.map((s) => s.kimlik) : null;
  return { spec: { ...spec, data, options }, colors: perm ? renkleriDiz(colors, perm) : colors };
}

function kategoriGorunum(spec: ChartSpec, colors: string[]): Gorunum {
  const o = spec.options;
  if (o.sort === "none") return { spec, colors };
  const ogeler = diz(kategori(spec), o.sort, o.sira.oge);
  if (ogeler.every((x, i) => x.kimlik === i)) return { spec, colors };
  const rows = ogeler.map((x) => spec.data.rows[x.satir!]);
  return {
    spec: { ...spec, data: { ...spec.data, rows } },
    // Şelalede renk artış/azalış/toplam demek, öğe değil.
    colors: spec.kind === "waterfall" ? colors : renkleriDiz(colors, ogeler.map((x) => x.kimlik)),
  };
}

function hiyerarsiGorunum(spec: ChartSpec, colors: string[]): Gorunum {
  const o = spec.options;
  // Otomatik ve değer modlarını d3'ün karşılaştırıcısı yapıyor (`hierarchy.tsx`).
  if (o.sort !== "alpha" && o.sort !== "manual") return { spec, colors };
  const h = hiyerarsi(spec);
  const gruplar = hiyerarsiGrupSirasi(spec, h);
  const rows = gruplar.flatMap((g) => hiyerarsiYaprakSirasi(spec, h, g.anahtar).map((y) => spec.data.rows[y.satir!]));
  return {
    // "manual": çizici karşılaştırıcı kullanmasın, satır sırasını korusun.
    spec: { ...spec, data: { ...spec.data, rows }, options: { ...o, sort: "manual" } },
    colors: renkleriDiz(colors, gruplar.map((g) => g.kimlik)),
  };
}

function dagilimGorunum(spec: ChartSpec, colors: string[]): Gorunum {
  const o = spec.options;
  if (o.sort === "none") return { spec, colors };
  const d = dagilim(spec);
  if (d.gruplar.length === 0) return { spec, colors };
  const gruplar = diz(d.gruplar, o.sort, o.sira.oge);
  const yer = new Map(gruplar.map((g, i) => [g.anahtar, i] as const));
  // Grupsuz noktalar en altta; gruplar bloklar hâlinde, sonraki grup üstte.
  const sira = (g: string | null) => (g ? (yer.get(g) ?? -1) : -1);
  const idx = spec.data.rows.map((_, i) => i).filter((i) => d.satirGrubu[i] != null);
  idx.sort((a, b) => sira(d.satirGrubu[a]) - sira(d.satirGrubu[b]));
  return {
    spec: { ...spec, data: { ...spec.data, rows: idx.map((i) => spec.data.rows[i]) } },
    colors: renkleriDiz(colors, gruplar.map((g) => g.kimlik)),
  };
}

function akisGorunum(spec: ChartSpec, colors: string[]): Gorunum {
  const o = spec.options;
  if (o.sort === "none") return { spec, colors };
  const dugumler = diz(akis(spec), o.sort, o.sira.oge);
  const options = { ...o, sort: "manual" as const, sira: { ...o.sira, oge: dugumler.map((d) => d.anahtar) } };
  // Akor ve yay düğüm dizisini bu sırayla kurar (`toFlow` tohumu); renk de
  // onunla gider. Sankey yalnız sütun içi sırasını, ağ yalnız göstergesini
  // değiştirir — ikisinde düğüm dizisi ve renk kimlik sırasında kalır.
  const tohum = spec.kind === "chord" || spec.kind === "arc";
  return { spec: { ...spec, options }, colors: tohum ? renkleriDiz(colors, dugumler.map((d) => d.kimlik)) : colors };
}

/* ------------------------------------------------------------------ */
/* Panel ve sahne için boyut bilgisi                                    */
/* ------------------------------------------------------------------ */

const OGE_BASLIK: Partial<Record<ChartKind, string>> = {
  radar: "Eksenler",
  marimekko: "Sütunlar",
  slope: "Çizgiler",
  ring: "Halkalar",
  gauge: "Yaylar",
  funnel: "Aşamalar",
  waterfall: "Adımlar",
  pictogram: "Satırlar",
  treemap: "Gruplar",
  sunburst: "Gruplar",
  pack: "Gruplar",
  scatter: "Gruplar",
  bubble: "Gruplar",
  sankey: "Düğümler",
  chord: "Düğümler",
  network: "Düğümler",
  arc: "Düğümler",
};

const OGE_GEOMETRI: Partial<Record<ChartKind, Geometri>> = {
  bar: "x",
  barH: "y",
  line: "x",
  area: "x",
  radar: "aci",
  marimekko: "x",
  ring: "yaricap",
  // Gösterge yayı tam daire değil: kutusunun merkezi yayın merkezi değil, yarıçap
  // ölçülemiyor. Altındaki yaya bırakmak yeterince açık.
  gauge: "2b",
  funnel: "y",
  waterfall: "x",
  pictogram: "y",
  treemap: "2b",
  sunburst: "aci",
  sankey: "y",
  chord: "aci",
  arc: "x",
};

const OGE_NOTU: Partial<Record<ChartKind, string>> = {
  ring: "İlk halka en içte.",
  gauge: "İlk yay en dışta.",
  waterfall: "Toplam hep sonda; sıra ara toplamları değiştirir.",
  pack: "Daire yığınında yerleşim sarmal: sırayı buradan ya da klavyeyle verin.",
  scatter: "Konum veriden gelir; sıra göstergeyi ve üst üste binmeyi belirler.",
  bubble: "Konum veriden gelir; sıra göstergeyi ve üst üste binmeyi belirler.",
  network: "Konum kuvvet yerleşiminden gelir; sıra yalnız göstergede.",
  sankey: "Düğüm yalnız kendi sütunu içinde yer değiştirir.",
};

/** Bu türde sıralanabilen boyutlar, görünen sıralarıyla. Takvim ve haritada boş. */
export function siraBoyutlari(spec: ChartSpec, olculen?: readonly string[]): SiraBoyutBilgisi[] {
  const kind = spec.kind;
  const o = spec.options;
  const shape = dataShape(kind);
  if (shape === "calendar" || shape === "region") return [];

  if (shape === "cartesian") {
    const k = kartezyen(spec);
    const tarih = tarihEkseni(spec, k.ogeler.map((x) => x.ad));
    const kapali = ZAMAN.includes(kind) && tarih;
    const out: SiraBoyutBilgisi[] = [
      {
        boyut: "oge",
        baslik: OGE_BASLIK[kind] ?? "Kategoriler",
        ogeler: kartezyenOgeSirasi(spec, k),
        modlar: SIRA_MODLARI,
        geometri: kapali ? null : (OGE_GEOMETRI[kind] ?? null),
        kapali,
        not: kapali
          ? "Zaman ekseninde sıra tarihten gelir. Elle dizmek için Eksenler → X türü: Kategori."
          : tarih && o.sort === "none"
            ? "Etiketler tarih gibi okunuyor; Otomatik tarih sırasıdır."
            : undefined,
      },
    ];
    if (k.seriler.length > 1) {
      out.push({
        boyut: "seri",
        baslik: kind === "marimekko" ? "Dilimler" : kind === "slope" ? "Duraklar" : "Seriler",
        ogeler: elleDiz(k.seriler, o.sira.seri),
        modlar: [],
        geometri: kind === "slope" ? "x" : null,
        not:
          (kind === "bar" || kind === "barH") && o.stacked
            ? "İlk seri yığının tabanında."
            : kind === "marimekko"
              ? "İlk dilim en üstte."
              : undefined,
      });
    }
    return out;
  }

  const ogeler = gorunenSira(spec, "oge", olculen);
  if (ogeler.length === 0) return [];
  const out: SiraBoyutBilgisi[] = [
    {
      boyut: "oge",
      baslik: OGE_BASLIK[kind] ?? "Öğeler",
      ogeler,
      modlar: SIRA_MODLARI,
      geometri: OGE_GEOMETRI[kind] ?? null,
      not:
        shape === "hierarchy" && o.sort === "none"
          ? "Otomatik: her düzeyde büyükten küçüğe."
          : kind === "sankey" && o.sort === "none"
            ? "Otomatik: kesişmeyi azaltan yerleşim. Düğüm yalnız kendi sütununda yer değiştirir."
            : OGE_NOTU[kind],
    },
  ];
  if (shape === "hierarchy") {
    const h = hiyerarsi(spec);
    if (h.gruplar.some((g) => (h.yapraklar.get(g.anahtar)?.length ?? 0) > 1)) {
      out.push({
        boyut: "alt",
        baslik: "Alt gruplar",
        ogeler: gorunenSira(spec, "alt"),
        modlar: [],
        geometri: kind === "pack" ? null : (OGE_GEOMETRI[kind] ?? null),
        not: "Yaprak yalnız kendi grubunda yer değiştirir.",
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Yazma                                                                */
/* ------------------------------------------------------------------ */

/** `tasinan` bloğunu (listedeki sırasıyla) kalanların `hedef`. yerine koyar. */
export function yerlestir(liste: readonly string[], tasinan: readonly string[], hedef: number): string[] {
  const set = new Set(tasinan);
  const blok = liste.filter((k) => set.has(k));
  if (blok.length === 0) return [...liste];
  const kalan = liste.filter((k) => !set.has(k));
  const h = Math.max(0, Math.min(kalan.length, hedef));
  return [...kalan.slice(0, h), ...blok, ...kalan.slice(h)];
}

/** Sürüklemedeki boşluk (0…n, tam listede) → `yerlestir`'in hedefi. */
export function bosluktanHedef(liste: readonly string[], tasinan: readonly string[], bosluk: number): number {
  const set = new Set(tasinan);
  let h = 0;
  for (let i = 0; i < Math.min(bosluk, liste.length); i++) if (!set.has(liste[i])) h++;
  return h;
}

/** Klavye ve menü: bir adım öne/arkaya ya da uca. */
export function adimHedefi(liste: readonly string[], tasinan: readonly string[], yon: -1 | 1, uca: boolean): number {
  const set = new Set(tasinan);
  const kalan = liste.filter((k) => !set.has(k)).length;
  if (uca) return yon < 0 ? 0 : kalan;
  const ilk = liste.findIndex((k) => set.has(k));
  if (ilk < 0) return 0;
  return Math.max(0, Math.min(kalan, bosluktanHedef(liste, tasinan, ilk) + yon));
}

/**
 * Bir alt kümenin (sankey sütunu) içinde taşımak. Genel listede yalnız taşınan
 * anahtarın yeri değişir: yeni komşusunun hemen önüne (ya da sonuncunun
 * ardına) girer, başka sütunların sırası olduğu gibi kalır.
 */
export function altKumedeTasi(genel: readonly string[], kume: readonly string[], anahtar: string, kumeHedef: number): string[] {
  const yeni = yerlestir(kume, [anahtar], kumeHedef);
  const i = yeni.indexOf(anahtar);
  const kalan = genel.filter((k) => k !== anahtar);
  const sonraki = yeni[i + 1];
  const onceki = yeni[i - 1];
  const at = sonraki != null ? kalan.indexOf(sonraki) : onceki != null ? kalan.indexOf(onceki) + 1 : kalan.length;
  const yerI = at < 0 ? kalan.length : at;
  return [...kalan.slice(0, yerI), anahtar, ...kalan.slice(yerI)];
}

/**
 * O an çizilen sırayı "Elle" olarak dondurur. Zaten elleyse listeyi bugünkü
 * veriyle tamamlar (yeni öğeler sona). Hiyerarşide yapraklar da donar: değere
 * göre dizilmiş yaprakların ilk sürüklemede tablo sırasına zıplamaması için.
 */
function dondur(spec: ChartSpec, olculen?: readonly string[]): ChartSpec {
  const o = spec.options;
  const oge = gorunenSira(spec, "oge", olculen).map((x) => x.anahtar);
  let alt = o.sira.alt;
  if (dataShape(spec.kind) === "hierarchy") {
    alt = {};
    for (const y of gorunenSira(spec, "alt")) (alt[y.grup!] ??= []).push(y.anahtar);
  }
  return { ...spec, options: { ...o, sort: "manual", sira: { ...o.sira, oge, alt } } };
}

export interface SiraSecenegi {
  /** `alt` boyutunda yaprağın grubu. */
  grup?: string;
  /** Sankey "Otomatik"te sahnede ölçülen düğüm sırası — bkz. `gorunenSira`. */
  olculen?: readonly string[];
}

/** Bir boyutun bugünkü sırasını `fn` ile değiştirir; öğe boyutunda mod "Elle" olur. */
export function siraUygula(
  spec: ChartSpec,
  boyut: SiraBoyutu,
  fn: (simdi: string[]) => string[],
  sec: SiraSecenegi = {}
): ChartSpec {
  if (boyut === "seri") {
    const o = spec.options;
    const simdi = gorunenSira(spec, "seri").map((x) => x.anahtar);
    return { ...spec, options: { ...o, sira: { ...o.sira, seri: fn(simdi) } } };
  }
  const d = dondur(spec, sec.olculen);
  const o = d.options;
  if (boyut === "alt") {
    if (sec.grup == null) return spec;
    const simdi = o.sira.alt[sec.grup] ?? [];
    return { ...d, options: { ...o, sira: { ...o.sira, alt: { ...o.sira.alt, [sec.grup]: fn(simdi) } } } };
  }
  return { ...d, options: { ...o, sira: { ...o.sira, oge: fn(o.sira.oge) } } };
}

/** Sürükleme, klavye ve menünün ortak kapısı. */
export function siraTasi(
  spec: ChartSpec,
  boyut: SiraBoyutu,
  anahtarlar: readonly string[],
  hedef: number,
  sec: SiraSecenegi = {}
): ChartSpec {
  return siraUygula(spec, boyut, (simdi) => yerlestir(simdi, anahtarlar, hedef), sec);
}

/**
 * Mod değiştirmek. "Elle"ye geçerken hatırlanan bir liste varsa o geri gelir;
 * yoksa o anki görüntü dondurulur — kullanıcı "Elle"ye basınca grafik
 * kıpırdamamalı.
 */
export function siraModu(spec: ChartSpec, mod: SortOrder, olculen?: readonly string[]): ChartSpec {
  const o = spec.options;
  if (mod === o.sort) return spec;
  if (mod === "manual" && o.sira.oge.length === 0) return dondur(spec, olculen);
  return { ...spec, options: { ...o, sort: mod } };
}

/** Ters çevir: değer modunda yönü değiştirir, diğerlerinde görüntüyü ters "Elle" yapar. */
export function tersCevir(spec: ChartSpec, boyut: SiraBoyutu, sec: SiraSecenegi = {}): ChartSpec {
  const o = spec.options;
  if (boyut === "oge" && (o.sort === "asc" || o.sort === "desc")) {
    return { ...spec, options: { ...o, sort: o.sort === "asc" ? "desc" : "asc" } };
  }
  return siraUygula(spec, boyut, (s) => [...s].reverse(), sec);
}

/** Serileri tablodaki sütun sırasına döndürür. */
export function seriSifirla(spec: ChartSpec): ChartSpec {
  const o = spec.options;
  return { ...spec, options: { ...o, sira: { ...o.sira, seri: [] } } };
}

/* ------------------------------------------------------------------ */
/* Tablo düzenlenince adları izlemek                                    */
/* ------------------------------------------------------------------ */

/** Hangi tablo sütunları öğe adı taşıyor. */
function adSutunlari(kind: ChartKind): number[] {
  switch (dataShape(kind)) {
    case "cartesian":
    case "categoryValue":
    case "hierarchy":
      return [0];
    case "xy":
      return [4];
    case "flow":
      return [0, 1];
    default:
      return [];
  }
}

function adKumesi(rows: string[][], sutunlar: number[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) for (const c of sutunlar) {
    const v = temiz(r[c]);
    if (v) s.add(v);
  }
  return s;
}

/**
 * Tablodaki bir ad değişince elle sıradaki ve vurgudaki karşılığını da
 * değiştirir — yoksa adını düzelttiğiniz öğe listenin sonuna zıplardı.
 *
 * Satır **indeksiyle** karşılaştırır (aynı satırdaki eski ad → yeni ad);
 * satır sayısı değiştiyse dokunmaz. Hücreyi boşaltıp yeniden yazmak iki ayrı
 * düzenleme: ikincisinde eski ad elle listede ama tabloda yok, yeni ad
 * tabloda ama listede yok — tam birer tane kaldıysa o da yeniden adlandırma.
 */
export function adlariTasi(onceki: ChartSpec, yeni: TableData): ChartSpec {
  const sonraki: ChartSpec = { ...onceki, data: yeni };
  const o = onceki.options;
  const sutunlar = adSutunlari(onceki.kind);
  const ogeAd = new Map<string, string>();
  const eski = onceki.data.rows;
  if (sutunlar.length > 0 && eski.length === yeni.rows.length) {
    const eskiAdlar = adKumesi(eski, sutunlar);
    const yeniAdlar = adKumesi(yeni.rows, sutunlar);
    for (let i = 0; i < eski.length; i++)
      for (const c of sutunlar) {
        const a = temiz(eski[i][c]);
        const b = temiz(yeni.rows[i][c]);
        if (a && b && a !== b && !yeniAdlar.has(a) && !eskiAdlar.has(b)) ogeAd.set(a, b);
      }
    if (ogeAd.size === 0) {
      const izlenen = new Set([...o.sira.oge, ...o.highlight]);
      const kayip = [...izlenen].filter((k) => !yeniAdlar.has(k) && !/#\d+$/.test(k));
      const dogan = [...yeniAdlar].filter((k) => !eskiAdlar.has(k) && !izlenen.has(k));
      if (kayip.length === 1 && dogan.length === 1) ogeAd.set(kayip[0], dogan[0]);
    }
  }
  const seriAd = new Map<string, string>();
  if (dataShape(onceki.kind) === "cartesian" && onceki.data.columns.length === yeni.columns.length) {
    const eskiSet = new Set(onceki.data.columns.map(temiz));
    const yeniSet = new Set(yeni.columns.map(temiz));
    for (let i = 1; i < yeni.columns.length; i++) {
      const a = temiz(onceki.data.columns[i]);
      const b = temiz(yeni.columns[i]);
      if (a && b && a !== b && !yeniSet.has(a) && !eskiSet.has(b)) seriAd.set(a, b);
    }
  }
  if (ogeAd.size === 0 && seriAd.size === 0) return sonraki;
  const cevir = (m: Map<string, string>) => (k: string) => m.get(k) ?? k;
  return {
    ...sonraki,
    options: {
      ...o,
      highlight: o.highlight.map(cevir(ogeAd)),
      sira: {
        oge: o.sira.oge.map(cevir(ogeAd)),
        seri: o.sira.seri.map(cevir(seriAd)),
        alt: Object.fromEntries(Object.entries(o.sira.alt).map(([g, l]) => [ogeAd.get(g) ?? g, l])),
      },
    },
  };
}
