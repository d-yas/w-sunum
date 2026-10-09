/**
 * Veri tablosundaki seçim — saf, React'siz, DOM'suz.
 *
 * Ayrı bir modül olmasının sebebi projenin kendi deseni (`selection.ts`,
 * `katmanlar.ts`, `free-layout.ts` hepsi böyle) ve test edilebilirlik: aralık
 * matematiği — blok atlama, satır silindikten sonra seçimin nereye kayacağı —
 * tam olarak birim testi hak eden yer, ve burada bir tarayıcıya ihtiyaç yok.
 *
 * Üç kip, Excel'in ve Airtable'ın birleşimi:
 *
 * - **hücre** — gövdede bir dikdörtgen. Başlık satırı buna girmez: bir
 *   sütunun adı ile değerleri aynı aralıkta seçili olsaydı "temizle"nin ne
 *   yapacağı belirsiz olurdu.
 * - **satır** — satır numarasına tıklamak; bütün sütunlar.
 * - **sütun** — başlığa tıklamak; başlık **ve** bütün değerler. Odak başlıkta
 *   (`r === -1`) durur: yazmaya başlamak sütunun adını değiştirir.
 *
 * Başlık satırı bu yüzden yalnız sütun kipinde seçili olabilir; yukarı ok
 * ilk satırdan başlığa çıkınca seçim sütun kipine geçer, aşağı ok geri indirir.
 */

export interface Hucre {
  /** Gövde satırı 0…n-1; `-1` başlık satırı. */
  r: number;
  c: number;
}

export type SecimModu = "hucre" | "satir" | "sutun";

export interface GridSecim {
  /** Sabit uç — `Shift` ile genişletirken yerinde kalan. */
  anchor: Hucre;
  /** Hareketli uç — aktif hücre. */
  focus: Hucre;
  mod: SecimModu;
}

export interface Boyut {
  satir: number;
  sutun: number;
}

/** Normalize edilmiş gövde aralığı; `baslik` sütun kipinde başlık satırının da seçili olduğunu söyler. */
export interface Aralik {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  baslik: boolean;
}

export const hucre = (r: number, c: number): Hucre => ({ r, c });

export const tekSecim = (r: number, c: number): GridSecim => ({ anchor: hucre(r, c), focus: hucre(r, c), mod: "hucre" });

const kis = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Tam sütun(lar) — `c0`'dan `c1`'e, odak başlıkta. */
export function sutunSecimi(c0: number, b: Boyut, c1 = c0): GridSecim {
  const a = kis(c0, 0, b.sutun - 1);
  const z = kis(c1, 0, b.sutun - 1);
  return { anchor: hucre(-1, a), focus: hucre(-1, z), mod: "sutun" };
}

/** Tam satır(lar) — `r0`'dan `r1`'e, odak satırın ilk hücresinde. */
export function satirSecimi(r0: number, b: Boyut, r1 = r0): GridSecim {
  const a = kis(r0, 0, b.satir - 1);
  const z = kis(r1, 0, b.satir - 1);
  return { anchor: hucre(a, 0), focus: hucre(z, 0), mod: "satir" };
}

/** Tüm tablo: başlık dâhil bütün sütunlar. */
export function hepsi(b: Boyut): GridSecim {
  return sutunSecimi(0, b, b.sutun - 1);
}

/** Tüm tablo mu seçili. */
export function hepsiMi(s: GridSecim, b: Boyut): boolean {
  return s.mod === "sutun" && Math.min(s.anchor.c, s.focus.c) === 0 && Math.max(s.anchor.c, s.focus.c) === b.sutun - 1;
}

/** Seçimin kapladığı gövde aralığı (ve sütun kipinde başlık). */
export function aralik(s: GridSecim, b: Boyut): Aralik {
  const sonSatir = Math.max(0, b.satir - 1);
  const sonSutun = Math.max(0, b.sutun - 1);
  if (s.mod === "sutun") {
    return { r0: 0, r1: sonSatir, c0: Math.min(s.anchor.c, s.focus.c), c1: Math.max(s.anchor.c, s.focus.c), baslik: true };
  }
  if (s.mod === "satir") {
    return { r0: Math.min(s.anchor.r, s.focus.r), r1: Math.max(s.anchor.r, s.focus.r), c0: 0, c1: sonSutun, baslik: false };
  }
  return {
    r0: Math.max(0, Math.min(s.anchor.r, s.focus.r)),
    r1: Math.max(0, Math.max(s.anchor.r, s.focus.r)),
    c0: Math.min(s.anchor.c, s.focus.c),
    c1: Math.max(s.anchor.c, s.focus.c),
    baslik: false,
  };
}

