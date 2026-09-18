/**
 * Türkiye'nin 81 ilinin sınırlarını tek bir sadeleştirilmiş TopoJSON'a çevirir.
 *
 *   node scripts/gen-tr-il.mjs   →  src/lib/tr-il.json
 *
 * Kaynak Natural Earth 10m admin-1 (kamu malı, world-atlas'ın ülke sınırlarıyla
 * aynı aile — iki harita yan yana konduğunda kıyılar birbirini tutuyor).
 * Betik elle çalıştırılır ve çıktısı depoya işlenir: derleme ağ istemez, tek
 * dosyalık çıktı çevrimdışı kalır.
 *
 * Geometri kimliği **plaka kodu** ("34"), adı Türkçe yazımıyla aşağıdaki
 * tablodan geliyor — Natural Earth'ün kendi adları aksansız ve birkaçı hatalı
 * ("Kinkkale", "Zinguldak"), onlara güvenilmiyor.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { topology } from "topojson-server";
import { quantize } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";

const KAYNAK =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";

/**
 * Sadeleştirme eşiği (sterad). Kart üzerinde bir il en fazla birkaç yüz piksel
 * geniş; bu eşik kıyı kıvrımlarını okunur bırakıp dosyayı beşte birine indiriyor.
 */
const ESIK = 1e-5;

/** Koordinat ızgarası. 1e4 ≈ 4 m — ilçe değil il çiziyoruz. */
const IZGARA = 1e4;

/** Plaka kodu → Türkçe il adı. */
const ILLER = {
  "01": "Adana",
  "02": "Adıyaman",
  "03": "Afyonkarahisar",
  "04": "Ağrı",
  "05": "Amasya",
  "06": "Ankara",
  "07": "Antalya",
  "08": "Artvin",
  "09": "Aydın",
  10: "Balıkesir",
  11: "Bilecik",
  12: "Bingöl",
  13: "Bitlis",
  14: "Bolu",
  15: "Burdur",
  16: "Bursa",
  17: "Çanakkale",
  18: "Çankırı",
  19: "Çorum",
  20: "Denizli",
  21: "Diyarbakır",
  22: "Edirne",
  23: "Elazığ",
  24: "Erzincan",
  25: "Erzurum",
  26: "Eskişehir",
  27: "Gaziantep",
  28: "Giresun",
  29: "Gümüşhane",
  30: "Hakkâri",
  31: "Hatay",
  32: "Isparta",
  33: "Mersin",
  34: "İstanbul",
  35: "İzmir",
  36: "Kars",
  37: "Kastamonu",
  38: "Kayseri",
  39: "Kırklareli",
  40: "Kırşehir",
  41: "Kocaeli",
  42: "Konya",
  43: "Kütahya",
  44: "Malatya",
  45: "Manisa",
  46: "Kahramanmaraş",
  47: "Mardin",
  48: "Muğla",
  49: "Muş",
  50: "Nevşehir",
  51: "Niğde",
  52: "Ordu",
  53: "Rize",
  54: "Sakarya",
  55: "Samsun",
  56: "Siirt",
  57: "Sinop",
  58: "Sivas",
  59: "Tekirdağ",
  60: "Tokat",
  61: "Trabzon",
  62: "Tunceli",
  63: "Şanlıurfa",
  64: "Uşak",
  65: "Van",
  66: "Yozgat",
  67: "Zonguldak",
  68: "Aksaray",
  69: "Bayburt",
  70: "Karaman",
  71: "Kırıkkale",
  72: "Batman",
  73: "Şırnak",
  74: "Bartın",
  75: "Ardahan",
  76: "Iğdır",
  77: "Yalova",
  78: "Karabük",
  79: "Kilis",
  80: "Osmaniye",
  81: "Düzce",
};

const ham = await (await fetch(KAYNAK)).json();

const iller = [];
for (const f of ham.features) {
  if (f.properties.adm0_a3 !== "TUR") continue;
  const kod = String(f.properties.iso_3166_2 ?? "").split("-")[1];
  const ad = ILLER[kod];
  if (!ad) throw new Error(`Tanınmayan plaka kodu: ${f.properties.iso_3166_2} (${f.properties.name})`);
  iller.push({ type: "Feature", id: kod, properties: { name: ad }, geometry: f.geometry });
}

if (iller.length !== 81) throw new Error(`81 il bekleniyordu, ${iller.length} bulundu.`);
const eksik = Object.keys(ILLER).filter((k) => !iller.some((i) => i.id === k));
if (eksik.length) throw new Error(`Kaynakta bulunamayan iller: ${eksik.join(", ")}`);

const topo = quantize(simplify(presimplify(topology({ iller: { type: "FeatureCollection", features: iller } }, 1e5)), ESIK), IZGARA);

const cikti = fileURLToPath(new URL("../src/lib/tr-il.json", import.meta.url));
const metin = JSON.stringify(topo);
writeFileSync(cikti, metin);
console.log(`${iller.length} il yazıldı → src/lib/tr-il.json (${Math.round(metin.length / 1024)} KB)`);
