/**
 * Serbest yerleşim: kartın kendi parçalarını elle taşıma modu.
 *
 * Anahtar artık "Süsle" panelinin içinde değil, araç çubuğunda — her yerden
 * erişilebilir bir mod. Ölçüm ve aç/kapa mantığı buraya taşındı ki hem araç
 * çubuğu hem de slayt müfettişi aynı işi iki yerde yazmasın. Açık/kapalı
 * durumu yine grafiğe özel (`spec.yerlesim.serbest`), yani kaydediliyor.
 */
import { SLOT_KEYS, type Box, type SlotKey } from "@/decor/model";
import type { ChartSpec } from "@/lib/spec";

/**
 * Kartın parçalarını canlı sahneden ölçer.
 *
 * Hesaplanmıyor, ölçülüyor: başlığın yüksekliği yazı tipine, grafiğinki
 * göstergenin yerine bağlı ve tahmin etmek serbest yerleşim açıldığı anda
 * düzeni zıplatırdı. Dikdörtgenler sahnenin yakınlaştırmasına bölünüyor —
 * kartın kendisi söylüyor: çizilen genişliği bölü gerçek genişliği.
 */
export function measureSlots(width: number): Partial<Record<SlotKey, Box>> {
  const card = document.querySelector<HTMLElement>(".stage-card");
  if (!card) return {};
  const cardRect = card.getBoundingClientRect();
  const k = cardRect.width / width || 1;
  const out: Partial<Record<SlotKey, Box>> = {};
  for (const key of SLOT_KEYS) {
    const el = card.querySelector<HTMLElement>(`[data-slot="${key}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Tam piksel değil iki ondalık: akış düzeni kesirlere oturuyor ve
    // yuvarlamak serbest yerleşim açılırken her parçayı hafifçe kaydırırdı.
    const fix = (n: number) => Math.round(n * 100) / 100;
    out[key] = {
      x: fix((r.left - cardRect.left) / k),
      y: fix((r.top - cardRect.top) / k),
      w: fix(r.width / k),
      h: fix(r.height / k),
    };
  }
  return out;
}

/**
 * Modu açıp kapatır. Açarken kutular parçaların **bulunduğu yerden**
 * tohumlanıyor, böylece açmak görünürde hiçbir şeyi değiştirmiyor — yalnız
 * parçaları tutulabilir yapıyor.
 */
export function setFreeLayout(spec: ChartSpec, on: boolean): ChartSpec {
  const layout = spec.yerlesim;
  const kutular = on && Object.keys(layout.kutular).length === 0 ? measureSlots(spec.options.width) : layout.kutular;
  return { ...spec, yerlesim: { ...layout, serbest: on, kutular } };
}
