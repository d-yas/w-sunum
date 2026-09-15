/**
 * Sahnede ne seçili — ve buna bağlı olarak sağ panelin ne göstereceği.
 *
 * Tek bir seçim var, üç ayrı durum değil: eskiden karta tıklama (`selPart`),
 * süsleme seçimi (`decorSel`) ve panelde kaydırma (`focusSection`) birbirinden
 * habersiz çalışıyordu, o yüzden hangi sekmede olduğunuza göre tıklamanın
 * anlamı değişiyordu.
 *
 * Serbest yerleşim kutuları ayrı bir tür değil: `baslik` kutusu `title`,
 * `grafik` kutusu `chart` parçasıdır. Tek sözlük — yoksa aynı başlığın moda
 * göre iki kimliği olurdu.
 */
import type { SlotKey } from "@/decor/model";

/** Kartın seçilebilir parçaları. Alt parçalar (çubuk, değer etiketi…) grafiğe katlanır. */
export type KartParcasi = "title" | "subtitle" | "note" | "legend" | "axis-x" | "axis-y" | "chart";

/**
 * Süsleme seçimi bir liste: gruplamak için birden çok nesneyi aynı anda
 * seçebilmek gerekiyor, ve bir gruba tıklamak zaten grubun tamamını seçiyor.
 * Tek nesne, bir elemanlı liste.
 */
export type Secim = { tur: "slayt" } | { tur: "parca"; part: KartParcasi } | { tur: "nesne"; ids: string[] };

export const nesneSecimi = (ids: string[]): Secim => (ids.length ? { tur: "nesne", ids } : SLAYT);

export const SLAYT: Secim = { tur: "slayt" };

/**
 * Karttaki `data-part` değerini seçilebilir bir parçaya indirger.
 *
 * Çubuk, değer etiketi, referans çizgisi gibi alt parçalar grafiğin kendisini
 * seçer: seçim modeli her yerde aynı davransın diye. Bir kategoriyi vurgulamak
 * Alt+tık ile ayrı bir jest.
 */
export function parcaya(part: string | undefined): KartParcasi {
  switch (part) {
    case "title":
    case "subtitle":
    case "note":
    case "legend":
    case "axis-x":
    case "axis-y":
      return part;
    default:
      return "chart";
  }
}

/** Seçilen parçanın serbest yerleşimdeki kutusu — yoksa `null`. */
export function parcaninKutusu(part: KartParcasi): SlotKey | null {
  if (part === "title" || part === "subtitle") return "baslik";
  if (part === "note") return "dipnot";
  if (part === "chart") return "grafik";
  return null;
}

/** Kutu anahtarının temsil ettiği parça — `parcaninKutusu`'nun tersi. */
export function kutununParcasi(key: SlotKey): KartParcasi {
  return key === "baslik" ? "title" : key === "dipnot" ? "note" : "chart";
}

/** `DecorStage` sahnede hangi öğeleri seçili çizsin. */
export function sahneSecimi(s: Secim): string[] {
  if (s.tur === "nesne") return s.ids;
  if (s.tur === "parca") {
    const kutu = parcaninKutusu(s.part);
    return kutu ? [`slot:${kutu}`] : [];
  }
  return [];
}

/** Sahneden gelen seçim kimliklerini `Secim`'e çevirir. */
export function sahnedenSecim(ids: string[]): Secim {
  const ilk = ids[0];
  if (!ilk) return SLAYT;
  if (ilk.startsWith("slot:")) return { tur: "parca", part: kutununParcasi(ilk.slice(5) as SlotKey) };
  return { tur: "nesne", ids: ids.filter((id) => !id.startsWith("slot:")) };
}

/**
 * Seçime göre sağ panelde görünecek bölümler.
 *
 * Bölüm kimlikleri `Panels.tsx` ve `DecorPanel.tsx` içindeki `<Section id>`
 * değerleri; panellerin kendileri yeniden yazılmıyor, yalnız hangisinin
 * görüneceği buradan söyleniyor.
 */
export function gorunenBolumler(s: Secim): string[] {
  switch (s.tur) {
    case "slayt":
      return ["kart", "zemin", "yerlesim", "nesneler", "dekor", "bicim"];
    case "nesne":
      return s.ids.length > 1 ? ["coklu", "nesneler"] : ["secili", "nesneler"];
    case "parca":
      switch (s.part) {
        case "title":
        case "subtitle":
        case "note":
          return ["metin"];
        case "legend":
          return ["gosterge"];
        case "axis-x":
        case "axis-y":
          return ["eksenler"];
        default:
          return ["tur", "eksenler", "gosterge", "bicimlendirme", "vurgu", "etiketler", "referans", "bicim"];
      }
  }
}

/** Seçimin panel başlığında görünen adı. */
export function secimAdi(s: Secim, nesneAdi?: string): string {
  if (s.tur === "slayt") return "Slayt";
  if (s.tur === "nesne") return s.ids.length > 1 ? `${s.ids.length} nesne` : (nesneAdi ?? "Süsleme");
  const adlar: Record<KartParcasi, string> = {
    title: "Başlık",
    subtitle: "Alt başlık",
    note: "Dipnot",
    legend: "Gösterge",
    "axis-x": "X ekseni",
    "axis-y": "Y ekseni",
    chart: "Grafik",
  };
  return adlar[s.part];
}
