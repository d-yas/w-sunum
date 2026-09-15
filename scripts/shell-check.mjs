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
//  7. "Yeni grafik" kutusu panelin yanına açılıyor ve 23 türün hepsi
//     kaydırmadan görünüyor (eskiden yukarı taşıp kesiliyordu).
//  8. Satırı sürüklemek listeyi gerçekten yeniden sıralıyor.
//  9. Sürükleme sırasında metin seçimi kapalı ve satır havalanmış görünüyor.
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

  /* 8 — tıkla-seç: karttaki parça ilgili ayara götürüyor */
  const activeTab = () => evalIn(`document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab`);
  const clickCard = async (sel, shift = false) => {
    const r = await rectOf(sel);
    if (!r) return false;
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    const mod = shift ? 8 : 0;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, modifiers: mod });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, modifiers: mod });
    await sleep(400);
    return true;
  };

  await clickSel(`[role="tab"][data-tab="renk"]`);
  await sleep(300);
  const hitTitle = await clickCard('.stage-card [data-part="title"]');
  const tabAfter = await activeTab();
  const sectionSeen = await evalIn(`(() => {
    const el = document.querySelector('aside.right [data-section="metin"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const p = el.closest('.overflow-auto').getBoundingClientRect();
    return r.top < p.bottom && r.bottom > p.top;
  })()`);
  report(hitTitle && tabAfter === "gorunum" && sectionSeen === true, "tikla-sec", `sekme=${tabAfter} · metin bölümü görünür=${sectionSeen}`);

  const hitBar = await clickCard('.stage-card [data-part="bar"]');
  await sleep(300);
  const now = await store();
  const hl1 = now.charts.find((c) => c.id === now.activeId)?.options.highlight ?? [];
  report(hitBar && hl1.length === 1, "cubuk-vurgu", `vurgulanan=[${hl1.join(",")}]`);

  /* 9 — "Yeni grafik" kutusu panelin yanında açılıyor ve tamamı görünüyor */
  await evalIn(`[...document.querySelectorAll('aside.left button')].find((b) => b.textContent.includes('Yeni grafik')).click(); true`);
  await sleep(400);
  const pop = await rectOf(".kind-pop");
  const leftCol = await rectOf("aside.left");
  const popFacts = await evalIn(`(() => {
    const p = document.querySelector('.kind-pop');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const btns = [...p.querySelectorAll('.kind-btn')];
    const inside = btns.every((b) => {
      const q = b.getBoundingClientRect();
      return q.top >= r.top - 1 && q.bottom <= r.bottom + 1 && q.left >= r.left - 1 && q.right <= r.right + 1;
    });
    return {
      count: btns.length,
      scrolls: p.scrollHeight > p.clientHeight + 1,
      inside,
      onScreen: r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
    };
  })()`);
  report(
    !!pop &&
      !!popFacts &&
      pop.x >= leftCol.x + leftCol.w - 2 &&
      popFacts.count === 23 &&
      !popFacts.scrolls &&
      popFacts.inside &&
      popFacts.onScreen,
    "tur-kutusu-yan",
    `x=${Math.round(pop?.x ?? -1)} (panel biter ${Math.round(leftCol.x + leftCol.w)}) · ${popFacts?.count} tür · kayar=${popFacts?.scrolls} · hepsi içeride=${popFacts?.inside} · ekranda=${popFacts?.onScreen}`
  );
  await key("Escape", "Escape", 27);
  await sleep(300);

  /* 10 — listede satırı sürükleyerek sıralama */
  const idsBefore = await names();
  const first = idsBefore[0];
  const last = idsBefore[idsBefore.length - 1];
  const rFirst = await rectOf(`.chart-row[data-id="${first}"]`);
  const rLast = await rectOf(`.chart-row[data-id="${last}"]`);
  await mouse("mousePressed", rFirst.x + 70, rFirst.y + rFirst.h / 2);
  await mouse("mouseMoved", rFirst.x + 70, rFirst.y + rFirst.h / 2 + 14);
  await mouse("mouseMoved", rLast.x + 70, rLast.y + rLast.h - 2);
  await mouse("mouseReleased", rLast.x + 70, rLast.y + rLast.h - 2, 0);
  await sleep(600);
  const idsAfter = await names();
  const storedOrder = (await store()).charts.map((c) => c.id).join(",");
  report(
    idsAfter.length === idsBefore.length && idsAfter[idsAfter.length - 1] === first && storedOrder === idsAfter.join(","),
    "liste-surukle",
    `${idsBefore.join(",")} → ${idsAfter.join(",")} (kayıtlı ${storedOrder})`
  );

  /* 11 — sürüklerken metin seçilmiyor, satır havalanıyor */
  const idsNow = await names();
  const rA = await rectOf(`.chart-row[data-id="${idsNow[0]}"]`);
  const rB = await rectOf(`.chart-row[data-id="${idsNow[idsNow.length - 1]}"]`);
  await mouse("mousePressed", rA.x + 70, rA.y + rA.h / 2);
  await mouse("mouseMoved", rA.x + 70, rA.y + rA.h / 2 + 10);
  await mouse("mouseMoved", rB.x + 70, rB.y + rB.h / 2);
  await sleep(250);
  const mid = await evalIn(`(() => {
    const el = document.querySelector('[data-drag-row][data-dragging]');
    if (!el) return null;
    const t = getComputedStyle(el);
    const body = getComputedStyle(document.body);
    return {
      secim: (getSelection()?.toString() ?? '').length,
      kalkti: t.transform !== 'none',
      golge: t.boxShadow !== 'none',
      secimKapali: (body.userSelect || body.webkitUserSelect) === 'none',
    };
  })()`);
  await mouse("mouseReleased", rB.x + 70, rB.y + rB.h / 2, 0);
  await sleep(400);
  const secimSonra = await evalIn(`getComputedStyle(document.body).userSelect`);
  report(
    !!mid && mid.secim === 0 && mid.kalkti && mid.golge && mid.secimKapali && secimSonra !== "none",
    "surukleme-gorunum",
    `seçili metin ${mid?.secim ?? "?"} karakter · havada=${mid?.kalkti} · gölge=${mid?.golge} · seçim kapalı=${mid?.secimKapali} → bırakınca ${secimSonra}`
  );

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
