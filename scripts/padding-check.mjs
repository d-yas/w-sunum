// Kenar boşlukları — hiçbir etiket kesilmiyor mu.
//
// Grafiklerin kenar boşluğu uzun süre "karakter × sabit" ile tahmin edildi ve
// çoğu tür sabit bir margin taşıyordu. Tahmin eksik kalınca etiket kendi
// `<svg>`'sinin ya da kartın dışına düşüyor; `src/charts/` tabanlı grafikler
// UA varsayılanıyla (`svg:root { overflow: hidden }`) kırptığı için bu sessizce
// kayboluyordu — kullanıcı sankey'de alttaki düğümün değerini hiç göremedi.
//
// Dört değişmez:
//   I1  Her metin kartın sınırları içinde.
//   I2  Her SVG metni **kendi çizim yüzeyinin** içinde. Asıl sözleşme bu:
//       `overflow: visible` açılsa bile geçerli kalıyor, çünkü rect'ler
//       kırpmadan etkilenmiyor.
//   I3  `overflow: hidden` + `ellipsis` taşıyan HTML kutularında sessiz kırpma
//       yok (`scrollWidth > clientWidth`). Bunlar I1'i geçer ama keciktir.
//   I4  Ölçüm gerçek: `olcuGercekMi()` false dönen bir koşu başarısız. Yoksa
//       test yeşil görünürken ölçüm kaba tahmine düşmüş olabilir.
//
// `getBBox` değil `getBoundingClientRect` kullanılıyor: `getBBox` yerel
// kullanıcı birimindedir, ata `transform`'ları (sankey'in `translate(margin…)`,
// sahnenin `scale()`'i) saymaz, ve ısı takvimi ile yatay çubuğun HTML portal
// etiketlerini hiç göremez.
//
//   node scripts/padding-check.mjs [tür]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { launch, outDir } from "./cdp.mjs";

/** Uzun Türkçe etiketler ve yedi haneli sayılar — tahminlerin kırıldığı yer. */
const UZUN = ["İstanbul Avrupa Yakası", "Ankara Çankaya Şubesi", "İzmir Karşıyaka", "Şanlıurfa Merkez", "Kahramanmaraş"];
const BUYUK = ["1234567", "987654", "456789", "234567", "123456"];

const iki = (n) => UZUN.slice(0, n).map((l, i) => [l, BUYUK[i]]);

/** Tür → tablo. Her tür kendi `columnRoles` biçimini istiyor. */
function veri(kind) {
  switch (kind) {
    case "sankey":
    case "chord":
    case "network":
    case "arc":
      return {
        columns: ["Kaynak", "Hedef", "Değer"],
        rows: [
          ["İstanbul Avrupa Yakası", "Kahramanmaraş Merkez", "1234567"],
          ["İstanbul Avrupa Yakası", "Şanlıurfa Şubesi", "234567"],
          ["Ankara Çankaya Şubesi", "Kahramanmaraş Merkez", "456789"],
          ["Ankara Çankaya Şubesi", "Küçük Kalem", "1200"],
          ["Kahramanmaraş Merkez", "İzmir Karşıyaka Deposu", "987654"],
          ["Kahramanmaraş Merkez", "Çok Küçük Kalan", "900"],
          ["Şanlıurfa Şubesi", "İzmir Karşıyaka Deposu", "222222"],
        ],
      };
    case "heatmap":
      return { columns: ["Tarih", "Değer"], rows: [["2025-01-05", "1234567"], ["2025-03-14", "987654"], ["2025-07-02", "456789"]] };
    case "ring":
    case "gauge":
      return { columns: ["Kategori", "Değer", "Hedef"], rows: iki(4).map(([a, b]) => [a, b, "2000000"]) };
    case "treemap":
    case "sunburst":
    case "pack":
      return { columns: ["Grup", "Alt grup", "Değer"], rows: UZUN.slice(0, 4).map((l, i) => [l, `${l} alt`, BUYUK[i]]) };
    case "scatter":
    case "bubble":
      return {
        columns: ["Etiket", "X", "Y", "Boyut", "Grup"],
        rows: UZUN.slice(0, 4).map((l, i) => [l, BUYUK[i], BUYUK[3 - i], BUYUK[i], "Kahramanmaraş Grubu"]),
      };
    case "map":
      return { columns: ["Bölge", "Değer"], rows: [["İstanbul", "1234567"], ["Ankara", "987654"], ["İzmir", "456789"]] };
    case "funnel":
    case "waterfall":
    case "pictogram":
      return { columns: ["Aşama", "Değer"], rows: iki(5) };
    default:
      return { columns: ["Kategori", "2024", "2025"], rows: UZUN.slice(0, 5).map((l, i) => [l, BUYUK[i], BUYUK[4 - i]]) };
  }
}

const TURLER = [
  "bar", "barH", "marimekko", "waterfall", "funnel",
  "line", "area", "slope", "heatmap",
  "ring", "gauge", "treemap", "sunburst", "pack", "pictogram",
  "scatter", "bubble", "radar", "sankey", "chord", "network", "arc",
  "map",
];

