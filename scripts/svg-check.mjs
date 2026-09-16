// SVG dışa aktarımı: kartın tamamı vektör olarak çıkıyor mu?
//
// Eski sürüm yalnız çizim alanının <svg>sini alıyordu; başlık, gösterge,
// dipnot, yatay çubuğun kategori etiketleri, ısı takviminin eksenleri ve
// halkanın merkez sayısı HTML olduğu için dışarıda kalıyordu, piktogram ise
// hiç dışa aktarılamıyordu ("Bu grafikte SVG bulunamadı").
//
// Kontrol her tür için üç şeye bakıyor: çıktı geçerli XML mi, kartın HTML
// parçaları <text> olarak içinde mi, ve tarayıcı bu SVG'yi bir görüntü
// olarak yükleyebiliyor mu (yükleyemezse indirilen dosya hiçbir yerde
// açılmaz).
//
//   node scripts/svg-check.mjs
import { writeFileSync } from "node:fs";

import { launch } from "./cdp.mjs";

/**
 * Serbest katmanlar da vektör çıkmalı: metin kutusunun satırları `<tspan>`,
 * bağlantının kesikleri `stroke-dasharray`. İkisi de öznitelik, `class`
 * değil — dışa aktarım hesaplanmış stili gömerken sınıfı siliyor.
 */
const SERBEST = [
  {
    asset: "metin/kutu",
    id: "m1",
    ad: "",
    renk: "",
    renk2: "",
    opaklik: 1,
    gizli: false,
    params: { yazi: "Serbest metin", punto: 18, boy: "sabit" },
    x: 600,
    y: 60,
    w: 300,
    h: 60,
    aci: 0,
    aynala: false,
    katman: "on",
    kilit: false,
    grup: "",
  },
  {
    asset: "ok/baglanti",
    id: "b1",
    ad: "",
    renk: "",
    renk2: "",
    opaklik: 1,
    gizli: false,
    params: { x1: 0, y1: 0, x2: 100, y2: 100, kalinlik: 3, stil: "kesik", bas: "nokta", son: "ok", uc: 14, bukum: 20 },
    x: 300,
    y: 200,
    w: 260,
    h: 180,
    aci: 0,
    aynala: false,
    katman: "on",
    kilit: false,
    grup: "",
  },
];

/** Her tür: beklenen metin parçaları. */
const CASES = [
  { kind: "bar", needs: ["Başlık", "Alt başlık", "Dipnot", "bir", "Seri 1", "Serbest metin"], serbest: true },
  { kind: "barH", needs: ["Başlık", "bir", "Seri 1"] },
  { kind: "line", needs: ["Başlık", "Seri 1"] },
  { kind: "ring", needs: ["Başlık", "Toplam"] },
  { kind: "heatmap", needs: ["Başlık"] },
  { kind: "pictogram", needs: ["Başlık", "Her simge"] },
];

function workspace(kind, serbest = false) {
  const data =
    kind === "heatmap"
      ? { columns: ["Tarih", "Değer"], rows: [["2025-01-06", "3"], ["2025-01-07", "5"], ["2025-02-11", "8"]] }
      : kind === "ring" || kind === "pictogram"
        ? { columns: ["Etiket", "Değer"], rows: [["bir", "10"], ["iki", "40"]] }
        : { columns: ["Kategori", "Seri 1"], rows: [["bir", "10"], ["iki", "40"]] };
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
        title: "Başlık",
        subtitle: "Alt başlık",
        note: "Dipnot",
        data,
        paletteId: "varsayilan",
        colors: [],
        options: { width: 960, height: 540, animate: false, hover: false, legend: true, xAxis: true, yAxis: true },
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: serbest ? SERBEST : [], gruplar: {} },
        yerlesim: { serbest: false, kutular: {}, gizli: [] },
      },
    ],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(12)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, sleep, problems, dir } = cdp;

  for (const c of CASES) {
    await seed(workspace(c.kind, c.serbest));
    await sleep(400);
    const res = await evalIn(`(async () => {
      const text = await window.__veriGorsel.cardSvg();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const bad = doc.querySelector("parsererror");
      // Gerçekten yüklenebiliyor mu — geçerli XML olmak yetmez.
      let loads = false;
      try {
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        loads = img.width > 0;
      } catch { loads = false; }
      return {
        text,
        ok: !bad,
        loads,
        texts: [...doc.querySelectorAll("text")].map((t) => t.textContent),
        marks: doc.querySelectorAll("rect, circle").length,
        svgs: doc.querySelectorAll("svg").length,
        tspans: doc.querySelectorAll("tspan").length,
        kesik: !!doc.querySelector("[stroke-dasharray]"),
      };
    })()`);

    const missing = c.needs.filter((n) => !res.texts.some((t) => (t ?? "").includes(n)));
    const serbestOk = !c.serbest || (res.tspans > 0 && res.kesik);
    const ok = res.ok && res.loads && missing.length === 0 && serbestOk;
    report(
      ok,
      c.kind,
      ok
        ? `${res.texts.length} metin · ${res.marks} şekil · ${res.svgs} svg · ${Math.round(res.text.length / 1024)} KB${c.serbest ? ` · ${res.tspans} tspan · kesik=${res.kesik}` : ""}`
        : `${!res.ok ? "XML hatası " : ""}${!res.loads ? "yüklenmedi " : ""}${missing.length ? "eksik: " + missing.join(", ") : ""}${!serbestOk ? `serbest katman kayıp (tspan ${res.tspans}, kesik ${res.kesik})` : ""}`
    );
    writeFileSync(`${dir}/card-${c.kind}.svg`, res.text);
  }

  const errs = problems();
  console.log("console:", errs.length ? "\n  " + errs.join("\n  ") : "(clean)");
  if (errs.length) failures++;
} finally {
  cdp.close();
}

console.log(failures === 0 ? "\nkart SVG'si eksiksiz." : `\n${failures} kontrol başarısız.`);
process.exit(failures === 0 ? 0 : 1);
