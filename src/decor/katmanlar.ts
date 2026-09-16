/**
 * Katman ağacı — listenin gördüğü şey.
 *
 * Kart tek bir çerçeve; içindekiler tepeden aşağı, **önde duran en üstte**
 * okunur. Depolama bunu böyle tutmuyor: `nesneler` dipten tepeye sıralı iki
 * yığın (`arka`, sonra `on`) ve gruplar ayrı bir ağaç değil, üyelerin taşıdığı
 * bir etiket. Bu dosya iki yönü de çeviriyor — panel depolama biçimini hiç
 * bilmiyor, model de panelin ağacını.
 *
 * Kartın kendi parçaları (başlık, grafik, dipnot) listede **sabit bir şerit**:
 * süslemenin "ön" yarısı ile "arka" yarısını ayıran şey onlar. Bir satırı
 * şeridin üstüne bırakmak katmanı `on`, altına bırakmak `arka` yapıyor —
 * yani katman ayrı bir düğme değil, listedeki yer.
 */
import type { DecorItem, DecorSlot, DecorState, SlotKey } from "./model";
import { SLOT_LABELS } from "./model";
import { getAsset } from "./registry";
import type { ZeminSlot } from "./types";

/** Metin taşıyan varlıklarda satırlar: gerçek satır sonu ya da eski `|`. */
const SATIR_AYRACI = /[\r\n|]+/;

/** Şeritteki kart parçaları, karttaki çizim sırasıyla. */
export const BANT_PARCALARI: SlotKey[] = ["baslik", "grafik", "dipnot"];

export type KatmanSatir =
  | { id: string; tur: "parca"; key: SlotKey; ad: string; gizli: boolean; derinlik: 0 }
  | {
      id: string;
      tur: "grup";
      grup: string;
      ad: string;
      uyeler: DecorItem[];
      kapali: boolean;
      gizli: boolean;
      kilit: boolean;
      derinlik: 0;
    }
  | { id: string; tur: "nesne"; item: DecorItem; ad: string; derinlik: 0 | 1 }
  | { id: string; tur: "zemin"; slot: ZeminSlot; ad: string; veri: DecorSlot; derinlik: 0 };

/** Bir satırın `zincir` üzerindeki karşılığı: [bas, son). Grup başlığı boş aralık. */
export interface SatirAralik {
  bas: number;
  son: number;
}

export interface Zincir {
  /** Tepeden dibe bütün nesneler — kapalı grupların üyeleri dâhil. */
  yapraklar: DecorItem[];
  /** Kart parçalarının şeridi `yapraklar` içinde hangi indise denk geliyor. */
  bant: number;
}

export interface Katmanlar {
  satirlar: KatmanSatir[];
  /** Satır indisi → `zincir.yapraklar` aralığı. Sürükleme hesabı bunu okuyor. */
  araliklar: SatirAralik[];
  zincir: Zincir;
  /** Şeridin kapladığı satır aralığı: bu satırlar taşınmaz. */
  bantSatirlari: { bas: number; son: number };
}

const ZEMIN_SIRASI: { slot: ZeminSlot; ad: string }[] = [
  { slot: "cerceve", ad: "Çerçeve" },
  { slot: "doku", ad: "Doku" },
  { slot: "isik", ad: "Işık" },
];

/**
 * Bir nesnenin listede görünen adı.
 *
 * Kullanıcı ad vermediyse varlığın etiketi; metin taşıyan varlıklarda ise
 * yazının ilk satırı. Yan yana duran beş "Metin" satırı arasından aradığınızı
 * bulmak mümkün değil — Figma da metin katmanını içeriğiyle adlandırıyor.
 */
export function nesneAdi(item: DecorItem): string {
  if (item.ad) return item.ad;
  const def = getAsset(item.asset);
  if (def?.duzenle) {
    const ham = item.params[def.duzenle];
    if (typeof ham === "string") {
      const ilk = ham
        .split(SATIR_AYRACI)
        .map((x) => x.trim())
        .find(Boolean);
      if (ilk) return ilk.length > 40 ? `${ilk.slice(0, 40)}…` : ilk;
    }
  }
  return def?.label || item.asset;
}

/** Bir grubun listede görünen adı. */
export function grupAdi(decor: DecorState, grup: string): string {
  return decor.gruplar[grup]?.ad || "Grup";
}

/**
 * Yığını ağaca çevirir.
 *
 * `kapali` yalnız panelin kendi hâli — dosyaya yazılmıyor, geri alınmıyor.
 * Bir grubu kapatmak işin değil bakışın değişmesi.
 */
