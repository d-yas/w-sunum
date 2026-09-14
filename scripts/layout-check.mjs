// Free layout and the hover switch, driven through the real UI.
//
// Three things are worth proving and none of them can be read off the source:
//
//  1. Turning "Serbest yerleşim" on must not move anything. The boxes are
//     measured off the live card and then applied as absolute positions, so
//     any coordinate-space mistake shows up as a jump. (One did: an absolutely
//     positioned child is offset from the padding *box*, which equals the
//     border box when there is no border — the first version subtracted the
//     padding and shifted the whole card 32 px left.)
//  2. Dragging and resizing the chart box moves the chart, and the chart
//     actually redraws to the new size rather than being clipped.
//  3. The hover switch removes Bklit's tooltip.
//
//   node scripts/layout-check.mjs
import { writeFileSync } from "node:fs";

import { launch } from "./cdp.mjs";

const CARD = { w: 960, h: 540 };

function workspace() {
  return {
    version: 1,
    theme: "light",
    activeId: "a",
    export: { scale: 1, background: "theme" },
    charts: [
      {
        id: "a",
        name: "a",
        kind: "bar",
        title: "Çeyreklik satış",
        subtitle: "Ürün bazında",
        note: "Kaynak: ERP",
        data: { columns: ["x", "y"], rows: [["a", "1"], ["b", "2"]] },
        paletteId: "varsayilan",
        colors: [],
        options: {
          width: CARD.w,
          height: CARD.h,
          padding: 32,
          animate: false,
          legend: true,
          grid: true,
          xAxis: true,
          yAxis: true,
          titleSize: 22,
          chartInset: 8,
          hover: true,
        },
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
        yerlesim: { serbest: false, kutular: {} },
      },
    ],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(16)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, mouse, sleep, dir } = cdp;
  await seed(workspace());

  const snap = () => evalIn(`window.__veriGorsel.snapshotDataUrl(1)`);
  const boxes = () => evalIn(`JSON.parse(localStorage.getItem("data-gorsel.workspace.v1")).charts[0].yerlesim`);
  const rectOf = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);

  // Open the Süsle tab so the overlay mounts.
  await evalIn(`document.querySelector('[role="tab"][data-tab="susle"]').click(); true`);
  await sleep(400);

  /* 1 — switching free layout on must be visually inert */
  const before = await snap();
  await evalIn(`[...document.querySelectorAll('button[role="switch"]')][0].click(); true`);
  await sleep(700);
  const after = await snap();
  const diff = await evalIn(`(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const a = await load(${JSON.stringify(before)}), b = await load(${JSON.stringify(after)});
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = px(a), B = px(b);
    let bad = 0, worst = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i]-B[i]) + Math.abs(A[i+1]-B[i+1]) + Math.abs(A[i+2]-B[i+2]);
      if (d > 24) bad++;
      if (d > worst) worst = d;
    }
    return { bad, worst, total: A.length / 4 };
  })()`);
  writeFileSync(`${dir}/yerlesim-once.png`, Buffer.from(before.split(",")[1], "base64"));
  writeFileSync(`${dir}/yerlesim-sonra.png`, Buffer.from(after.split(",")[1], "base64"));
  // A handful of anti-aliased pixels is fine; a shifted layout is thousands.
  report(diff.bad / diff.total < 0.005, "serbest-ac", `farklı piksel ${diff.bad}/${diff.total}, en büyük fark ${diff.worst}`);

  const seeded = await boxes();
  if (!seeded.kutular.grafik) throw new Error("kutular ölçülemedi");

  /* 2a — drag the chart */
  const r0 = await rectOf('.decor-box[data-slot="grafik"]');
  if (!r0) throw new Error("grafik kutusu sahnede yok");
  const scale = r0.w / seeded.kutular.grafik.w;
  const cx = r0.x + r0.w / 2;
  const cy = r0.y + r0.h / 2;
  await mouse("mousePressed", cx, cy);
  await mouse("mouseMoved", cx - 40, cy + 30);
  await mouse("mouseReleased", cx - 40, cy + 30, 0);
  await sleep(600);
  const moved = (await boxes()).kutular.grafik;
  const dx = moved.x - seeded.kutular.grafik.x;
  const dy = moved.y - seeded.kutular.grafik.y;
  report(
    Math.abs(dx - -40 / scale) <= 6 && Math.abs(dy - 30 / scale) <= 6,
    "grafik-tasi",
    `Δ(${dx.toFixed(1)}, ${dy.toFixed(1)}) ölçek ${scale.toFixed(3)}`
  );

  /* 2b — resize it, and confirm the chart redrew into the smaller box */
  const r1 = await rectOf('.decor-box[data-slot="grafik"]');
  await mouse("mousePressed", r1.x + r1.w - 1, r1.y + r1.h - 1);
  await mouse("mouseMoved", r1.x + r1.w - 150, r1.y + r1.h - 90);
  await mouse("mouseReleased", r1.x + r1.w - 150, r1.y + r1.h - 90, 0);
  await sleep(800);
  const sized = (await boxes()).kutular.grafik;
  const svgW = await evalIn(
    `(() => { const s = document.querySelector('.stage-card [data-slot="grafik"] svg'); return s ? s.getBoundingClientRect().width / ${scale} : -1; })()`
  );
  report(
    sized.w < moved.w - 80 && svgW > 0 && svgW <= sized.w + 4,
    "grafik-boyut",
    `kutu ${moved.w.toFixed(0)}→${sized.w.toFixed(0)}, içindeki svg ${svgW.toFixed(0)}px`
  );

  /* 3 — hover switch */
  await evalIn(`document.querySelector('[role="tab"][data-tab="gorunum"]').click(); true`);
  await sleep(400);
  const card = await rectOf(".stage-card");
  // Bklit's tooltip carries no role; it is identified by the token class the
  // theme hangs the tooltip background on.
  const tips = () => evalIn(`document.querySelectorAll('.stage-card [class*="chart-tooltip"]').length`);
  await mouse("mouseMoved", card.x + card.w * 0.4, card.y + card.h * 0.6, 0);
  await sleep(500);
  const on = await tips();
  const clicked = await evalIn(`(() => {
    const f = [...document.querySelectorAll('label.field')].find((l) => l.textContent.includes('Fare üstünde vurgu'));
    if (!f) return false;
    f.querySelector('button[role="switch"]').click();
    return true;
  })()`);
  await sleep(400);
  await mouse("mouseMoved", card.x + card.w * 0.45, card.y + card.h * 0.55, 0);
  await sleep(500);
  const off = await tips();
  report(clicked && on > 0 && off === 0, "hover-anahtar", `açıkken ${on} ipucu, kapalıyken ${off}`);

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nyerleşim ve hover beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
