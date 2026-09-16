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
//  6. İki bölme tutamacı da (grafikler/katmanlar, katmanlar/veri) kendi
//     yüksekliğini kalıcı kaydediyor.
//  7. "Yeni grafik" kutusu panelin yanına açılıyor ve 23 türün hepsi
//     kaydırmadan görünüyor (eskiden yukarı taşıp kesiliyordu).
//  8. Satırı sürüklemek listeyi gerçekten yeniden sıralıyor.
//  9. Sürükleme sırasında metin seçimi kapalı ve satır havalanmış görünüyor.
// 10. Sürüklerken aradaki satırlar kayıp bırakılacak yeri açıyor.
// 11. Veri alanı tam ekrana açılıp Esc ile geri dönüyor.
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
  // CDP değiştirici maskesi: Alt=1, Ctrl=2, Meta=4, Shift=8.
  const clickCard = async (sel, mod = 0) => {
    const r = await rectOf(sel);
    if (!r) return false;
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, modifiers: mod });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, modifiers: mod });
    await sleep(400);
    return true;
  };

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

  /* 6 — iki bölme tutamağı da kendi yüksekliğini kaydediyor */
  // Sol sütun üç bölmeli: grafikler, katmanlar, veri. Mutlak bir eşik yerine
  // artış ölçülüyor — varsayılan yükseklikler değiştiğinde test kırılmasın.
  const bolmeler = [
    { i: 0, anahtar: "listHeight" },
    { i: 1, anahtar: "layerHeight" },
  ];
  // Yükseklik tercihlerden değil DOM'dan ölçülüyor: tercih dosyası ilk
  // sürüklemeden önce hiç yazılmamış olabiliyor ve karşılaştıracak bir
  // "önce" değeri bulunmuyordu.
  const bolmeBoyu = (i) =>
    evalIn(`(() => { const e = document.querySelectorAll('.split-handle')[${i}]?.previousElementSibling;
      return e ? Math.round(e.getBoundingClientRect().height) : null; })()`);
  for (const b of bolmeler) {
    const once = await bolmeBoyu(b.i);
    const h = await evalIn(`(() => { const e = document.querySelectorAll('.split-handle')[${b.i}]; if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    if (!h || once == null) {
      report(false, `bolme-${b.anahtar}`, "tutamaç yok");
      continue;
    }
    await mouse("mousePressed", h.x + h.w / 2, h.y + h.h / 2);
    await mouse("mouseMoved", h.x + h.w / 2, h.y + 60);
    await mouse("mouseReleased", h.x + h.w / 2, h.y + 60, 0);
    await sleep(400);
    const sonra = await bolmeBoyu(b.i);
    const kayitli = (await prefs())?.[b.anahtar];
    report(
      sonra - once > 40 && kayitli === sonra,
      `bolme-${b.anahtar}`,
      `${once} → ${sonra} px, kayıtlı ${kayitli}`
    );
  }

  /* 7 — müfettiş hiçbir şey seçili değilken slaytın ayarlarını gösteriyor */
  await key("Escape", "Escape", 27);
  await sleep(350);
  const slaytBolum = await evalIn(`[...document.querySelectorAll('aside.right [data-section]')].map((e) => e.dataset.section)`);
  const slaytAd = await evalIn(`document.querySelector('.inspector-name')?.textContent`);
  report(
    slaytAd === "Slayt" && slaytBolum.includes("kart") && slaytBolum.includes("zemin") && !slaytBolum.includes("tur"),
    "slayt-mufettis",
    `seçili="${slaytAd}" · [${slaytBolum.join(",")}]`
  );

  /* 8 — tıkla-seç: karttaki parça müfettişte kendi ayarını açıyor */
  const secili = () => evalIn(`document.querySelector('.inspector-name')?.textContent`);
  const bolumler = () => evalIn(`[...document.querySelectorAll('aside.right [data-section]')].map((e) => e.dataset.section)`);

  const hitTitle = await clickCard('.stage-card [data-part="title"]');
  const adTitle = await secili();
  const bolTitle = await bolumler();
  report(
    hitTitle && adTitle === "Başlık" && bolTitle.includes("metin") && !bolTitle.includes("tur"),
    "tikla-sec",
    `seçili="${adTitle}" · bölümler=[${bolTitle.join(",")}]`
  );

  /* 9 — düz tık grafiği seçer, Alt+tık kategoriyi vurgular */
  const hitBar = await clickCard('.stage-card [data-part="bar"]');
  const adBar = await secili();
  const bolBar = await bolumler();
  await clickCard('.stage-card [data-part="bar"]', 1);
  await sleep(400);
  const now = await store();
  const hl1 = now.charts.find((c) => c.id === now.activeId)?.options.highlight ?? [];
  report(
    hitBar && adBar === "Grafik" && bolBar.includes("tur") && hl1.length === 1,
    "cubuk-vurgu",
    `düz tık="${adBar}" (bölümler ${bolBar.length}) · Alt+tık vurgu=[${hl1.join(",")}]`
  );

  /* 10 — araç çubuğu: ekle / renk / dışa aktar kutuları */
  const popIcerik = async (k) => {
    await clickSel(`[data-tool="${k}"]`);
    await sleep(400);
    const v = await evalIn(`(() => { const p = document.querySelector('[data-pop=${JSON.stringify(k)}]');
      if (!p) return null;
      return { hucre: p.querySelectorAll('.decor-cell').length,
               bolum: [...p.querySelectorAll('[data-section]')].map((e) => e.dataset.section) }; })()`);
    await key("Escape", "Escape", 27);
    await sleep(250);
    return v;
  };
  const ekle = await popIcerik("ekle");
  const renk = await popIcerik("renk");
  const disa = await popIcerik("disa");
  report(
    !!ekle && ekle.hucre > 0 && !!renk && renk.bolum.includes("palet") && !!disa && disa.bolum.includes("png"),
    "arac-cubugu",
    `ekle ${ekle?.hucre} galeri hücresi · renk [${renk?.bolum.join(",")}] · dışa [${disa?.bolum.join(",")}]`
  );

  /* 11 — serbest yerleşim araç çubuğundan açılıyor */
  const aktifYerlesim = async () => {
    const w = await store();
    return w.charts.find((c) => c.id === w.activeId)?.yerlesim;
  };
  await clickSel('[data-tool="serbest"]');
  await sleep(700);
  const serbestAcik = await aktifYerlesim();
  await clickSel('[data-tool="serbest"]');
  await sleep(500);
  const serbestKapali = (await aktifYerlesim())?.serbest;
  report(
    serbestAcik?.serbest === true && Object.keys(serbestAcik?.kutular ?? {}).length >= 2 && serbestKapali === false,
    "serbest-arac",
    `açık=${serbestAcik?.serbest}, kutu=${Object.keys(serbestAcik?.kutular ?? {}).join(",")} → kapalı=${serbestKapali}`
  );

  /* 12 — "Yeni grafik" kutusu panelin yanında açılıyor ve tamamı görünüyor */
  const btnR = await evalIn(`(() => { const b = [...document.querySelectorAll('aside.left button')].find((x) => x.textContent.includes('Yeni grafik'));
    const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; })()`);
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
      popFacts.onScreen &&
      pop.y >= btnR.y - 2,
    "tur-kutusu-yan",
    `x=${Math.round(pop?.x ?? -1)} (panel biter ${Math.round(leftCol.x + leftCol.w)}) · üst ${Math.round(pop?.y ?? -1)} ≥ düğme ${Math.round(btnR.y)} · ${popFacts?.count} tür · kayar=${popFacts?.scrolls} · hepsi içeride=${popFacts?.inside} · ekranda=${popFacts?.onScreen}`
  );
  await key("Escape", "Escape", 27);
  await sleep(300);

  /* 13 — listede satırı sürükleyerek sıralama */
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

  /* 14 — sürüklerken metin seçilmiyor, satır havalanıyor */
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

  /* 15 — sürüklerken aradaki satırlar kayıp yer açıyor */
  const ids12 = await names();
  const rTop = await rectOf(`.chart-row[data-id="${ids12[0]}"]`);
  const rMid = await rectOf(`.chart-row[data-id="${ids12[1]}"]`);
  const rEnd = await rectOf(`.chart-row[data-id="${ids12[ids12.length - 1]}"]`);
  const yuva = Math.round(rMid.y - rTop.y);
  await mouse("mousePressed", rTop.x + 70, rTop.y + rTop.h / 2);
  await mouse("mouseMoved", rTop.x + 70, rTop.y + rTop.h / 2 + 10);
  await mouse("mouseMoved", rEnd.x + 70, rEnd.y + rEnd.h - 2);
  await sleep(450);
  const kayma = await evalIn(`(() => {
    const el = document.querySelector('.chart-row[data-id=${JSON.stringify(ids12[1])}]');
    if (!el) return null;
    return Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
  })()`);
  await mouse("mouseReleased", rEnd.x + 70, rEnd.y + rEnd.h - 2, 0);
  await sleep(500);
  report(kayma === -yuva, "kayan-komsu", `komşu ${kayma}px kaydı, yuva ${yuva}px`);

  /* 16 — veri alanı tam ekran olup geri dönüyor */
  const vp = await evalIn(`({ w: innerWidth, h: innerHeight })`);
  const acildi = await clickSel("[data-veri-tam]");
  await sleep(450);
  const tam = await rectOf(".veri-panel");
  await key("Escape", "Escape", 27);
  await sleep(450);
  const kucuk = await rectOf(".veri-panel");
  report(
    acildi && !!tam && !!kucuk && tam.w >= vp.w - 2 && tam.h >= vp.h - 2 && tam.x <= 1 && tam.y <= 1 && kucuk.w < vp.w / 2,
    "veri-tam-ekran",
    `tam ${Math.round(tam?.w ?? -1)}×${Math.round(tam?.h ?? -1)} → geri ${Math.round(kucuk?.w ?? -1)}×${Math.round(kucuk?.h ?? -1)}`
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
