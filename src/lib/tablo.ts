/**
 * Veri tablosunun işlemleri — saf, React'siz.
 *
 * Tablo grafiğin kaynağı; grafikteki sıra ayrı bir ayar (`sira.ts`), burada
 * yapılan her şey tablonun kendisini değiştirir. Fonksiyonlar her zaman yeni
 * bir `TableData` döner, girdiyi değiştirmez — geri al yığını eski nesneyi
 * tutuyor.
 *
 * Kurallar kullanıcı yolculuklarından geliyor (bkz. `scripts/veri-check.mjs`):
 * Excel'den bir tabloyu ilk kez getirmek, tek bir sütunu yeni dönemin
 * sayılarıyla değiştirmek, yeni bir seri eklemek, tablodan Excel'e ve
 * PowerPoint'e geri kopyalamak, satır ve sütunları elle düzenlemek.
 */
import type { Locale } from "./format";
import type { Aralik } from "./grid-selection";
import { parseDate, parseNumber } from "./parse";
import { columnRoles, columnTypes, type ChartKind, type ColumnType, type TableData } from "./spec";

export interface Roller {
  /** Türün sabit sütun sayısı (kartezyende yalnız kategori). */
  sabit: number;
  /** Seri sütunu eklenip çıkarılabiliyor mu (yalnız kartezyen). */
  seriEklenir: boolean;
  /** Yeni seri sütununun adı ("Seri"). */
  seriAdi: string | null;
}

