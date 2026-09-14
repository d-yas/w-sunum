// Grafik ayarları — her biri çizime ulaşıyor mu?
//
// Bu ayarların ortak yanı, panelde bir değer olmakla kalmayıp SVG'de somut bir
// iz bırakması: bir `rx`, bir `opacity`, bir `<text>`, bir `<line>`. Kontrol de
// o izi arıyor; ekran görüntüsüne bakmak yerine dışa aktarımın ara SVG'sini
// (`__veriGorsel.staticMarkup()`) okuyor, çünkü kullanıcıya giden şey o.
//
//   node scripts/options-check.mjs
import { launch } from "./cdp.mjs";

const CHART = {
  id: "a",
  name: "a",
  kind: "bar",
  title: "Başlık",
  subtitle: "",
  note: "",
  data: { columns: ["Kategori", "Değer"], rows: [["bir", "10"], ["iki", "40"], ["uc", "25"]] },
  paletteId: "varsayilan",
  colors: [],
  options: { width: 960, height: 540, animate: false, hover: false, legend: false, grid: false },
  decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
  yerlesim: { serbest: false, kutular: {}, gizli: [] },
};

function workspace(kind, options) {
  return {
    version: 1,
    theme: "light",
    activeId: "a",
    palettes: [],
    export: { scale: 1, background: "theme" },
    charts: [{ ...CHART, kind, options: { ...CHART.options, ...options } }],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(22)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, sleep, problems } = cdp;

  /** Seed a workspace and return the export SVG markup. */
  const markup = async (kind, options) => {
    await seed(workspace(kind, options));
    await sleep(300);
    return evalIn(`window.__veriGorsel.staticMarkup()`);
  };

  /* --- 1. çubuk köşesi --- */
  const sharp = await markup("bar", { barRadius: 0 });
  const round = await markup("bar", { barRadius: 12 });
  const rxOf = (svg) => [...svg.matchAll(/data-part="bar"[^>]*?rx="([\d.]+)"|rx="([\d.]+)"[^>]*?data-part="bar"/g)].map((m) => m[1] ?? m[2]);
  const sharpRx = rxOf(sharp);
  const roundRx = rxOf(round);
  report(
    sharpRx.length > 0 && sharpRx.every((v) => Number(v) === 0) && roundRx.some((v) => Number(v) >= 10),
    "kose-yaricapi",
    `keskin rx=[${sharpRx.join(",")}] · yuvarlak rx=[${roundRx.join(",")}]`
  );

  /* --- 2. vurgu: seçilmeyen çubuklar soluk --- */
  const hi = await markup("bar", { highlight: ["iki"] });
  const opacities = [...hi.matchAll(/data-part="bar"[^>]*?opacity="([\d.]+)"|opacity="([\d.]+)"[^>]*?data-part="bar"/g)].map((m) => Number(m[1] ?? m[2]));
  const faded = opacities.filter((v) => v < 0.5).length;
  report(faded === 2 && opacities.filter((v) => v === 1).length === 1, "vurgu", `opaklıklar [${opacities.join(",")}]`);

  /* --- 3. kategoriye göre renk --- */
  const byCat = await markup("bar", { colorBy: "category" });
  const fills = new Set([...byCat.matchAll(/data-part="bar"[^>]*?fill="([^"]+)"|fill="([^"]+)"[^>]*?data-part="bar"/g)].map((m) => m[1] ?? m[2]));
  report(fills.size === 3, "kategori-rengi", `${fills.size} ayrı dolgu: ${[...fills].join(" ")}`);

  /* --- 4. sıralama: eksen etiketleri değere göre dizilir --- */
  const desc = await markup("bar", { sort: "desc", xAxis: true });
  const order = [...desc.matchAll(/>(bir|iki|uc)</g)].map((m) => m[1]);
  report(order[0] === "iki" && order[order.length - 1] === "bir", "sirala", `sıra ${order.join(" ")}`);

  /* --- 5. değer aralığı: y ekseni üst sınırı kullanıcının yazdığı sayı --- */
  const capped = await markup("bar", { yAxis: true, yMax: 60, yTicks: 4 });
  // Y eksen etiketi x="-10"da duruyor (axes.tsx); dışa aktarım öznitelikleri
  // kebab-case'e çevirdiği için seçici `text-anchor` değil konuma bakıyor.
  const yTexts = [...capped.matchAll(/<text x="-10"[^>]*>([\d.,]+)</g)].map((m) => m[1]);
  // nice() yalnız üst sınır otomatikken uygulanır; 60 yazıldıysa 60 görünmeli.
  report(yTexts.includes("60"), "deger-araligi", `y etiketleri [${yTexts.join(",")}]`);

  /* --- 6. etiket açısı --- */
  const rotated = await markup("bar", { xAxis: true, xTickAngle: 90 });
  report(/rotate\(-90 /.test(rotated), "etiket-acisi", /rotate\(-90 /.test(rotated) ? "rotate(-90 …) var" : "dönme yok");

  /* --- 7. eksen adları --- */
  const titled = await markup("bar", { xAxis: true, yAxis: true, xTitle: "Çeyrek", yTitle: "Adet" });
  report(titled.includes("Çeyrek") && titled.includes("Adet"), "eksen-adlari", "iki ad da SVG'de");

  /* --- 8. çizgi grafiğinde tahmin kesiği --- */
  const forecast = await markup("line", { forecastFrom: 2 });
  const dashes = [...forecast.matchAll(/stroke-dasharray:\s*([^;"]+)/g)].map((m) => m[1].trim());
  report(dashes.some((d) => d.startsWith("6")), "tahmin-kesigi", `dasharray [${dashes.join(" | ") || "yok"}]`);

  const errs = problems();
  console.log("console:", errs.length ? "\n  " + errs.join("\n  ") : "(clean)");
  if (errs.length) failures++;
} finally {
  cdp.close();
}

console.log(failures === 0 ? "\nayarlar çizime ulaşıyor." : `\n${failures} kontrol başarısız.`);
process.exit(failures === 0 ? 0 : 1);