export function katmanAgaci(
  decor: DecorState,
  yerlesimGizli: SlotKey[],
  kapali: ReadonlySet<string>,
  filtre = ""
): Katmanlar {
  const q = filtre.trim().toLocaleLowerCase("tr");
  const eslesir = (ad: string) => !q || ad.toLocaleLowerCase("tr").includes(q);

  // Tepeden dibe: önce "on", sonra şerit, sonra "arka". Her yarı kendi içinde
  // ters çevriliyor çünkü depoda dipten tepeye duruyorlar.
  const on = decor.nesneler.filter((n) => n.katman === "on").reverse();
  const arka = decor.nesneler.filter((n) => n.katman === "arka").reverse();

  const satirlar: KatmanSatir[] = [];
  const araliklar: SatirAralik[] = [];
  const yapraklar: DecorItem[] = [];

  const ekle = (s: KatmanSatir, bas: number, son: number) => {
    satirlar.push(s);
    araliklar.push({ bas, son });
  };

  /** Bir yarıyı satırlara açar; bitişik aynı etiketli nesneler bir grup satırı olur. */
  const yariyiAc = (liste: DecorItem[]) => {
    let i = 0;
    while (i < liste.length) {
      const n = liste[i];
      if (!n.grup) {
        const bas = yapraklar.length;
        yapraklar.push(n);
        if (eslesir(nesneAdi(n))) {
          ekle({ id: `n:${n.id}`, tur: "nesne", item: n, ad: nesneAdi(n), derinlik: 0 }, bas, bas + 1);
        }
        i += 1;
        continue;
      }
      let j = i;
      while (j < liste.length && liste[j].grup === n.grup) j += 1;
      const uyeler = liste.slice(i, j);
      const bas = yapraklar.length;
      yapraklar.push(...uyeler);
      const ad = grupAdi(decor, n.grup);
      const acik = !kapali.has(n.grup);
      // Arama grubun adını tutmuyorsa üyelerine bakılır; tutan bir üye varsa
      // grup açık gösterilir, hiç yoksa grup satırı hiç çizilmez.
      const uyeEslesme = uyeler.filter((u) => eslesir(nesneAdi(u)));
      const grupEslesti = eslesir(ad);
      if (!grupEslesti && uyeEslesme.length === 0) {
        i = j;
        continue;
      }
      ekle(
        {
          id: `g:${n.grup}`,
          tur: "grup",
          grup: n.grup,
          ad,
          uyeler,
          kapali: !acik,
          gizli: uyeler.every((u) => u.gizli),
          kilit: uyeler.every((u) => u.kilit),
          derinlik: 0,
        },
        bas,
        bas // Başlık kendi başına yer tutmaz: çocukları zaten sırada.
      );
      if (acik || q) {
        const gorunen = q && !grupEslesti ? uyeEslesme : uyeler;
        for (const u of gorunen) {
          const k = bas + uyeler.indexOf(u);
          ekle({ id: `n:${u.id}`, tur: "nesne", item: u, ad: nesneAdi(u), derinlik: 1 }, k, k + 1);
        }
      }
      i = j;
    }
  };

  yariyiAc(on);

  const bant = yapraklar.length;
  const bantBas = satirlar.length;
  for (const key of BANT_PARCALARI) {
    const ad = SLOT_LABELS[key];
    if (!eslesir(ad)) continue;
    ekle({ id: `p:${key}`, tur: "parca", key, ad, gizli: yerlesimGizli.includes(key), derinlik: 0 }, bant, bant);
  }
  const bantSon = satirlar.length;

  yariyiAc(arka);

  for (const z of ZEMIN_SIRASI) {
    const veri = decor.zemin[z.slot];
    if (!veri) continue;
    const varlik = getAsset(veri.asset)?.label ?? z.ad;
    if (!eslesir(varlik) && !eslesir(z.ad)) continue;
    ekle(
      { id: `z:${z.slot}`, tur: "zemin", slot: z.slot, ad: `${z.ad} · ${varlik}`, veri, derinlik: 0 },
      yapraklar.length,
      yapraklar.length
    );
  }

  return { satirlar, araliklar, zincir: { yapraklar, bant }, bantSatirlari: { bas: bantBas, son: bantSon } };
}

/** Satırın taşınabilirliği — kart parçaları ve zemin yuvaları yerinde durur. */
export function tasinabilir(s: KatmanSatir): boolean {
  return s.tur === "nesne" || s.tur === "grup";
}

/**
 * Bir satırı `bosluk` numaralı aralığa bırakır ve yeni `DecorState` üretir.
 *
 * `bosluk`, `satirlar` dizisindeki boşluk indisi: 0 en üst, `satirlar.length`
 * en alt. Şeridin *içine* düşen bir bırakma en yakın kenara çekiliyor —
 * başlıkla dipnot arasına süsleme sokmanın anlamı yok, ikisi de aynı katmanda.
 */
