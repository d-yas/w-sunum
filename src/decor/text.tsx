/**
 * Metin kutusu — kartın kendi başlık/dipnotundan bağımsız, istenen yere
 * konan çok satırlı yazı.
 *
 * Satırlara bölmeyi **biz** yapıyoruz. SVG `<text>` sarmaz, `foreignObject`
 * ise SVG çıktısını taşınmaz hâle getirirdi (Illustrator ve PowerPoint onu
 * açmıyor). O yüzden metin bir kez ölçülüp `<tspan>` satırlarına dağıtılıyor;
 * çıkan şey her yerde aynı duran, gerçek bir SVG metni.
 *
 * Ölçüm gizli bir canvas ile, kartın kendi yazı tipiyle yapılıyor. Ekran dışı
 * dışa aktarım kartı da aynı `--font-sans`'ı miras aldığı için ölçü ile çizim
 * ayrılmıyor: PNG'de taşan, ekranda taşmayan bir satır olmuyor.
 */
import { num, round, str, type AssetDef, type ParamValues } from "./types";

/** Boş satır: Chrome bomboş bir tspan'i hiç yerleştirmiyor. */
const BOSLUK_SATIRI = " ";

/** Patolojik bir metnin sayfayı kilitlememesi için üst sınır. */
const EN_COK_SATIR = 200;

const KALINLIKLAR = [
  { value: "400", label: "Normal" },
  { value: "500", label: "Orta" },
  { value: "600", label: "Yarı kalın" },
  { value: "700", label: "Kalın" },
];

/* ------------------------------------------------------------------ */
/* Ölçüm                                                                */
/* ------------------------------------------------------------------ */

let fontAilesi: string | null = null;

/** Kartın yazı tipi. Bir kez okunuyor: her kelimede okumak ölçümü boğuyor. */
function kartFontu(): string {
  if (fontAilesi) return fontAilesi;
  if (typeof document === "undefined") return "system-ui, sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
  fontAilesi = v || "system-ui, sans-serif";
  return fontAilesi;
}

let olcer: CanvasRenderingContext2D | null | undefined;
const olcuUmleri = new Map<string, number>();

function olcu(metin: string, punto: number, kalinlik: string): number {
  const anahtar = `${kalinlik}|${punto}|${metin}`;
  const hazir = olcuUmleri.get(anahtar);
  if (hazir !== undefined) return hazir;
  const kaba = metin.length * punto * 0.55;
  if (olcer === undefined) olcer = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!olcer) return kaba;
  olcer.font = `${kalinlik} ${punto}px ${kartFontu()}`;
  const w = olcer.measureText(metin).width;
  // Uzun metinlerde önbellek şişmesin; ölçüm zaten mikrosaniyelik.
  if (olcuUmleri.size > 4000) olcuUmleri.clear();
  olcuUmleri.set(anahtar, w);
  return w;
}

/** Bir satırın parçası. `bosluk`: önüne boşluk gelir mi (bölünmüş kelimede gelmez). */
interface Parca {
  s: string;
  bosluk: boolean;
}

/** Tek başına satıra sığmayan kelimeyi harf harf böler. */
function kelimeyiBol(kelime: string, en: number, punto: number, kalinlik: string): Parca[] {
  if (olcu(kelime, punto, kalinlik) <= en) return [{ s: kelime, bosluk: true }];
  const out: Parca[] = [];
  let cur = "";
  for (const ch of kelime) {
    const aday = cur + ch;
    if (cur && olcu(aday, punto, kalinlik) > en) {
      out.push({ s: cur, bosluk: out.length === 0 });
      cur = ch;
    } else {
      cur = aday;
    }
  }
  if (cur) out.push({ s: cur, bosluk: out.length === 0 });
  return out;
}

/**
 * Metni verilen genişliğe sararak satırlara böler.
 *
 * Paragraf ayracı `\n`; boş paragraf boş bir satır olarak kalıyor, çünkü
 * kullanıcı iki bloğu ayırmak için bilerek bir satır boş bırakıyor.
 */
export function sarma(yazi: string, en: number, punto: number, kalinlik: string): string[] {
  const out: string[] = [];
  for (const paragraf of yazi.split("\n")) {
    if (out.length >= EN_COK_SATIR) break;
    if (!paragraf.trim()) {
      out.push(BOSLUK_SATIRI);
      continue;
    }
    const parcalar = paragraf
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((k) => kelimeyiBol(k, en, punto, kalinlik));
    let satir = "";
    for (const t of parcalar) {
      const ayrac = satir && t.bosluk ? " " : "";
      const aday = satir + ayrac + t.s;
      if (!satir || olcu(aday, punto, kalinlik) <= en) {
        satir = aday;
        continue;
      }
      out.push(satir);
      if (out.length >= EN_COK_SATIR) return out;
      satir = t.s;
    }
    if (satir) out.push(satir);
  }
  return out.length > 0 ? out : [BOSLUK_SATIRI];
}

