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

/** Her tür: beklenen metin parçaları. */
const CASES = [
  { kind: "bar", needs: ["Başlık", "Alt başlık", "Dipnot", "bir", "Seri 1"] },
  { kind: "barH", needs: ["Başlık", "bir", "Seri 1"] },
  { kind: "line", needs: ["Başlık", "Seri 1"] },
  { kind: "ring", needs: ["Başlık", "Toplam"] },
  { kind: "heatmap", needs: ["Başlık"] },
  { kind: "pictogram", needs: ["Başlık", "Her simge"] },
];

function workspace(kind) {
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
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
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
    await seed(workspace(c.kind));
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
      };
    })()`);

    const missing = c.needs.filter((n) => !res.texts.some((t) => (t ?? "").includes(n)));
    const ok = res.ok && res.loads && missing.length === 0;
    report(
      ok,
      c.kind,
      ok
        ? `${res.texts.length} metin · ${res.marks} şekil · ${res.svgs} svg · ${Math.round(res.text.length / 1024)} KB`
        : `${!res.ok ? "XML hatası " : ""}${!res.loads ? "yüklenmedi " : ""}${missing.length ? "eksik: " + missing.join(", ") : ""}`
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
