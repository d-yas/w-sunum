// Panel and stage behaviour, driven through the real UI.
//
// These eight have no unit-testable surface — they only exist as the result of
// a click reaching React state and React state reaching the card:
//
//  1. Delete on a card part hides it without destroying the text.
//  2. "[" walks a decoration down the visual stack, across the chart, and
//     stops at the bottom.
//  3. A custom palette reaches the live card *and* the offscreen export card.
//     (It did not at first: renderStatic's memo dependency list was missing
//     ws.palettes, so exports kept the palette the closure was built with.)
//  4. A background light's centre can be dragged on the stage.
//  5. Dragging a row in the layer list reorders it, and dragging it past the
//     "Grafik" divider flips the item between the front and back stacks.
//  6. Selecting a decoration brings up its own properties in the inspector.
//  7. The shape family is in the gallery and lands on the card.
//  8. Two shapes can be grouped: clicking one selects both, and they move
//     together as one.
//
//   node scripts/ui-check.mjs
import { launch } from "./cdp.mjs";

function workspace() {
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
        kind: "bar",
        title: "Başlık",
        subtitle: "Alt başlık",
        note: "Dipnot",
        data: { columns: ["x", "y"], rows: [["a", "1"], ["b", "2"]] },
        paletteId: "varsayilan",
        colors: [],
        options: {
          width: 960,
          height: 540,
          padding: 32,
          animate: false,
          legend: false,
          grid: false,
          xAxis: false,
          yAxis: false,
          titleSize: 22,
          chartInset: 8,
          hover: true,
        },
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
        yerlesim: { serbest: false, kutular: {}, gizli: [] },
      },
    ],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(20)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, mouse, sleep, key } = cdp;
  await seed(workspace());

  const chart = () => evalIn(`JSON.parse(localStorage.getItem("data-gorsel.workspace.v1")).charts[0]`);
  const rectOf = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const clickAt = async (sel) => {
    const r = await rectOf(sel);
    if (!r) return false;
    await mouse("mousePressed", r.x + r.w / 2, r.y + r.h / 2);
    await mouse("mouseReleased", r.x + r.w / 2, r.y + r.h / 2, 0);
    return true;
  };
  /** Araç çubuğundaki bir kutuyu açar/kapatır. Düğmeyle kapatmak seçimi korur. */
  const togglePop = async (k) => {
    await evalIn(`document.querySelector('[data-tool=${JSON.stringify(k)}]').click(); true`);
    await sleep(450);
  };
  /** Hiçbir şey seçili değil — müfettiş slaytın ayarlarını gösterir. */
  const selectSlide = async () => {
    await key("Escape", "Escape", 27);
    await sleep(350);
  };
  const secili = () => evalIn(`document.querySelector('.inspector-name')?.textContent`);
  const bolumler = () => evalIn(`[...document.querySelectorAll('aside.right [data-section]')].map((e) => e.dataset.section)`);

  /* 1 — Delete hides a card part, keeps its text */
  await evalIn(`document.querySelector('[data-tool="serbest"]').click(); true`);
  await sleep(800);
  await clickAt('.decor-box[data-slot="dipnot"]');
  await sleep(300);
  const selected = await evalIn(`!!document.querySelector('.decor-box[data-slot="dipnot"][data-selected]')`);
  await key("Delete", "Delete", 46);
  await sleep(500);
  const afterDel = await chart();
  report(
    selected && afterDel.yerlesim.gizli.includes("dipnot") && afterDel.note === "Dipnot",
    "del-kart-parcasi",
    `gizli=${JSON.stringify(afterDel.yerlesim.gizli)}, metin korundu=${afterDel.note === "Dipnot"}`
  );
  report(await evalIn(`!document.querySelector('.stage-card [data-slot="dipnot"]')`), "kart-parcasi-gizli", "karttan kalktı");

  /* 2 — "[" walks an item down the stack and stops at the bottom */
  await togglePop("ekle");
  await evalIn(`(() => { const g = [...document.querySelectorAll('.seg')].find((s) => s.textContent.includes('İkon'));
    [...g.querySelectorAll('button')].find((b) => b.textContent === 'İkon').click(); return true; })()`);
  await sleep(300);
  // One at a time: the gallery re-renders after each add.
  await evalIn(`document.querySelectorAll('.decor-cell')[0].click(); true`);
  await sleep(500);
  await evalIn(`document.querySelectorAll('.decor-cell')[1].click(); true`);
  await sleep(500);
  // Düğmeyle kapat: Esc seçimi de düşürürdü, "[" seçili nesneyi taşıyor.
  await togglePop("ekle");
  const show = (c) => c.decor.nesneler.map((n) => `${n.asset.split("/")[1]}:${n.katman}`).join(" ");
  const steps = [show(await chart())];
  for (let i = 0; i < 3; i++) {
    await key("[", "BracketLeft", 219);
    await sleep(350);
    steps.push(show(await chart()));
  }
  const twoItems = (await chart()).decor.nesneler.length === 2;
  // Three distinct states: swap, cross the chart, then hit the floor and hold.
  report(twoItems && new Set(steps).size >= 3 && steps[2] === steps[3], "katman-kisayol", steps.join("  →  "));

  /* 6 — seçili süslemenin kendi özellikleri müfettişte */
  const adNesne = await secili();
  const bolNesne = await bolumler();
  report(
    bolNesne.includes("secili") && bolNesne.includes("nesneler") && !bolNesne.includes("kart"),
    "nesne-mufettis",
    `seçili="${adNesne}" · [${bolNesne.join(",")}]`
  );

  /* 3 — a custom palette reaches the card and the export */
  await togglePop("renk");
  await evalIn(`[...document.querySelectorAll('.tool-pop button')].find((x) => x.textContent.includes('Palet ekle')).click(); true`);
  await sleep(600);
  const named = await evalIn(`(() => {
    const f = [...document.querySelectorAll('label.field')].find((l) => l.textContent.trim().startsWith('Ad'));
    if (!f) return false;
    const i = f.querySelector('input.inp');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Kurumsal');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(500);
  await evalIn(`(() => {
    const sw = document.querySelectorAll('.swatch');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(sw[0], '#ff0066');
    sw[0].dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
  const cssVar = await evalIn(`getComputedStyle(document.querySelector('.stage-card')).getPropertyValue('--chart-1').trim()`);
  const png = await evalIn(`window.__veriGorsel.snapshotDataUrl(1)`);
  const barPx = await evalIn(
    `(async () => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = ${JSON.stringify(png)}; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(Math.round(img.width * 0.3), Math.round(img.height * 0.7), 1, 1).data;
      return [d[0], d[1], d[2]];
    })()`
  );
  const stored = await evalIn(`JSON.parse(localStorage.getItem("data-gorsel.workspace.v1")).palettes[0]`);
  report(
    named && stored?.name === "Kurumsal" && cssVar.toLowerCase() === "#ff0066" && barPx[0] > 200 && barPx[1] < 60,
    "ozel-palet",
    `ad="${stored?.name}", ekran ${cssVar}, PNG çubuk rgb=${barPx.join(",")}`
  );
  await togglePop("renk");

  /* 4 — drag a background light's centre */
  await selectSlide();
  await evalIn(`(() => {
    const s = [...document.querySelectorAll('aside.right select')].find((el) => [...el.options].some((o) => o.value === 'isik/kure'));
    if (!s) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'isik/kure');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
  const dot = await rectOf(".decor-anchor");
  if (!dot) {
    report(false, "isik-surukle", "sahnede tutamaç yok");
  } else {
    const p0 = (await chart()).decor.zemin.isik.params;
    const dx = dot.x + dot.w / 2;
    const dy = dot.y + dot.h / 2;
    await mouse("mousePressed", dx, dy);
    await mouse("mouseMoved", dx - 200, dy + 120);
    await mouse("mouseReleased", dx - 200, dy + 120, 0);
    await sleep(600);
    const p1 = (await chart()).decor.zemin.isik.params;
    report(p1.x !== p0.x && p1.y !== p0.y, "isik-surukle", `x ${p0.x}→${p1.x}, y ${p0.y}→${p1.y}`);
  }

  /* 5 — katman listesinde satırı sürükleyerek sıra */
  await selectSlide();
  // Müfettiş kaydırılmış olabilir; satırlar görünür alana gelmeden fare
  // koordinatları başka bir öğeye düşer.
  await evalIn(`document.querySelector('.decor-row[data-nesne-id]')?.scrollIntoView({ block: "center" }); true`);
  await sleep(400);
  const layerRow = (i) =>
    evalIn(`(() => { const rs = [...document.querySelectorAll('.decor-row[data-nesne-id]')]; const e = rs[${i}];
      if (!e) return null; const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, id: e.dataset.nesneId }; })()`);
  const hasDivider = await evalIn(`!!document.querySelector('.decor-row-grafik')`);
  const topRow = await layerRow(0);
  const nextRow = await layerRow(1);
  if (!topRow || !nextRow) {
    report(false, "katman-surukle", "listede iki satır yok");
  } else {
    const before = show(await chart());
    await mouse("mousePressed", topRow.x + 20, topRow.y + topRow.h / 2);
    await mouse("mouseMoved", topRow.x + 20, topRow.y + topRow.h / 2 + 10);
    await mouse("mouseMoved", nextRow.x + 20, nextRow.y + nextRow.h - 2);
    await mouse("mouseReleased", nextRow.x + 20, nextRow.y + nextRow.h - 2, 0);
    await sleep(700);
    const after = show(await chart());
    const nowTop = await evalIn(`document.querySelector('.decor-row[data-nesne-id]')?.dataset.nesneId`);
    report(hasDivider && after !== before && nowTop !== topRow.id, "katman-surukle", `grafik ayıracı=${hasDivider} · ${before}  →  ${after}`);
  }

  /* 7 — şekil ailesi galeride, karta düşüyor */
  // Serbest yerleşim kapatılıyor: açıkken "grafik" kutusu kartın ortasını
  // kaplıyor ve altındaki şekli tutamıyorsunuz.
  await evalIn(`document.querySelector('[data-tool="serbest"]').click(); true`);
  await sleep(500);
  await togglePop("ekle");
  const sekilVar = await evalIn(`(() => {
    const g = [...document.querySelectorAll('.tool-pop .seg')].find((x) => x.textContent.includes('Şekil'));
    if (!g) return 0;
    [...g.querySelectorAll('button')].find((b) => b.textContent === 'Şekil').click();
    return 1;
  })()`);
  await sleep(450);
  const sekiller = await evalIn(`[...document.querySelectorAll('.tool-pop .decor-cell span')].map((e) => e.textContent)`);
  await evalIn(`document.querySelectorAll('.tool-pop .decor-cell')[0].click(); true`);
  await sleep(500);
  await evalIn(`document.querySelectorAll('.tool-pop .decor-cell')[1].click(); true`);
  await sleep(500);
  await togglePop("ekle");
  const eklenen = (await chart()).decor.nesneler.filter((n) => n.asset.startsWith("sekil/"));
  report(
    !!sekilVar && sekiller.includes("Kare") && sekiller.includes("Daire") && eklenen.length === 2,
    "sekil-ailesi",
    `galeride ${sekiller.length} şekil (${sekiller.slice(0, 4).join(", ")}…) · karta ${eklenen.length} düştü`
  );

  /* 8 — iki şekli gruplamak: birlikte taşınırlar, birine tıklamak ikisini seçer */
  const idler = eklenen.map((n) => n.id);
  await evalIn(`(() => {
    const rs = [...document.querySelectorAll('.decor-row[data-nesne-id]')];
    const hedef = rs.filter((r) => [${idler.map((i) => JSON.stringify(i)).join(",")}].includes(r.dataset.nesneId));
    if (hedef.length < 2) return false;
    hedef[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    hedef[1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    return true;
  })()`);
  await sleep(500);
  const ikiSecili = await secili();
  await evalIn(`[...document.querySelectorAll('aside.right button')].find((b) => b.textContent === 'Grupla')?.click(); true`);
  await sleep(600);
  const gruplu = (await chart()).decor.nesneler.filter((n) => idler.includes(n.id));
  const ortakGrup = gruplu.length === 2 && gruplu[0].grup !== "" && gruplu[0].grup === gruplu[1].grup;

  // Tek bir üyeye tıklamak grubun tamamını seçer.
  await evalIn(`document.querySelector('.decor-row[data-nesne-id=${JSON.stringify(idler[0])}]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); true`);
  await sleep(450);
  const grupSecimi = await secili();

  // Ve birlikte taşınırlar.
  const oncekiler = gruplu.map((n) => ({ id: n.id, x: n.x, y: n.y }));
  const kutu = await evalIn(`(() => { const e = document.querySelector('.decor-box[data-grup]'); if (!e) return null;
    const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  if (kutu) {
    await mouse("mousePressed", kutu.x + kutu.w / 2, kutu.y + kutu.h / 2);
    await mouse("mouseMoved", kutu.x + kutu.w / 2 + 60, kutu.y + kutu.h / 2 + 40);
    await mouse("mouseReleased", kutu.x + kutu.w / 2 + 60, kutu.y + kutu.h / 2 + 40, 0);
    await sleep(600);
  }
  const sonrakiler = (await chart()).decor.nesneler.filter((n) => idler.includes(n.id));
  const kaymalar = sonrakiler.map((n) => {
    const o = oncekiler.find((q) => q.id === n.id);
    return o ? `${Math.round(n.x - o.x)},${Math.round(n.y - o.y)}` : "?";
  });
  const birlikte = !!kutu && kaymalar.length === 2 && kaymalar[0] === kaymalar[1] && kaymalar[0] !== "0,0";
  report(
    ikiSecili === "2 nesne" && ortakGrup && grupSecimi === "2 nesne" && birlikte,
    "gruplama",
    `iki seçim="${ikiSecili}" · ortak grup=${ortakGrup} · üyeye tık="${grupSecimi}" · kayma [${kaymalar.join(" | ")}]`
  );

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\npanel ve sahne beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