export function katmanTasi(decor: DecorState, k: Katmanlar, kaynak: number, bosluk: number): DecorState {
  const satir = k.satirlar[kaynak];
  if (!satir || !tasinabilir(satir)) return decor;

  const hedefBosluk = bandinDisina(k, bosluk);
  const aralik = k.araliklar[kaynak];
  // Kapalı bir grup başlığının aralığı boş; üyeleri satırın kendisinden gelir.
  const birimler = satir.tur === "grup" ? satir.uyeler : k.zincir.yapraklar.slice(aralik.bas, aralik.son);
  if (birimler.length === 0) return decor;
  const tasinanIds = new Set(birimler.map((n) => n.id));

  const hedefGrup = satir.tur === "grup" ? null : boslugunGrubu(k, hedefBosluk, tasinanIds);

  // Şerit bir işaretçi, bir yaprak değil: aynı diziye konuyor ki "şeridin üstü
  // mü altı mı" sorusu taşıma sırasında kaymasın.
  type Eleman = { tip: "yaprak"; item: DecorItem } | { tip: "bant" };
  const liste: Eleman[] = [];
  k.zincir.yapraklar.forEach((item, i) => {
    if (i === k.zincir.bant) liste.push({ tip: "bant" });
    liste.push({ tip: "yaprak", item });
  });
  if (k.zincir.bant >= k.zincir.yapraklar.length) liste.push({ tip: "bant" });

  const hedefIndeks = boslugunZinciri(k, hedefBosluk);
  const nokta0 = hedefIndeks + (hedefIndeks >= k.zincir.bant ? 1 : 0);
  const kalan = liste.filter((e) => e.tip === "bant" || !tasinanIds.has(e.item.id));
  const dusen = liste.slice(0, nokta0).filter((e) => e.tip === "yaprak" && tasinanIds.has(e.item.id)).length;
  const nokta = Math.max(0, Math.min(kalan.length, nokta0 - dusen));

  const yeni: Eleman[] = [
    ...kalan.slice(0, nokta),
    ...birimler.map((item) => ({ tip: "yaprak" as const, item })),
    ...kalan.slice(nokta),
  ];

  // Şeridin hangi tarafına düştüğü katmanı, üstündeki satırın etiketi grubu belirler.
  const bantYeri = yeni.findIndex((e) => e.tip === "bant");
  const on: DecorItem[] = [];
  const arka: DecorItem[] = [];
  yeni.forEach((e, i) => {
    if (e.tip === "bant") return;
    const tasindi = tasinanIds.has(e.item.id);
    const it = tasindi && hedefGrup !== null ? { ...e.item, grup: hedefGrup } : e.item;
    (i < bantYeri ? on : arka).push(tasindi ? { ...it, katman: i < bantYeri ? "on" : "arka" } : it);
  });

  return {
    ...decor,
    // Depo dipten tepeye: önce arka yığını, sonra ön yığını.
    nesneler: [...arka.reverse(), ...on.reverse()],
  };
}

/** Şeridin içine düşen bırakmayı en yakın kenara çeker. */
function bandinDisina(k: Katmanlar, bosluk: number): number {
  const { bas, son } = k.bantSatirlari;
  if (son <= bas || bosluk <= bas || bosluk >= son) return bosluk;
  return bosluk - bas <= son - bosluk ? bas : son;
}

/** Boşluğun `zincir.yapraklar` üzerindeki karşılığı. */
function boslugunZinciri(k: Katmanlar, bosluk: number): number {
  if (bosluk >= k.satirlar.length) return k.zincir.yapraklar.length;
  return k.araliklar[bosluk].bas;
}

/**
 * Bırakılan nesnenin hangi gruba yazılacağı.
 *
 * Kural tek cümle: **üstündeki satır neredeyse oraya girer.** Grup başlığının
 * hemen altı grubun ilk çocuğu, son üyesinin hemen altı da hâlâ grubun içi.
 * Taşınan nesnenin kendi satırları hesaba katılmıyor — bir üyeyi kendi
 * grubunun bir altına bırakmak onu gruptan çıkarmamalı.
 */
function boslugunGrubu(k: Katmanlar, bosluk: number, tasinan: ReadonlySet<string>): string {
  for (let i = bosluk - 1; i >= 0; i--) {
    const ust = k.satirlar[i];
    if (ust.tur === "nesne") {
      if (tasinan.has(ust.item.id)) continue;
      return ust.item.grup;
    }
    if (ust.tur === "grup") return ust.kapali ? "" : ust.grup;
    return "";
  }
  return "";
}