/* ------------------------------------------------------------------ */
/* Ölçüler — panel, sahne ve çizim aynı hesabı görsün diye tek yerde     */
/* ------------------------------------------------------------------ */

function olcular(p: ParamValues, w: number) {
  const punto = num(p, "punto", 18);
  const kalinlik = str(p, "kalinlik", "500");
  const bosluk = num(p, "bosluk", 8);
  // 1 px pay: canvas ölçüsü ile SVG yerleşimi alt-piksel ayrılabiliyor ve
  // tam sınırdaki bir satır PNG'de taşıyor.
  const en = Math.max(8, w - 2 * bosluk - 1);
  const satirlar = sarma(str(p, "yazi", ""), en, punto, kalinlik);
  const adim = punto * num(p, "satir", 1.3);
  return { punto, kalinlik, bosluk, satirlar, adim, blok: satirlar.length * adim };
}

export const TEXT: AssetDef[] = [
  {
    id: "metin/kutu",
    label: "Metin",
    family: "metin",
    kind: "nesne",
    size: { w: 260, h: 60 },
    // Yazı kartın mürekkebi, dolgu ise seri rengi: mürekkep üstüne mürekkep
    // yazan bir kutu kimsenin istediği şey değil.
    tone: "murekkep",
    tone2: "seri",
    twoTone: true,
    duzenle: "yazi",
    params: [
      { type: "metin", key: "yazi", label: "Yazı", def: "Metin", maxLength: 4000, multiline: true },
      { type: "sayi", key: "punto", label: "Punto", min: 8, max: 96, step: 1, def: 18 },
      { type: "secim", key: "kalinlik", label: "Kalınlık", options: KALINLIKLAR, def: "500" },
      {
        type: "secim",
        key: "hiza",
        label: "Hiza",
        options: [
          { value: "sol", label: "Sol" },
          { value: "orta", label: "Orta" },
          { value: "sag", label: "Sağ" },
        ],
        def: "sol",
      },
      {
        type: "secim",
        key: "dikey",
        label: "Dikey hiza",
        options: [
          { value: "ust", label: "Üst" },
          { value: "orta", label: "Orta" },
          { value: "alt", label: "Alt" },
        ],
        def: "ust",
      },
      { type: "sayi", key: "satir", label: "Satır aralığı", min: 1, max: 2, step: 0.05, def: 1.3 },
      {
        type: "secim",
        key: "dolgu",
        label: "Kutu",
        options: [
          { value: "yok", label: "Yok" },
          { value: "dolu", label: "Dolu" },
          { value: "kenar", label: "Kenar" },
        ],
        def: "yok",
      },
      { type: "sayi", key: "bosluk", label: "İç boşluk", min: 0, max: 40, step: 1, def: 8 },
      { type: "sayi", key: "kose", label: "Köşe yarıçapı", min: 0, max: 40, step: 1, def: 6 },
      {
        type: "secim",
        key: "boy",
        label: "Yükseklik",
        options: [
          { value: "otomatik", label: "Metne göre" },
          { value: "sabit", label: "Sabit" },
        ],
        def: "otomatik",
      },
    ],
    otomatikYukseklik(p, w) {
      if (str(p, "boy", "otomatik") === "sabit") return null;
      const { blok, bosluk } = olcular(p, w);
      return blok + 2 * bosluk;
    },
    render({ w, h, color, color2, p }) {
      const { punto, kalinlik, bosluk, satirlar, adim, blok } = olcular(p, w);
      const dolgu = str(p, "dolgu", "yok");
      const hiza = str(p, "hiza", "sol");
      const dikey = str(p, "dikey", "ust");
      const kose = num(p, "kose", 6);
      const y0 = dikey === "orta" ? (h - blok) / 2 : dikey === "alt" ? h - bosluk - blok : bosluk;
      const tx = hiza === "orta" ? w / 2 : hiza === "sag" ? w - bosluk : bosluk;
      const anchor = hiza === "orta" ? "middle" : hiza === "sag" ? "end" : "start";
      return (
        <>
          {dolgu !== "yok" && (
            <rect
              x={dolgu === "kenar" ? 0.75 : 0}
              y={dolgu === "kenar" ? 0.75 : 0}
              width={Math.max(0, w - (dolgu === "kenar" ? 1.5 : 0))}
              height={Math.max(0, h - (dolgu === "kenar" ? 1.5 : 0))}
              rx={round(Math.min(kose, w / 2, h / 2))}
              fill={dolgu === "dolu" ? color2 : "none"}
              stroke={dolgu === "kenar" ? color2 : undefined}
              strokeWidth={dolgu === "kenar" ? 1.5 : undefined}
            />
          )}
          <text
            fontFamily="inherit"
            fontSize={round(punto)}
            fontWeight={kalinlik}
            fill={color}
            textAnchor={anchor}
            dominantBaseline="central"
          >
            {satirlar.map((s, i) => (
              <tspan key={i} x={round(tx)} y={round(y0 + adim * (i + 0.5))}>
                {s}
              </tspan>
            ))}
          </text>
        </>
      );
    },
  },
];