/** Üç varyant: uzun etiket, büyük punto + eksen adı, dar kart. */
const VARYANTLAR = [
  { ad: "uzun", o: {} },
  { ad: "buyuk", o: { valueLabelSize: 24, titleSize: 34, xTitle: "Yatay eksen adı", yTitle: "Dikey eksen adı", xTickAngle: "auto", valueLabels: "on" } },
  { ad: "dar", o: { width: 640, height: 360, padding: 0, legend: true, legendPosition: "right" } },
];

function workspace(kind, over) {
  return {
    version: 1,
    theme: "light",
    activeId: "a",
    palettes: [],
    export: { scale: 1, background: "theme" },
    charts: [
      {
        id: "a",
        name: "a",
        kind,
        title: "Kahramanmaraş ve çevresi dağılımı",
        subtitle: "Alt başlık",
        note: "Kaynak: kurum içi ölçüm",
        data: veri(kind),
        paletteId: "varsayilan",
        colors: [],
        options: {
          width: 960,
          height: 540,
          padding: 32,
          animate: false,
          hover: false,
          legend: false,
          grid: true,
          xAxis: true,
          yAxis: true,
          titleSize: 22,
          chartInset: 8,
          sankeyValueLabels: true,
          sankeyUnit: "oturum",
          nodeLabels: true,
          ...over,
        },
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [], gruplar: {} },
        yerlesim: { serbest: false, kutular: {}, gizli: [] },
      },
    ],
  };
}

/** Sayfada koşan ölçüm. Kart ve her metin düğümünün gerçek ekran kutusu. */
const PROBE = `(() => {
  const kart = document.querySelector(".slide-card");
  if (!kart) return { hata: "kart yok" };
  const K = kart.getBoundingClientRect();
  const pay = 1.5;
  const disari = [];
  const svgDisi = [];
  const kecik = [];

  const gorunur = (el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };

  for (const t of kart.querySelectorAll("text, tspan")) {
    if (!t.textContent || !t.textContent.trim()) continue;
    if (t.tagName === "text" && t.querySelector("tspan")) continue;
    if (!gorunur(t)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 0.5 && r.height < 0.5) continue;
    const yazi = t.textContent.trim().slice(0, 28);
    if (r.left < K.left - pay || r.right > K.right + pay || r.top < K.top - pay || r.bottom > K.bottom + pay) {
      disari.push(yazi + " @" + Math.round(Math.max(K.left - r.left, r.right - K.right, K.top - r.top, r.bottom - K.bottom)) + "px");
    }
    const svg = t.closest("svg");
    if (svg) {
      const S = svg.getBoundingClientRect();
      const d = Math.max(S.left - r.left, r.right - S.right, S.top - r.top, r.bottom - S.bottom);
      if (d > pay) svgDisi.push(yazi + " @" + Math.round(d) + "px");
    }
  }

  for (const el of kart.querySelectorAll("*")) {
    if (el.children.length !== 0) continue;
    const s = (el.textContent || "").trim();
    if (!s) continue;
    if (el.closest("svg")) continue;
    if (!gorunur(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow === "visible" && cs.textOverflow !== "ellipsis") continue;
    if (el.scrollWidth > el.clientWidth + 1) kecik.push(s.slice(0, 28) + " " + el.scrollWidth + ">" + el.clientWidth);
  }
  return { disari, svgDisi, kecik };
})()`;

let failures = 0;
const satirlar = [];
const report = (ok, name, detail) => {
  if (!ok) failures++;
  satirlar.push(`${ok ? "OK  " : "FAIL"} ${name.padEnd(22)} ${detail}`);
  console.log(satirlar[satirlar.length - 1]);
};

const sadece = process.argv[2];
const turler = sadece ? TURLER.filter((t) => t === sadece) : TURLER;

const cdp = await launch({ width: 1500, height: 1000 });
try {
  const { evalIn, seed, sleep } = cdp;
  await seed(workspace("bar", {}));

  // I4 — ölçüm gerçekten canvas'tan mı geliyor.
  const gercek = await evalIn(`(() => {
    try { return !!document.createElement("canvas").getContext("2d"); } catch { return false; }
  })()`);
  report(gercek === true, "olcum-gercek", `canvas ölçümü=${gercek}`);

  for (const kind of turler) {
    for (const v of VARYANTLAR) {
      await seed(workspace(kind, v.o));
      await sleep(500);
      const r = await evalIn(PROBE);
      const ad = `${kind}/${v.ad}`;
      if (r.hata) {
        report(false, ad, r.hata);
        continue;
      }
      const sorun = [];
      if (r.disari.length) sorun.push(`kart dışı: ${r.disari.slice(0, 3).join(", ")}`);
      if (r.svgDisi.length) sorun.push(`svg dışı: ${r.svgDisi.slice(0, 3).join(", ")}`);
      if (r.kecik.length) sorun.push(`sessiz kırpma: ${r.kecik.slice(0, 3).join(", ")}`);
      report(sorun.length === 0, ad, sorun.length ? sorun.join(" · ") : "temiz");
    }
  }

  writeFileSync(join(outDir(), "padding-rapor.txt"), satirlar.join("\n"), "utf8");
  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nhiçbir etiket kesilmiyor." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
