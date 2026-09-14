// Üç sütunlu kabuk: sol liste, sahne, sağ panel — gerçek tıklamalarla.
//
// Buradaki altı davranışın hiçbirinin birim testi yok; hepsi ancak bir tıklama
// React durumuna, React durumu da localStorage'a ulaştığında var oluyor:
//
//  1. Üç sütun gerçekten üç sütun (genişlikler ve sıra).
//  2. Küçük resimler üretiliyor (liste ikonla değil PNG ile dolu).
//  3. Çift tıkla yeniden adlandırma çalışma alanına yazıyor.
//  4. Kopyala / sil / sırala liste düğmeleri doğru grafiği hedefliyor.
//  5. Ctrl+Z bir düzenlemeyi geri alıyor, Ctrl+Y geri getiriyor.
//  6. Bölme tutamacı liste yüksekliğini kalıcı kaydediyor.
//
//   node scripts/shell-check.mjs
import { writeFileSync } from "node:fs";

import { launch } from "./cdp.mjs";

function workspace() {
  const chart = (id, name, kind) => ({
    id,
    name,
    kind,
    title: `${name} başlığı`,
    subtitle: "",
    note: "",
    data: { columns: ["x", "y"], rows: [["a", "1"], ["b", "2"]] },
    paletteId: "varsayilan",
    colors: [],
    options: { width: 960, height: 540, animate: false, legend: false, grid: false, hover: false },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
    yerlesim: { serbest: false, kutular: {}, gizli: [] },
  });
  return {
    version: 1,
    theme: "light",
    activeId: "a",
    palettes: [],
    export: { scale: 1, background: "theme" },
    charts: [chart("a", "Bir", "bar"), chart("b", "İki", "line"), chart("c", "Üç", "ring")],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(20)} ${detail}`);
};

const cdp = await launch({ width: 1600, height: 950 });
try {
  const { evalIn, seed, mouse, sleep, key, problems, dir } = cdp;
  await seed(workspace());

  const store = () => evalIn(`JSON.parse(localStorage.getItem("data-gorsel.workspace.v1"))`);
  const prefs = () => evalIn(`JSON.parse(localStorage.getItem("data-gorsel.ui.v1") || "null")`);
  const rectOf = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const clickSel = (sel) => evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
  const names = () => evalIn(`[...document.querySelectorAll('.chart-row')].map(r => r.dataset.id)`);

  /* 1 — three columns, left to right */
  const left = await rectOf("aside.left");
  const stage = await rectOf("main .stage");
  const right = await rectOf("aside.right");
  const ordered = left && stage && right && left.x < stage.x && stage.x < right.x;
  report(
    ordered && left.w >= 230 && left.w <= 320 && right.w >= 270 && right.w <= 340,
    "uc-sutun",
    `sol ${left?.w}px @${left?.x} · sahne ${stage?.w}px @${stage?.x} · sağ ${right?.w}px @${right?.x}`
  );

  /* 2 — thumbnails render; they come from the real export path */
  let thumbs = 0;
  for (let i = 0; i < 25 && thumbs < 3; i++) {
    thumbs = await evalIn(`document.querySelectorAll('.chart-thumb img').length`);
    if (thumbs < 3) await sleep(800);
  }
  report(thumbs === 3, "kucuk-resim", `${thumbs}/3 grafik için PNG üretildi`);

  /* 3 — double-click rename */
  const nameBox = await rectOf('.chart-row[data-id="b"] .chart-name');
  await mouse("mousePressed", nameBox.x + 10, nameBox.y + 6);
  await mouse("mouseReleased", nameBox.x + 10, nameBox.y + 6, 0);
  await evalIn(`(() => { const e = document.querySelector('.chart-row[data-id="b"] .chart-name');
    e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true; })()`);
  await sleep(200);
  await evalIn(`(() => {
    const inp = document.querySelector('.chart-row[data-id="b"] input');
    if (!inp) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'Yeniden');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.blur();
    return true;
  })()`);
  await sleep(500);
  const renamed = (await store()).charts.find((c) => c.id === "b");
  report(renamed?.name === "Yeniden", "yeniden-adlandir", `ad="${renamed?.name}"`);

  /* 4 — reorder, duplicate */
  await clickSel('.chart-row[data-id="c"] [title="Yukarı taşı"]');
  await sleep(400);
  const order = (await store()).charts.map((c) => c.id).join(",");
  report(order === "a,c,b", "sirala", `sıra ${order}`);

  await clickSel('.chart-row[data-id="a"] [title="Kopyala"]');
  await sleep(600);
  const after = await store();
  const copy = after.charts.find((c) => c.name === "Bir (kopya)");
  report(after.charts.length === 4 && !!copy && after.activeId === copy.id, "kopyala", `${after.charts.length} grafik, aktif=kopya:${after.activeId === copy?.id}`);

  /* 5 — undo / redo */
  const beforeUndo = (await store()).charts.length;
  await key("z", "KeyZ", 90, 2);
  await sleep(600);
  const undone = (await store()).charts.length;
  await key("y", "KeyY", 89, 2);
  await sleep(600);
  const redone = (await store()).charts.length;
  report(undone === beforeUndo - 1 && redone === beforeUndo, "geri-al", `${beforeUndo} → geri ${undone} → yinele ${redone}`);

  /* 6 — split handle persists */
  const h = await rectOf(".split-handle");
  await mouse("mousePressed", h.x + h.w / 2, h.y + h.h / 2);
  await mouse("mouseMoved", h.x + h.w / 2, h.y + 90);
  await mouse("mouseReleased", h.x + h.w / 2, h.y + 90, 0);
  await sleep(400);
  const p = await prefs();
  report(typeof p?.listHeight === "number" && p.listHeight > 300, "bolme", `listHeight=${p?.listHeight}`);

  /* 7 — right panel tabs all mount */
  for (const t of ["gorunum", "renk", "susle", "disa"]) {
    await clickSel(`[role="tab"][data-tab="${t}"]`);
    await sleep(350);
  }
  await clickSel(`[role="tab"][data-tab="gorunum"]`);
  await sleep(350);
  const sections = await evalIn(`document.querySelectorAll('aside.right [data-section]').length`);
  report(sections >= 4, "sag-panel", `${sections} bölüm`);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${dir}/shell.png`, Buffer.from(shot.data, "base64"));

  const errs = problems();
  console.log("console:", errs.length ? "\n  " + errs.join("\n  ") : "(clean)");
  if (errs.length) failures++;
} finally {
  cdp.close();
}

console.log(failures === 0 ? "\nkabuk beklendiği gibi." : `\n${failures} kontrol başarısız.`);
process.exit(failures === 0 ? 0 : 1);
