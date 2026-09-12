/**
 * world-atlas'ın ISO 3166-1 numeric id'lerini alpha-2 koda eşleyen tabloyu
 * üretir. Eşleme, Node'un ICU'sundaki İngilizce ülke adlarıyla Natural Earth
 * adlarının normalize edilmiş karşılaştırmasından çıkar; tutmayan avuç dolusu
 * ad aşağıdaki PATCH tablosunda elle verilir.
 *
 *   node scripts/gen-country-codes.mjs   →  src/lib/country-codes.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url)));
const geometries = topo.objects.countries.geometries;

const enNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Natural Earth kısaltmaları → ISO alpha-2. Otomatik eşleşmeyenler. */
const PATCH = {
  "W. Sahara": "EH",
  "Dem. Rep. Congo": "CD",
  "Congo": "CG",
  "Dominican Rep.": "DO",
  "Falkland Is.": "FK",
  "Fr. S. Antarctic Lands": "TF",
  "Bosnia and Herz.": "BA",
  "Central African Rep.": "CF",
  "Eq. Guinea": "GQ",
  "S. Sudan": "SS",
  "Solomon Is.": "SB",
  "N. Cyprus": null,        // ISO kodu yok
  "Somaliland": null,       // ISO kodu yok
  "Kosovo": "XK",           // kullanıcı tanımlı kod
  "Czechia": "CZ",
  "Côte d'Ivoire": "CI",
  "eSwatini": "SZ",
  "Swaziland": "SZ",
  "Macedonia": "MK",
  "North Macedonia": "MK",
  "Turkey": "TR",
  "Türkiye": "TR",
  "United States of America": "US",
  "Palestine": "PS",
  "Vatican": "VA",
  "Antarctica": "AQ",
  "Northern Cyprus": null,
  "Myanmar": "MM",
  "Trinidad and Tobago": "TT",
};

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Tüm alpha-2 kodlarını tara, İngilizce adlarını indeksle.
const byName = new Map();
const A = "A".charCodeAt(0);
for (let i = 0; i < 26; i++) {
  for (let j = 0; j < 26; j++) {
    const code = String.fromCharCode(A + i, A + j);
    let name;
    try {
      name = enNames.of(code);
    } catch {
      continue;
    }
    if (!name || name === code) continue;
    byName.set(norm(name), code);
  }
}

const out = [];
const missing = [];
for (const g of geometries) {
  const name = g.properties?.name ?? "";
  let code;
  if (Object.prototype.hasOwnProperty.call(PATCH, name)) code = PATCH[name];
  else code = byName.get(norm(name)) ?? null;
  if (code === undefined) code = null;
  if (!code) missing.push(`${g.id} ${name}`);
  out.push([String(g.id), code, name]);
}

out.sort((a, b) => Number(a[0]) - Number(b[0]));

const body = out.map(([id, code, name]) => `  ["${id}", ${code ? `"${code}"` : "null"}], // ${name}`).join("\n");

const ts = `// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
// Kaynak: node scripts/gen-country-codes.mjs (world-atlas + Node ICU)
//
// world-atlas'taki ISO 3166-1 numeric id → alpha-2 kod. Alpha-2'den Türkçe ve
// İngilizce ülke adı tarayıcının kendi Intl.DisplayNames'inden çözülür; bu
// yüzden burada ad saklanmaz ve dosya çevrimdışı çalışır.
export const NUMERIC_TO_ALPHA2: ReadonlyArray<readonly [string, string | null]> = [
${body}
];
`;

writeFileSync(new URL("../src/lib/country-codes.ts", import.meta.url), ts);
console.log(`yazıldı: src/lib/country-codes.ts (${out.length} ülke)`);
if (missing.length) console.log(`kodsuz (${missing.length}): ${missing.join(" | ")}`);
