/**
 * Sankey'in kenar boşluğunu etiketlere göre çözen iki geçişli yerleşim.
 *
 * Sorun döngüsel: dış etiketler düğümlerin soluna ve sağına yazılıyor, yani
 * gereken boşluk düğümün `x0`/`x1`'ine bağlı; ama `x0`/`x1` yerleşimden,
 * yerleşim de boşluktan geliyor. Kaba bir tahminle tek geçiş yapmak, orta
 * ("landing") düğümlerin etiketini hiç saymamak demekti — `ChartCard` yalnız
 * `source` ve `outcome` düğümlerini ölçüyordu, oysa `sankey-node` etiketi
 * düğüm çizim alanının hangi yarısındaysa o yana yazıyor.
 *
 * Çözüm, yerleşimi **kâğıt üzerinde** iki kez koşturmak: önce kaba boşlukla,
 * sonra çıkan gerçek `x0`/`x1` ile. `d3-sankey` zaten bağımlılık ve hesap saf
 * matematik — 50 düğümde mikrosaniye, `useMemo` ile veri değişmedikçe hiç
 * koşmuyor.
 *
 * Dikey boşluk döngüsel değil, ama o da ölçülüyor: değer etiketi düğüm
 * merkezinden **aşağı** yazıldığı için alt boşluk üstten büyük olmak zorunda.
 * Eskiden ikisi de sabit 8 px'ti ve en alttaki küçük düğümün değeri çizim
 * alanının dışına düşüyordu.
 */
import { sankey, sankeyCenter } from "d3-sankey";

import type { SankeyData } from "@/charts/sankey";
import { AD_KALINLIK, AD_PUNTO, DEGER_KALINLIK, DEGER_PUNTO, LABEL_OFFSET, VALUE_LABEL_GAP } from "@/charts/sankey";
import { enGenis, olcMetin, olcSatir } from "@/lib/olcu";