/** Eski ad: yalnız gövde aralığı. */
export const normalize = (s: GridSecim, b: Boyut = { satir: Number.MAX_SAFE_INTEGER, sutun: Number.MAX_SAFE_INTEGER }) => aralik(s, b);

/** Bir hücre (başlık için `r === -1`) seçili mi. */
export function icinde(s: GridSecim, r: number, c: number, b: Boyut): boolean {
  const a = aralik(s, b);
  if (r === -1) return a.baslik && c >= a.c0 && c <= a.c1;
  return r >= a.r0 && r <= a.r1 && c >= a.c0 && c <= a.c1;
}

/** Seçili gövde hücresi sayısı — "12 hücre kopyalandı" gibi bildirimler için. */
export function hucreSayisi(s: GridSecim, b: Boyut): number {
  const a = aralik(s, b);
  return (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
}

/** Tek hücre mi seçili. */
export const tekMi = (s: GridSecim): boolean => s.mod === "hucre" && s.anchor.r === s.focus.r && s.anchor.c === s.focus.c;

/** Odağı doğrudan bir hücreye koyar; başlık satırı sütunu seçer. */
export function odakla(r: number, c: number, b: Boyut): GridSecim {
  if (r < 0) return sutunSecimi(c, b);
  return tekSecim(kis(r, 0, b.satir - 1), kis(c, 0, b.sutun - 1));
}

/** Odağı taşır; anchor da gelir, yani aralık tek hücreye iner. İlk satırdan yukarısı başlık. */
export function tasi(s: GridSecim, dr: number, dc: number, b: Boyut): GridSecim {
  const r = kis(s.focus.r + dr, -1, b.satir - 1);
  const c = kis(s.focus.c + dc, 0, b.sutun - 1);
  return odakla(r, c, b);
}

/** Odağı taşır, anchor yerinde kalır: `Shift`+ok. Kip korunur. */
export function genislet(s: GridSecim, dr: number, dc: number, b: Boyut): GridSecim {
  if (s.mod === "sutun") return { ...s, focus: hucre(-1, kis(s.focus.c + dc, 0, b.sutun - 1)) };
  if (s.mod === "satir") return { ...s, focus: hucre(kis(s.focus.r + dr, 0, b.satir - 1), 0) };
  return { anchor: s.anchor, focus: hucre(kis(s.focus.r + dr, 0, b.satir - 1), kis(s.focus.c + dc, 0, b.sutun - 1)), mod: "hucre" };
}

/** Odağı bir hücreye uzatır, anchor sabit — `Shift`+tık ve sürükleyerek seçmek. */
export function genisletTo(s: GridSecim, r: number, c: number, b: Boyut): GridSecim {
  if (s.mod === "sutun") return { ...s, focus: hucre(-1, kis(c, 0, b.sutun - 1)) };
  if (s.mod === "satir") return { ...s, focus: hucre(kis(r, 0, b.satir - 1), 0) };
  return { anchor: s.anchor, focus: hucre(kis(r, 0, b.satir - 1), kis(c, 0, b.sutun - 1)), mod: "hucre" };
}

/**
 * `Ctrl`+ok — bloğun ucuna atla.
 *
 * Excel'in kuralı: bulunduğun hücre doluysa o dolu bloğun son hücresine;
 * boşsa o yöndeki ilk dolu hücreye; hiçbiri yoksa kenara.
 */
export function blokSonu(rows: string[][], r: number, c: number, dr: number, dc: number, b: Boyut): Hucre {
  const dolu = (rr: number, cc: number) => {
    if (rr < 0 || rr >= b.satir || cc < 0 || cc >= b.sutun) return false;
    return (rows[rr]?.[cc] ?? "").trim() !== "";
  };
  const son = { r: kis(r, 0, b.satir - 1), c: kis(c, 0, b.sutun - 1) };
  let rr = son.r;
  let cc = son.c;
  const ilerle = () => {
    const nr = rr + dr;
    const nc = cc + dc;
    if (nr < 0 || nr >= b.satir || nc < 0 || nc >= b.sutun) return false;
    rr = nr;
    cc = nc;
    return true;
  };

  if (dolu(son.r, son.c) && dolu(son.r + dr, son.c + dc)) {
    // Dolu bloğun sonuna kadar yürü.
    while (dolu(rr + dr, cc + dc)) if (!ilerle()) break;
    return hucre(rr, cc);
  }
  // Sonraki dolu hücreyi ara; yoksa kenara git.
  while (ilerle()) if (dolu(rr, cc)) return hucre(rr, cc);
  return hucre(rr, cc);
}

/** Bir aralığı seçime çevirir — yapıştırılan bloğu seçili bırakmak için. */
export function araliktan(a: { r0: number; c0: number; r1: number; c1: number }, b: Boyut): GridSecim {
  return {
    anchor: hucre(kis(a.r0, 0, b.satir - 1), kis(a.c0, 0, b.sutun - 1)),
    focus: hucre(kis(a.r1, 0, b.satir - 1), kis(a.c1, 0, b.sutun - 1)),
    mod: "hucre",
  };
}

/**
 * Satırlar silindikten sonra seçimi doğru yerde tutar.
 *
 * Silinen bir satırın üstünde kalan seçim yerinde kalmalı, altındaki yukarı
 * kaymalı; bu olmadan "sil" komutundan sonra odak alâkasız bir hücreye
 * düşüyor ve bir sonraki tuş yanlış satırı düzenliyor.
 */
export function satirlarSilindi(s: GridSecim, silinen: number[], b: Boyut): GridSecim {
  const sirali = [...silinen].sort((a, x) => a - x);
  const kaydir = (r: number) => {
    if (r < 0) return r;
    let k = 0;
    for (const i of sirali) if (i < r) k++;
    return r - k;
  };
  const yeniBoyut: Boyut = { satir: Math.max(1, b.satir - sirali.length), sutun: b.sutun };
  if (s.focus.r < 0) return sutunSecimi(s.focus.c, yeniBoyut);
  return odakla(kaydir(s.focus.r), s.focus.c, yeniBoyut);
}

/** `at` konumuna `n` satır eklendikten sonra seçim. */
export function satirlarEklendi(s: GridSecim, at: number, n: number, b: Boyut): GridSecim {
  const kaydir = (r: number) => (r < 0 ? r : r >= at ? r + n : r);
  const yeniBoyut: Boyut = { satir: b.satir + n, sutun: b.sutun };
  return {
    anchor: hucre(kis(kaydir(s.anchor.r), -1, yeniBoyut.satir - 1), s.anchor.c),
    focus: hucre(kis(kaydir(s.focus.r), -1, yeniBoyut.satir - 1), s.focus.c),
    mod: s.mod,
  };
}

/** Bir satır taşındıktan sonra seçim onunla birlikte gider. */
export function satirTasindi(s: GridSecim, from: number, to: number, b: Boyut): GridSecim {
  const yeni = (r: number) => {
    if (r < 0) return r;
    if (r === from) return to;
    if (from < r && r <= to) return r - 1;
    if (to <= r && r < from) return r + 1;
    return r;
  };
  return {
    anchor: hucre(kis(yeni(s.anchor.r), -1, b.satir - 1), s.anchor.c),
    focus: hucre(kis(yeni(s.focus.r), -1, b.satir - 1), s.focus.c),
    mod: s.mod,
  };
}

/** Seçimi tablo sınırlarına sığdırır — tür değişince sütun sayısı düşebiliyor. */
export function sigdir(s: GridSecim, b: Boyut): GridSecim {
  return {
    anchor: hucre(kis(s.anchor.r, -1, b.satir - 1), kis(s.anchor.c, 0, b.sutun - 1)),
    focus: hucre(kis(s.focus.r, -1, b.satir - 1), kis(s.focus.c, 0, b.sutun - 1)),
    mod: s.mod,
  };
}