export function rolleri(kind: ChartKind): Roller {
  const r = columnRoles(kind);
  return { sabit: r.fixed.length, seriEklenir: r.seriesLabel != null, seriAdi: r.seriesLabel };
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

const bos = (n: number) => Array.from({ length: n }, () => "");

/** Her satır sütun sayısı kadar hücre taşısın. */
function tamamla(columns: string[], rows: string[][]): TableData {
  const n = columns.length;
  return {
    columns,
    rows: rows.map((r) => (r.length === n ? r : [...r, ...bos(Math.max(0, n - r.length))].slice(0, n))),
  };
}

const kopya = (t: TableData): TableData => tamamla([...t.columns], t.rows.map((r) => [...r]));

/** Henüz kullanılmayan ilk "Seri n" adı. */
function yeniSeriAdi(columns: string[], roller: Roller): string {
  const kok = roller.seriAdi ?? "Sütun";
  for (let n = 1; ; n++) {
    const ad = `${kok} ${n}`;
    if (!columns.includes(ad)) return ad;
  }
}

const sayiMi = (s: string, loc: Locale = "tr-TR") => parseNumber(s, loc) != null;
const yilMi = (s: string) => /^(1[89]\d\d|2[01]\d\d)$/.test(s.trim());

/* ------------------------------------------------------------------ */
/* Hücreler                                                             */
/* ------------------------------------------------------------------ */

/** Tek hücre; `r === -1` sütunun adı. */
export function hucreYaz(t: TableData, r: number, c: number, v: string): TableData {
  if (r < 0) {
    const columns = [...t.columns];
    columns[c] = v;
    return { ...t, columns };
  }
  const rows = t.rows.map((row) => [...row]);
  while (rows.length <= r) rows.push(bos(t.columns.length));
  while (rows[r].length < t.columns.length) rows[r].push("");
  rows[r][c] = v;
  return { ...t, rows };
}

/** Hücre değeri; `r === -1` sütunun adı. */
export const hucreOku = (t: TableData, r: number, c: number): string => (r < 0 ? (t.columns[c] ?? "") : (t.rows[r]?.[c] ?? ""));

/** Aralıktaki gövde hücrelerini boşaltır. Başlık (sütun adı) silinmez. */
export function araligiTemizle(t: TableData, a: Aralik): TableData {
  const rows = t.rows.map((row, r) =>
    r < a.r0 || r > a.r1 ? row : row.map((v, c) => (c >= a.c0 && c <= a.c1 ? "" : v))
  );
  return { ...t, rows };
}

/** Aralığı bir değerle doldurur — tek bir değeri çok hücreye yapıştırmak. */
export function doldur(t: TableData, a: Aralik, v: string): TableData {
  const d = kopya(t);
  for (let r = a.r0; r <= a.r1 && r < d.rows.length; r++) for (let c = a.c0; c <= a.c1 && c < d.columns.length; c++) d.rows[r][c] = v;
  return d;
}

/**
 * Aşağı doldur (`Ctrl+D`): aralığın ilk satırı altındakilere kopyalanır. Tek
 * satır seçiliyse üstündeki satırdan doldurur — Excel'deki gibi.
 */
export function asagiDoldur(t: TableData, a: Aralik): TableData {
  const d = kopya(t);
  const kaynak = a.r0 === a.r1 ? a.r0 - 1 : a.r0;
  if (kaynak < 0) return t;
  const ilk = a.r0 === a.r1 ? a.r0 : a.r0 + 1;
  for (let r = ilk; r <= a.r1 && r < d.rows.length; r++)
    for (let c = a.c0; c <= a.c1 && c < d.columns.length; c++) d.rows[r][c] = d.rows[kaynak][c] ?? "";
  return d;
}

/* ------------------------------------------------------------------ */
/* Kopyalama                                                            */
/* ------------------------------------------------------------------ */

/** Aralığın matrisi; sütun seçiliyse başlık (sütun adları) ilk satır. */
export function araligiAl(t: TableData, a: Aralik): string[][] {
  const satirlar: string[][] = [];
  if (a.baslik) satirlar.push(t.columns.slice(a.c0, a.c1 + 1));
  for (let r = a.r0; r <= a.r1 && r < t.rows.length; r++) {
    const row = t.rows[r];
    satirlar.push(Array.from({ length: a.c1 - a.c0 + 1 }, (_, j) => row[a.c0 + j] ?? ""));
  }
  return satirlar;
}

/**
 * Excel'in anladığı sekmeli metin. Sekme, satır sonu ya da tırnak taşıyan
 * hücre tırnağa alınır (içteki tırnak ikilenir) — Excel de böyle yazıyor ve
 * `parseDelimited` aynısını geri okuyor.
 */
export function tsv(m: string[][]): string {
  const kac = (v: string) => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return m.map((r) => r.map(kac).join("\t")).join("\n");
}

/** PowerPoint ve Word tabloya, Excel hücrelere yapıştırsın diye HTML de. */
export function htmlTablo(m: string[][], baslik: boolean): string {
  const kac = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const satir = (r: string[], i: number) => {
    const tag = baslik && i === 0 ? "th" : "td";
    return `<tr>${r.map((v) => `<${tag}>${kac(v)}</${tag}>`).join("")}</tr>`;
  };
  return `<table>${m.map(satir).join("")}</table>`;
}

/* ------------------------------------------------------------------ */
/* Yapıştırma                                                           */
/* ------------------------------------------------------------------ */

/**
 * İlk satır başlık mı — tüm tablo yapıştırılırken.
 *
 * Eski kural "ilk satırın ilk sütundan sonraki hücrelerinin çoğu sayı değil"
 * idi ve en yaygın grafik tablosunda yanılıyordu: başlıkları yıl olan bir
 * tablo (`Ürün | 2023 | 2024`). Şimdi sütun sütun bakılıyor: gövdesi sayı olan
 * bir sütunun ilk hücresi sayı değilse — ya da yılsa ve altında yıl olmayan
 * sayılar varsa — o sütun "başlıklı" oyu verir.
 */
export function baslikMi(m: string[][], loc: Locale = "tr-TR"): boolean {
  if (m.length < 2) return false;
  const ilk = m[0];
  const govde = m.slice(1);
  let sayisal = 0;
  let oy = 0;
  for (let j = 0; j < ilk.length; j++) {
    const h = (ilk[j] ?? "").trim();
    const altlar = govde.map((r) => (r[j] ?? "").trim()).filter(Boolean);
    if (altlar.length === 0) continue;
    if (altlar.filter((x) => sayiMi(x, loc)).length / altlar.length < 0.6) continue;
    sayisal++;
    if (h && (!sayiMi(h, loc) || (yilMi(h) && altlar.some((x) => !yilMi(x))))) oy++;
  }
  if (sayisal > 0) return oy >= Math.ceil(sayisal / 2);
  // Hiç sayısal sütun yok (akış tablosunun yalnız ad sütunları): eski kural.
  const ilkler = ilk.slice(1).filter(Boolean);
  return ilkler.length > 0 && ilkler.filter((x) => !sayiMi(x, loc)).length >= Math.ceil(ilkler.length / 2);
}

/**
 * Başlığa yapıştırırken ilk satır veri mi. Kullanıcı başlığı hedeflediği için
 * varsayılan "başlık"; yalnız ilk satır açıkça sayıysa (ve yıl-başlık gibi
 * okunmuyorsa) veri sayılır — bir sütuna sadece değerleri yapıştırmak.
 */
export function ilkSatirVeriMi(m: string[][], loc: Locale = "tr-TR"): boolean {
  const ilk = (m[0] ?? []).map((x) => x.trim()).filter(Boolean);
  if (ilk.length === 0) return false;
  return m[0].every((h, j) => {
    const v = h.trim();
    if (!v) return true;
    if (!sayiMi(v, loc)) return false;
    const altlar = m.slice(1).map((r) => (r[j] ?? "").trim()).filter(Boolean);
    return !(yilMi(v) && altlar.some((x) => sayiMi(x, loc) && !yilMi(x)));
  });
}

export interface YapistirSecenegi {
  /** Bütün tablo yerine konur: sütun adları ve satırlar baştan kurulur. */
  tumTablo?: boolean;
  /**
   * Bloğun ilk satırı başlık mı — `tumTablo` ve başlığa yapıştırmada.
   * `"oto"`: tahmin; `true`/`false`: kullanıcının bildirim çubuğundan seçtiği.
   */
  baslik?: boolean | "oto";
  locale?: Locale;
}

export interface YapistirSonuc {
  tablo: TableData;
  /** Yapıştırılan gövde aralığı — seçili bırakmak için. */
  aralik: { r0: number; c0: number; r1: number; c1: number };
  /** İlk satır başlık olarak kullanıldı mı; `null`: soru yoktu. */
  baslik: boolean | null;
  eklenenSatir: number;
  eklenenSutun: number;
  /** Türün sabit sütunlarına sığmayıp düşen sütun sayısı. */
  sigmayan: number;
  /** Blok ilk satırdan başladıysa altında kalan eski satır sayısı. */
  kalan: number;
}

/**
 * Bir bloğu tabloya yapıştırır. Üç kip:
 *
 * - `tumTablo` — tablo yerine konur; ilk satırın başlık olup olmadığı tahmin
 *   edilir (ya da kullanıcı söyler).
 * - `hedef.r === -1` (sütun seçili) — ilk satır sütun adlarına, gerisi ilk
 *   satırdan itibaren değerlere; ilk satır açıkça sayıysa hepsi değer.
 * - aksi hâlde — hedef hücreden başlayıp üzerine yazar, gerekirse satır (ve
 *   kartezyende seri sütunu) ekler. Excel'in davranışı.
 */
export function yapistir(t: TableData, m: string[][], hedef: { r: number; c: number }, roller: Roller, sec: YapistirSecenegi = {}): YapistirSonuc {
  const loc = sec.locale ?? "tr-TR";
  const genislik = Math.max(1, ...m.map((r) => r.length));
  const yok: YapistirSonuc = { tablo: t, aralik: { r0: 0, c0: 0, r1: 0, c1: 0 }, baslik: null, eklenenSatir: 0, eklenenSutun: 0, sigmayan: 0, kalan: 0 };
  if (m.length === 0) return yok;

  if (sec.tumTablo) {
    const baslik = sec.baslik === "oto" || sec.baslik == null ? baslikMi(m, loc) : sec.baslik;
    const govde = baslik ? m.slice(1) : m;
    const ilk = baslik ? m[0] : [];
    const n = roller.seriEklenir ? Math.max(roller.sabit + 1, genislik) : roller.sabit;
    const columns: string[] = [];
    for (let j = 0; j < n; j++) {
      // Başlık yoksa eski ad kalır: aynı tabloyu yeni dönemin sayılarıyla
      // değiştirmek seri adlarını silmesin.
      const ad = (ilk[j] ?? "").trim() || (t.columns[j] ?? "").trim();
      columns.push(ad || (j < roller.sabit ? "" : yeniSeriAdi(columns, roller)));
    }
    const rows = govde.length > 0 ? govde.map((r) => r.slice(0, n)) : [bos(n)];
    const tablo = tamamla(columns, rows);
    return {
      tablo,
      aralik: { r0: 0, c0: 0, r1: tablo.rows.length - 1, c1: n - 1 },
      baslik,
      eklenenSatir: Math.max(0, tablo.rows.length - t.rows.length),
      eklenenSutun: Math.max(0, n - t.columns.length),
      sigmayan: Math.max(0, genislik - n),
      kalan: 0,
    };
  }

  let r0 = hedef.r;
  const c0 = Math.max(0, hedef.c);
  let govde = m;
  let adlar: string[] | null = null;
  let baslik: boolean | null = null;
  if (r0 < 0) {
    baslik = sec.baslik === "oto" || sec.baslik == null ? m.length === 1 || !ilkSatirVeriMi(m, loc) : sec.baslik;
    if (baslik) {
      adlar = m[0];
      govde = m.slice(1);
    }
    r0 = 0;
  }

  const columns = [...t.columns];
  const gereken = c0 + genislik;
  let eklenenSutun = 0;
  if (roller.seriEklenir) {
    while (columns.length < gereken) {
      columns.push(yeniSeriAdi(columns, roller));
      eklenenSutun++;
    }
  }
  const sigmayan = Math.max(0, gereken - columns.length);
  const d = tamamla(columns, t.rows.map((r) => [...r]));
  let eklenenSatir = 0;
  while (d.rows.length < r0 + govde.length) {
    d.rows.push(bos(columns.length));
    eklenenSatir++;
  }
  for (let i = 0; i < govde.length; i++)
    for (let j = 0; j < govde[i].length && c0 + j < columns.length; j++) d.rows[r0 + i][c0 + j] = govde[i][j];
  if (adlar) {
    for (let j = 0; j < adlar.length && c0 + j < columns.length; j++) {
      const ad = adlar[j].trim();
      if (ad) d.columns[c0 + j] = ad;
    }
  }
  const c1 = Math.min(columns.length - 1, c0 + genislik - 1);
  return {
    tablo: d,
    aralik: { r0, c0, r1: Math.max(r0, r0 + govde.length - 1), c1 },
    baslik,
    eklenenSatir,
    eklenenSutun,
    sigmayan,
    kalan: r0 === 0 && govde.length > 0 ? Math.max(0, d.rows.length - govde.length) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Satırlar                                                             */
/* ------------------------------------------------------------------ */

/** `at` konumuna `n` boş satır. */
export function satirEkle(t: TableData, at: number, n = 1): TableData {
  const rows = t.rows.map((r) => [...r]);
  rows.splice(Math.max(0, Math.min(rows.length, at)), 0, ...Array.from({ length: n }, () => bos(t.columns.length)));
  return { ...t, rows };
}

/** Satırları siler; hiç satır kalmazsa bir boş satır bırakır (tablo hiç boşalmaz). */
export function satirlariSil(t: TableData, satirlar: readonly number[]): TableData {
  const sil = new Set(satirlar);
  const rows = t.rows.filter((_, i) => !sil.has(i));
  return { ...t, rows: rows.length > 0 ? rows : [bos(t.columns.length)] };
}

/** Seçili satırların kopyası bloğun hemen altına. */
export function satirlariCogalt(t: TableData, satirlar: readonly number[]): { tablo: TableData; yeni: number[] } {
  const sirali = [...new Set(satirlar)].sort((a, b) => a - b);
  if (sirali.length === 0) return { tablo: t, yeni: [] };
  const son = sirali[sirali.length - 1];
  const rows = t.rows.map((r) => [...r]);
  rows.splice(son + 1, 0, ...sirali.map((i) => [...t.rows[i]]));
  return { tablo: { ...t, rows }, yeni: sirali.map((_, k) => son + 1 + k) };
}

/**
 * Satır bloğunu taşır. `bosluk` asıl dizideki boşluk (0…n): blok o boşluğa
 * girer. Dönen `yeni`, bloğun taşındıktan sonraki satırları.
 */
export function satirlariTasi(t: TableData, satirlar: readonly number[], bosluk: number): { tablo: TableData; yeni: number[] } {
  const blok = [...new Set(satirlar)].filter((i) => i >= 0 && i < t.rows.length).sort((a, b) => a - b);
  if (blok.length === 0) return { tablo: t, yeni: [] };
  const set = new Set(blok);
  const kalan = t.rows.filter((_, i) => !set.has(i));
  let hedef = 0;
  for (let i = 0; i < Math.min(bosluk, t.rows.length); i++) if (!set.has(i)) hedef++;
  const rows = [...kalan.slice(0, hedef), ...blok.map((i) => t.rows[i]), ...kalan.slice(hedef)];
  return { tablo: { ...t, rows }, yeni: blok.map((_, k) => hedef + k) };
}

/** Satırları bir adım (`yon`) yukarı ya da aşağı. */
export function satirlariKaydir(t: TableData, satirlar: readonly number[], yon: -1 | 1): { tablo: TableData; yeni: number[] } {
  const blok = [...new Set(satirlar)].sort((a, b) => a - b);
  if (blok.length === 0) return { tablo: t, yeni: [] };
  if (yon < 0 && blok[0] === 0) return { tablo: t, yeni: blok };
  if (yon > 0 && blok[blok.length - 1] === t.rows.length - 1) return { tablo: t, yeni: blok };
  return satirlariTasi(t, blok, yon < 0 ? blok[0] - 1 : blok[blok.length - 1] + 2);
}

/** Tamamen boş satırlar silinir (tablo yine de en az bir satır tutar). */
export function bosSatirlariSil(t: TableData): TableData {
  const rows = t.rows.filter((r) => r.some((v) => v.trim() !== ""));
  return { ...t, rows: rows.length > 0 ? rows : [bos(t.columns.length)] };
}

/**
 * Tabloyu bir sütuna göre fiziksel olarak sıralar — grafiğin sırası değil,
 * tablonun kendisi. Sayılar sayı gibi, metin Türkçe alfabeyle; boşlar hep sonda.
 */
export function tabloSirala(t: TableData, c: number, yon: 1 | -1, loc: Locale = "tr-TR"): TableData {
  const deger = (r: string[]) => (r[c] ?? "").trim();
  const sayisal = t.rows.filter((r) => deger(r) !== "").every((r) => sayiMi(deger(r), loc));
  const rows = [...t.rows].sort((a, b) => {
    const x = deger(a);
    const y = deger(b);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    const f = sayisal ? parseNumber(x, loc)! - parseNumber(y, loc)! : x.localeCompare(y, "tr", { numeric: true, sensitivity: "base" });
    return yon * f;
  });
  return { ...t, rows };
}

/* ------------------------------------------------------------------ */
/* Sütunlar (yalnız seri sütunları eklenip taşınabilir)                  */
/* ------------------------------------------------------------------ */

/** `at` konumuna yeni bir seri sütunu. Sabit sütunların önüne girmez. */
export function sutunEkle(t: TableData, at: number, roller: Roller): TableData {
  if (!roller.seriEklenir) return t;
  const i = Math.max(roller.sabit, Math.min(t.columns.length, at));
  const columns = [...t.columns];
  columns.splice(i, 0, yeniSeriAdi(t.columns, roller));
  return { columns, rows: t.rows.map((r) => [...r.slice(0, i), "", ...r.slice(i)]) };
}

/** Seri sütunlarını siler; en az bir seri kalır, sabit sütunlar silinmez. */
export function sutunlariSil(t: TableData, sutunlar: readonly number[], roller: Roller): TableData {
  if (!roller.seriEklenir) return t;
  const sil = new Set(sutunlar.filter((c) => c >= roller.sabit));
  if (t.columns.length - sil.size < roller.sabit + 1) return t;
  const tut = (_: unknown, i: number) => !sil.has(i);
  return { columns: t.columns.filter(tut), rows: t.rows.map((r) => r.filter(tut)) };
}

/** Seri sütunlarını boşluğa (`bosluk`, asıl dizide) taşır; sabit sütunların önüne geçmez. */
export function sutunlariTasi(t: TableData, sutunlar: readonly number[], bosluk: number, roller: Roller): { tablo: TableData; yeni: number[] } {
  const blok = [...new Set(sutunlar)].filter((c) => c >= roller.sabit && c < t.columns.length).sort((a, b) => a - b);
  if (!roller.seriEklenir || blok.length === 0) return { tablo: t, yeni: [] };
  const set = new Set(blok);
  const sira = t.columns.map((_, i) => i).filter((i) => !set.has(i));
  let hedef = 0;
  for (let i = 0; i < Math.min(Math.max(bosluk, roller.sabit), t.columns.length); i++) if (!set.has(i)) hedef++;
  hedef = Math.max(roller.sabit, hedef);
  const yeniSira = [...sira.slice(0, hedef), ...blok, ...sira.slice(hedef)];
  return {
    tablo: { columns: yeniSira.map((i) => t.columns[i]), rows: t.rows.map((r) => yeniSira.map((i) => r[i] ?? "")) },
    yeni: blok.map((_, k) => hedef + k),
  };
}

/** Seri sütunlarını bir adım sola/sağa. */
export function sutunlariKaydir(t: TableData, sutunlar: readonly number[], yon: -1 | 1, roller: Roller): { tablo: TableData; yeni: number[] } {
  const blok = [...new Set(sutunlar)].filter((c) => c >= roller.sabit).sort((a, b) => a - b);
  if (blok.length === 0) return { tablo: t, yeni: [] };
  if (yon < 0 && blok[0] <= roller.sabit) return { tablo: t, yeni: blok };
  if (yon > 0 && blok[blok.length - 1] === t.columns.length - 1) return { tablo: t, yeni: blok };
  return sutunlariTasi(t, blok, yon < 0 ? blok[0] - 1 : blok[blok.length - 1] + 2, roller);
}

/* ------------------------------------------------------------------ */
/* Bütün tablo                                                          */
/* ------------------------------------------------------------------ */

/**
 * Satır ↔ sütun çevir (devrik). Excel'den gelen tablo çoğu zaman ters
 * yönlüdür: yıllar satırda, ürünler sütunda. Yalnız seri sütunu olan türlerde.
 */
export function devrik(t: TableData, roller: Roller): TableData {
  if (!roller.seriEklenir) return t;
  const kategoriler = t.rows.map((r, i) => (r[0] ?? "").trim() || `#${i + 1}`);
  const columns = [t.columns[0] ?? "", ...kategoriler];
  const rows = t.columns.slice(1).map((ad, j) => [ad, ...t.rows.map((r) => r[j + 1] ?? "")]);
  return tamamla(columns, rows.length > 0 ? rows : [bos(columns.length)]);
}

/** İlk satır sütun adı olur (yanlış tahmin edilmiş başlık için). */
export function ilkSatiriBaslikYap(t: TableData): TableData {
  if (t.rows.length === 0) return t;
  const ilk = t.rows[0];
  const columns = t.columns.map((ad, i) => (ilk[i] ?? "").trim() || ad);
  return { columns, rows: t.rows.length > 1 ? t.rows.slice(1).map((r) => [...r]) : [bos(columns.length)] };
}

/** Sütun adları ilk satıra iner; adlar varsayılana döner. */
export function basligiSatiraIndir(t: TableData, roller: Roller): TableData {
  const columns: string[] = [];
  for (let i = 0; i < t.columns.length; i++) columns.push(i < roller.sabit ? "" : yeniSeriAdi(columns, roller));
  return { columns, rows: [[...t.columns], ...t.rows.map((r) => [...r])] };
}

/** Değerleri boşaltır, sütunlar ve satır sayısı kalır. */
export function tabloyuTemizle(t: TableData): TableData {
  return { ...t, rows: t.rows.map((r) => bos(r.length)) };
}

/* ------------------------------------------------------------------ */
/* Doğrulama ve özet                                                    */
/* ------------------------------------------------------------------ */

/**
 * Türüne uymayan hücreler: sayı sütununda sayı olmayan, tarih sütununda tarih
 * olmayan dolu hücre. `"r:c"` anahtarlarıyla. Yanlış yapıştırılmış bir aralığı
 * grafiğe bakmadan yakalamak için — boş hücre hata değil.
 */
export function hataliHucreler(t: TableData, kind: ChartKind, loc: Locale = "tr-TR"): Set<string> {
  const tipler: ColumnType[] = columnTypes(kind, t.columns.length);
  const out = new Set<string>();
  t.rows.forEach((row, r) =>
    row.forEach((v, c) => {
      const s = (v ?? "").trim();
      if (!s) return;
      if (tipler[c] === "sayi" && !sayiMi(s, loc)) out.add(`${r}:${c}`);
      if (tipler[c] === "tarih" && parseDate(s) == null) out.add(`${r}:${c}`);
    })
  );
  return out;
}

export interface SecimOzeti {
  /** Dolu hücre sayısı. */
  dolu: number;
  /** Sayı okunan hücre sayısı. */
  sayi: number;
  toplam: number;
  ortalama: number | null;
}

/** Excel'in durum çubuğu: seçimdeki sayıların toplamı ve ortalaması. */
export function secimOzeti(t: TableData, a: Aralik, loc: Locale = "tr-TR"): SecimOzeti {
  let dolu = 0;
  let sayi = 0;
  let toplam = 0;
  for (let r = a.r0; r <= a.r1 && r < t.rows.length; r++)
    for (let c = a.c0; c <= a.c1; c++) {
      const v = (t.rows[r]?.[c] ?? "").trim();
      if (!v) continue;
      dolu++;
      const n = parseNumber(v, loc);
      if (n != null) {
        sayi++;
        toplam += n;
      }
    }
  return { dolu, sayi, toplam, ortalama: sayi > 0 ? toplam / sayi : null };
}