export interface SankeyKenar {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Yatay boşluğun tavanı: kartın dörtte biri, ama en az 16 px. */
const TAVAN_ORAN = 0.25;

/**
 * Bir düğümün dış etiketinin genişliği.
 *
 * Ad ve değer **alt alta** duruyor, yan yana değil — gereken genişlik toplam
 * değil maksimum. `ChartCard`'ın eski formülü yalnız adı sayıyor ve onu da
 * karakter × 7,5 ile tahmin ediyordu; "1.234.567 oturum" gibi bir değer
 * satırı 40 piksel taşabiliyordu.
 */
function etiketGenisligi(ad: string, deger: string | null): number {
  const adW = olcMetin(ad, AD_PUNTO, AD_KALINLIK);
  const degerW = deger ? olcMetin(deger, DEGER_PUNTO, DEGER_KALINLIK) : 0;
  return LABEL_OFFSET + Math.max(adW, degerW) + 2;
}

export interface SankeyOlcuGirdi {
  data: SankeyData;
  width: number;
  height: number;
  nodeWidth: number;
  nodePadding: number;
  /** Değer etiketleri açık mı. */
  degerEtiketleri: boolean;
  /** Düğüm indeksinden çizilen değer metnine — `null` ise değer yazılmıyor. */
  degerMetni: (i: number) => string | null;
}

/** Dikey boşluk: ad satırının çıkıntısı üstte, değer satırının inişi altta. */
function dikeyKenar(degerEtiketleri: boolean): { top: number; bottom: number } {
  const ad = olcSatir(AD_PUNTO, AD_KALINLIK);
  const deger = olcSatir(DEGER_PUNTO, DEGER_KALINLIK);
  // Etiketler `dy="0.35em"` ile çiziliyor, yani taban çizgisi merkezden
  // 0.35em aşağıda.
  const ust = Math.max(8, Math.ceil(ad.cik - 0.35 * AD_PUNTO) + 1);
  const alt = degerEtiketleri
    ? Math.max(8, Math.ceil(VALUE_LABEL_GAP + 0.35 * DEGER_PUNTO + deger.in) + 1)
    : Math.max(8, Math.ceil(0.35 * AD_PUNTO + ad.in) + 1);
  return { top: ust, bottom: alt };
}

/**
 * Etiketlerin gerçekten sığdığı kenar boşluğu.
 *
 * İlk geçiş kaba bir yatay boşlukla yerleşimi kuruyor, ikinci geçiş çıkan
 * `x0`/`x1` ile her düğümün hangi yana yazılacağını öğrenip gerçek gereksinimi
 * topluyor. `sankey-node` kuralı: `x0 < innerWidth / 2` ise sola, değilse sağa.
 */
export function sankeyKenari(g: SankeyOlcuGirdi): SankeyKenar {
  const { top, bottom } = dikeyKenar(g.degerEtiketleri);
  const tavan = Math.max(16, g.width * TAVAN_ORAN);
  const kis = (v: number) => Math.min(tavan, Math.max(16, Math.ceil(v)));

  const etiketler = g.data.nodes.map((n, i) => etiketGenisligi(n.name, g.degerEtiketleri ? g.degerMetni(i) : null));
  if (etiketler.length === 0) return { top, bottom, left: 16, right: 16 };

  // 1. geçiş — kaba: uçtaki düğümler kendi etiketlerini tam taşısın.
  const uclar = g.data.nodes.map((n, i) => (n.category === "landing" ? 0 : etiketler[i]));
  let sol = kis(enGenisDizi(uclar));
  let sag = sol;

  for (let tur = 0; tur < 2; tur++) {
    const ic = g.width - sol - sag;
    const icY = g.height - top - bottom;
    if (ic <= 0 || icY <= 0) break;
    let yerlesim;
    try {
      yerlesim = sankey<{ name: string; category?: string }, { value: number }>()
        .nodeWidth(g.nodeWidth)
        .nodePadding(g.nodePadding)
        .nodeAlign(sankeyCenter)
        .extent([
          [0, 0],
          [ic, icY],
        ])({
        nodes: g.data.nodes.map((n) => ({ ...n })) as never,
        links: g.data.links.map((l) => ({ ...l })) as never,
      });
    } catch {
      // Bozuk bir grafta (döngü, kopuk düğüm) d3 atabiliyor; kaba boşlukla
      // devam etmek, hiç çizmemekten iyi.
      break;
    }
    let solGerek = 0;
    let sagGerek = 0;
    yerlesim.nodes.forEach((n, i) => {
      const x0 = n.x0 ?? 0;
      const x1 = n.x1 ?? 0;
      const w = etiketler[i];
      if (x0 < ic / 2) solGerek = Math.max(solGerek, w - x0);
      else sagGerek = Math.max(sagGerek, w - (ic - x1));
    });
    const yeniSol = kis(solGerek);
    const yeniSag = kis(sagGerek);
    if (yeniSol === sol && yeniSag === sag) break;
    sol = yeniSol;
    sag = yeniSag;
  }

  return { top, bottom, left: sol, right: sag };
}

function enGenisDizi(v: number[]): number {
  let en = 0;
  for (const x of v) if (x > en) en = x;
  return en;
}

/** Test ve ölçüm için: bir etiket listesinin en geniş adı. */
export const enGenisAd = (adlar: string[]) => enGenis(adlar, AD_PUNTO, AD_KALINLIK);

/**
 * Düğüm adı → sütunu (0'dan). Sıra panelinin sankey listesini sütun sütun
 * bölmesi ve klavyenin düğümü kendi sütununda tutması için.
 *
 * Kâğıt üstünde, sabit bir kutuyla: sütun ataması (`sankeyCenter`) yalnız
 * bağlantı yapısına bakıyor, ne kutunun ölçüsüne ne düğüm sırasına.
 */
export function sankeySutunlari(data: SankeyData): Map<string, number> {
  const sutun = new Map<string, number>();
  try {
    const yerlesim = sankey<{ name: string; category?: string }, { value: number }>()
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [1000, 1000],
      ])({
      nodes: data.nodes.map((n) => ({ ...n })) as never,
      links: data.links.map((l) => ({ ...l })) as never,
    });
    // `layer` d3-sankey 0.12'nin hizalanmış sütunu; tip paketinde yok.
    for (const n of yerlesim.nodes) sutun.set(n.name, (n as { layer?: number }).layer ?? n.depth ?? 0);
  } catch {
    // Döngülü grafta d3 atıyor; o zaman tek sütun say.
    for (const n of data.nodes) sutun.set(n.name, 0);
  }
  return sutun;
}
