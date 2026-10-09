/**
 * Sahnede, panelde ve klavyede aynı anlamı taşıyan sıra eylemleri: bir öğeyi
 * belli bir yere, bir adım öne/arkaya ya da uca taşımak; kardeşe geçmek;
 * vurgulamak. Sürükleme de buradan geçiyor — "nereye bırakıldı" sorusunun
 * cevabı yüzeye göre değişiyor, "bırakınca ne olur" değişmiyor.
 *
 * Sankey'de düğüm yalnız kendi sütununda yer değiştirir: sütun bağlantı
 * yapısından geliyor, sıra ancak sütun içindeki dikey düzeni belirleyebilir.
 */
import { sankeySutunlari } from "@/ext/sankey-fit";

import { toSankey } from "./adapters";
import { adimHedefi, altKumedeTasi, gorunenSira, siraTasi, siraUygula, type SiraBoyutu } from "./sira";
import type { ChartSpec } from "./spec";

export interface OgeSecimi {
  boyut: SiraBoyutu;
  anahtarlar: string[];
  /** Hiyerarşi yaprağında grup. */
  grup?: string;
}

const sankeyDugumu = (spec: ChartSpec, boyut: SiraBoyutu) => spec.kind === "sankey" && boyut === "oge";

/**
 * Bir öğenin yer değiştirebileceği liste, görünen sırada: yaprakta kendi
 * grubu, sankey düğümünde kendi sütunu, diğerlerinde boyutun tamamı.
 *
 * `olculen`: sankey "Otomatik"te sahnede ölçülen sıra (`sahnedekiSira`).
 */
export function kardesler(
  spec: ChartSpec,
  boyut: SiraBoyutu,
  anahtar: string,
  grup?: string,
  olculen?: readonly string[]
): string[] {
  const ogeler = gorunenSira(spec, boyut, olculen);
  if (boyut === "alt") return ogeler.filter((o) => o.grup === grup).map((o) => o.anahtar);
  const liste = ogeler.map((o) => o.anahtar);
  if (!sankeyDugumu(spec, boyut)) return liste;
  const sutun = sankeySutunlari(toSankey(spec).data);
  return liste.filter((k) => sutun.get(k) === sutun.get(anahtar));
}

/** Sankey sütunu dahil her listede: `hedef`, kardeş listesinden taşınanlar çıkınca kalanların indeksi. */
export function ogeyiTasi(spec: ChartSpec, s: OgeSecimi, hedef: number, olculen?: readonly string[]): ChartSpec {
  if (sankeyDugumu(spec, s.boyut)) {
    const anahtar = s.anahtarlar[0];
    const kume = kardesler(spec, "oge", anahtar, undefined, olculen);
    return siraUygula(spec, "oge", (g) => altKumedeTasi(g, kume, anahtar, hedef), { olculen });
  }
  return siraTasi(spec, s.boyut, s.anahtarlar, hedef, { grup: s.grup, olculen });
}

/** Klavye ve menü: bir adım (`yon`) ya da uca (`uca`). */
export function adimla(spec: ChartSpec, s: OgeSecimi, yon: -1 | 1, uca: boolean, olculen?: readonly string[]): ChartSpec {
  const ilk = s.anahtarlar[0];
  if (ilk == null) return spec;
  // Sankey'de blok taşıma yok: seçili düğümler farklı sütunlarda olabilir.
  const tasinan = sankeyDugumu(spec, s.boyut) ? [ilk] : s.anahtarlar;
  const liste = kardesler(spec, s.boyut, ilk, s.grup, olculen);
  return ogeyiTasi(spec, { ...s, anahtarlar: tasinan }, adimHedefi(liste, tasinan, yon, uca), olculen);
}

/** `Tab` / `Shift+Tab`: boyutta sonraki ya da önceki öğe, uçtan başa döner. */
export function komsu(spec: ChartSpec, s: OgeSecimi, yon: -1 | 1, olculen?: readonly string[]): string | null {
  const ogeler = gorunenSira(spec, s.boyut, olculen);
  const liste = (s.boyut === "alt" ? ogeler.filter((o) => o.grup === s.grup) : ogeler).map((o) => o.anahtar);
  if (liste.length === 0) return null;
  const simdi = liste.indexOf(yon > 0 ? s.anahtarlar[s.anahtarlar.length - 1] : s.anahtarlar[0]);
  return liste[(simdi + yon + liste.length) % liste.length];
}

/** Vurgu yalnız çubukta çiziliyor (bkz. `bar.tsx` `highlightCategories`). */
export const vurguDestekli = (spec: ChartSpec) => spec.kind === "bar" || spec.kind === "barH";

/**
 * Bir kategoriyi vurgulamak. Düz: yalnız o (zaten tek vurguluysa vurgu
 * kalkar); `ekle`: listeye ekler ya da çıkarır.
 */
export function vurguDegistir(spec: ChartSpec, kategori: string, ekle: boolean): ChartSpec {
  const h = spec.options.highlight;
  const var_ = h.includes(kategori);
  const next = ekle ? (var_ ? h.filter((x) => x !== kategori) : [...h, kategori]) : var_ && h.length === 1 ? [] : [kategori];
  return { ...spec, options: { ...spec.options, highlight: next } };
}
