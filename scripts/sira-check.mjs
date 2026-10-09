// Grafikte elle sıralama — gerçek fare ve klavyeyle.
//
// Birim testi (`sira-test.mjs`) modelin doğru sırayı hesapladığını gösteriyor;
// bu betik kullanıcının o sırayı gerçekten **verebildiğini**: tıklamanın hangi
// öğeye düştüğü, sürüklemenin nereye bıraktığı, tuşların kime gittiği hep
// tarayıcının isabet testine ve olay sırasına bağlı.
//
//  1. Sütun: dışarıdan tık grafiği, ikinci tık öğeyi seçiyor — arkadaki bir
//     süsleme çubuğun altında dursa bile. Çubuğu sürüklemek sırayı değiştiriyor,
//     rengi öğeyle gidiyor, `Ctrl+Z` tek adımda geri alıyor.
//  2. Klavye: `→`, `Shift+←`, `Tab`, `Esc`, `Esc`.
//  3. "Büyükten küçüğe"deyken sahnede sürükleme o görüntüyü dondurup "Elle"ye geçiyor.
//  4. Sağ paneldeki listede satır sürüklemek.
//  5. Gösterge: seriyi sürüklemek seri sırasını değiştiriyor.
//  6. Halka: "Büyükten küçüğe" gerçekten diziyor (eskiden halkada hiç çalışmıyordu).
//  7. Sankey: düğüm yalnız kendi sütununda yer değiştiriyor.
//  8. Çizgi + tarih ekseni: öğe sıralaması kapalı, seri listesi açık.
//  9. Serbest yerleşim: çift tık öğeye iniyor, sürükleme çalışıyor.
// 10. Sayfa yenilenince sıra yerinde.
//
//   node scripts/sira-check.mjs
import { launch } from "./cdp.mjs";

const SHIFT = 8;
const CTRL = 2;

function kart(id, kind, data, options = {}, extra = {}) {
  return {
    id,
    name: id,
    kind,
    title: "",
    subtitle: "",
    note: "",
    data,
    paletteId: "varsayilan",
    colors: [],
    // `sira` bugünkü kayıt biçiminin parçası; olmasa `storage.ts` kartı elle
    // sıradan önceki bir kayıt sayıp halkanın `sort`'unu sıfırlardı (göç).
    options: { width: 960, height: 540, padding: 32, animate: false, legend: true, grid: false, xAxis: true, yAxis: false, titleSize: 22, chartInset: 8, hover: true, sira: { oge: [], seri: [], alt: {} }, ...options },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [], gruplar: {} },
    yerlesim: { serbest: false, kutular: {}, gizli: [] },
    ...extra,
  };
}

const alan = (c) => ({ version: 1, theme: "light", activeId: c.id, palettes: [], export: { scale: 1, background: "theme" }, charts: [c] });

const DORT = { columns: ["x", "Değer"], rows: [["a", "10"], ["b", "40"], ["c", "20"], ["d", "30"]] };

/** Çubukların arkasına, grafiğin üstüne yayılan arka katman süslemesi. */
const arkaSusleme = {
  asset: "sekil/dikdortgen",
  id: "arka",
  ad: "ARKA",
  renk: "",
  renk2: "",
  opaklik: 0.4,
  params: {},
  x: 40,
  y: 60,
  w: 880,
  h: 420,
  aci: 0,
  aynala: false,
  katman: "arka",
  gizli: false,
  kilit: false,
  grup: "",
};

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(26)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, mouse, key, sleep, send } = cdp;

  const secili = () => evalIn(`document.querySelector('.inspector-name')?.textContent ?? null`);
  const liste = (b = "oge") =>
    evalIn(`[...document.querySelectorAll('.sira-boyut[data-boyut="${b}"] .sira-satir')].map((e) => e.dataset.anahtar).join("|")`);
  /** Sahnedeki dikey çubukların soldan sağa sırası (yükseklik sırayı söylemez). */
  const cizim = () =>
    evalIn(`(() => { const s = new Map();
      for (const e of document.querySelectorAll('.inspect .stage-card [data-category]')) {
        const r = e.getBoundingClientRect(); const k = e.dataset.category;
        if (!s.has(k)) s.set(k, r.left); }
      return [...s].sort((a, b) => a[1] - b[1]).map((x) => x[0]).join("|"); })()`);
  const dolgu = (k) => evalIn(`document.querySelector('.inspect .stage-card [data-category="${k}"]')?.getAttribute('fill') ?? null`);
  /**
   * Öğenin üstünde, gerçekten ona isabet eden bir nokta — halkanın deliği
   * değil. Öğenin en büyük parçası seçiliyor (çubuk), eksen etiketi değil:
   * etikete tıklamak ekseni seçer.
   */
  const nokta = (k, attr = "oge") =>
    evalIn(`(() => { const kart = document.querySelector('.inspect .stage-card');
      const alan = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
      const els = [...kart.querySelectorAll('[data-${attr}], [data-category]')]
        .filter((e) => (e.dataset.${attr} ?? e.dataset.category) === ${JSON.stringify(k)} && !e.closest('[data-part="legend"]') && !e.closest('[data-part^="axis"]'))
        .sort((a, b) => alan(b) - alan(a));
      for (const el of els) { const r = el.getBoundingClientRect();
        for (let i = 2; i < 11; i++) for (let j = 2; j < 11; j++) {
          const x = r.left + (r.width * i) / 12, y = r.top + (r.height * j) / 12;
          const h = document.elementsFromPoint(x, y).find((n) => !n.closest('.decor-overlay'));
          if (h && (h === el || el.contains(h))) return { x, y }; } }
      return null; })()`);
  /** Öğenin en büyük parçasının sağ kenarının biraz ötesi — "bunun arkasına bırak". */
  const arkasi = (k) =>
    evalIn(`(() => { const kart = document.querySelector('.inspect .stage-card');
      let en = null, alan = -1;
      for (const e of kart.querySelectorAll('[data-category]')) { if (e.dataset.category !== ${JSON.stringify(k)}) continue;
        const r = e.getBoundingClientRect(); if (r.width * r.height > alan) { alan = r.width * r.height; en = r; } }
      return en ? { x: en.right + 12, y: en.top + Math.min(20, en.height / 2) } : null; })()`);
  const merkez = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.right, b: r.bottom }; })()`);

  const tikla = async (p, modifiers = 0) => {
    await mouse("mousePressed", p.x, p.y, 1, modifiers);
    await mouse("mouseReleased", p.x, p.y, 0, modifiers);
    await sleep(250);
  };
  const ciftTikla = async (p) => {
    for (const clickCount of [1, 2]) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", buttons: 1, clickCount });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", buttons: 0, clickCount });
    }
    await sleep(300);
  };
  const surukle = async (a, b, adim = 16) => {
    await mouse("mouseMoved", a.x, a.y, 0);
    await mouse("mousePressed", a.x, a.y, 1);
    for (let i = 1; i <= adim; i++) {
      await mouse("mouseMoved", a.x + ((b.x - a.x) * i) / adim, a.y + ((b.y - a.y) * i) / adim, 1);
      await sleep(16);
    }
    await sleep(120);
    await mouse("mouseReleased", b.x, b.y, 0);
    await sleep(450);
  };
  const grafigiSec = async () => {
    const p = await evalIn(`(() => { const r = document.querySelector('.inspect .stage-card [data-part="chart"]').getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; })()`);
    await tikla(p);
  };
  const tus = (k, code, vk, mod = 0) => key(k, code, vk, mod);

  /* 1 — sütun: içeri inmek, sürüklemek, renk, geri al */
  const sutun = kart("s", "bar", DORT, { colorBy: "category", legend: false });
  sutun.decor.nesneler = [arkaSusleme];
  await seed(alan(sutun));
  const a0 = await nokta("a");
  await tikla(a0);
  const ilkTik = await secili();
  await tikla(a0);
  const ikinciTik = await secili();
  report(ilkTik === "Grafik" && ikinciTik === "a", "ici-inmek", `1. tık=${ilkTik} · 2. tık=${ikinciTik} (arkada süsleme var)`);

  const renkOnce = await dolgu("a");
  await surukle(a0, await arkasi("c"));
  const sonra = await cizim();
  report(sonra === "b|c|a|d", "sahnede-surukle", `sıra ${sonra}`);
  report((await dolgu("a")) === renkOnce, "renk-ogeyle-gidiyor", `a: ${renkOnce} → ${await dolgu("a")}`);
  await tus("z", "KeyZ", 90, CTRL);
  await sleep(400);
  report((await cizim()) === "a|b|c|d", "tek-adimda-geri", `Ctrl+Z → ${await cizim()}`);

  /* 2 — klavye */
  await grafigiSec();
  await tikla(await nokta("a"));
  await tus("ArrowRight", "ArrowRight", 39);
  await sleep(250);
  const sag = await cizim();
  await tus("ArrowRight", "ArrowRight", 39, SHIFT);
  await sleep(250);
  const uca = await cizim();
  await tus("Tab", "Tab", 9);
  await sleep(250);
  const tab = await secili();
  await tus("Escape", "Escape", 27);
  await sleep(200);
  const esc1 = await secili();
  await tus("Escape", "Escape", 27);
  await sleep(200);
  const esc2 = await secili();
  report(
    sag === "b|a|c|d" && uca === "b|c|d|a" && tab === "b" && esc1 === "Grafik" && esc2 === "Slayt",
    "klavye",
    `→ ${sag} · Shift+→ ${uca} · Tab=${tab} · Esc=${esc1} · Esc=${esc2}`
  );

  /* 3 — değer modundan sahnede sürükleme */
  await seed(alan(kart("s", "bar", DORT, { legend: false })));
  await grafigiSec();
  await tikla(await merkez('.sira-mod [data-mod="desc"]'));
  const azalan = await cizim();
  await tikla(await nokta("a"));
  await surukle(await nokta("a"), await nokta("b"));
  const donmus = await cizim();
  const mod = await evalIn(`document.querySelector('.sira-boyut[data-boyut="oge"] .sira-mod-ad')?.textContent`);
  report(azalan === "b|d|c|a" && donmus === "a|b|d|c" && mod === "Elle", "degerden-elle", `↓ ${azalan} · sürükle ${donmus} · mod=${mod}`);

  /* 4 — paneldeki liste */
  const satirlar = await evalIn(`[...document.querySelectorAll('.sira-boyut[data-boyut="oge"] .sira-satir')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; })`);
  await surukle(satirlar[0], { x: satirlar[2].x, y: satirlar[2].y + satirlar[2].h * 0.4 });
  report((await liste()) === "b|d|a|c" && (await cizim()) === "b|d|a|c", "panel-listesi", `liste ${await liste()} · sahne ${await cizim()}`);

  /* 5 — gösterge: seriyi sürüklemek */
  await seed(alan(kart("s", "bar", { columns: ["x", "S1", "S2", "S3"], rows: [["a", "1", "2", "3"], ["b", "4", "5", "6"]] })));
  await grafigiSec();
  const g = await evalIn(`[...document.querySelectorAll('.inspect .stage-card [data-part="legend"] [data-anahtar]')].map((e) => { const r = e.getBoundingClientRect(); return { k: e.dataset.anahtar, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.right }; })`);
  await surukle(g[0], { x: g[2].r + 12, y: g[2].y });
  const seriler = await liste("seri");
  const gosterge = await evalIn(`[...document.querySelectorAll('.inspect .stage-card [data-part="legend"] [data-anahtar]')].map((e) => e.dataset.anahtar).join("|")`);
  report(seriler === "S2|S3|S1" && gosterge === "S2|S3|S1", "gosterge-seri", `seriler ${seriler} · gösterge ${gosterge}`);

  /* 6 — halka: büyükten küçüğe artık uygulanıyor */
  await seed(alan(kart("s", "ring", { columns: ["Etiket", "Değer", "Hedef"], rows: [["x", "10", ""], ["y", "40", ""], ["z", "20", ""]] }, { sort: "desc" })));
  const halkalar = await evalIn(`[...new Set([...document.querySelectorAll('.inspect .stage-card [data-oge]')].map((e) => e.dataset.oge))].join("|")`);
  report(halkalar === "y|z|x", "halka-siralaniyor", `halkalar ${halkalar}`);

  /* 7 — sankey: düğüm kendi sütununda */
  await seed(
    alan(
      kart("s", "sankey", {
        columns: ["Kaynak", "Hedef", "Değer"],
        rows: [["A", "X", "5"], ["B", "X", "3"], ["C", "Y", "4"], ["X", "Z", "8"], ["Y", "Z", "4"]],
      })
    )
  );
  await sleep(1200);
  await grafigiSec();
  const sutunlar = await evalIn(`[...document.querySelectorAll('.sira-parca')].map((e) => e.textContent).join("|")`);
  const kaynakSira = await liste();
  await tikla(await nokta("A"));
  await tus("ArrowDown", "ArrowDown", 40, SHIFT);
  await sleep(500);
  const sankeySonra = await liste();
  const ilkSutun = sankeySonra.split("|").filter((k) => ["A", "B", "C"].includes(k)).join("|");
  report(
    sutunlar.startsWith("1. sütun|2. sütun") && ilkSutun.endsWith("A") && sankeySonra.split("|").length === kaynakSira.split("|").length,
    "sankey-sutun-ici",
    `sütunlar ${sutunlar} · önce ${kaynakSira} · sonra ${sankeySonra}`
  );

  /* 8 — çizgi + tarih ekseni */
  await seed(alan(kart("s", "line", { columns: ["Ay", "S1", "S2"], rows: [["2025-01", "1", "2"], ["2025-02", "3", "4"]] })));
  await grafigiSec();
  const kapali = await evalIn(`!document.querySelector('.sira-boyut[data-boyut="oge"] .sira-liste') && !!document.querySelector('.sira-boyut[data-boyut="oge"] .sira-not')`);
  const seriAcik = await evalIn(`!!document.querySelector('.sira-boyut[data-boyut="seri"] .sira-liste')`);
  report(kapali && seriAcik, "zaman-ekseni", `öğe listesi kapalı=${kapali} · seri listesi açık=${seriAcik}`);

  /* 9 — serbest yerleşim */
  const serbest = kart("s", "bar", DORT, { legend: false }, {
    yerlesim: { serbest: true, kutular: { grafik: { x: 32, y: 40, w: 896, h: 460 } }, gizli: [] },
  });
  await seed(alan(serbest));
  const b0 = await nokta("b");
  await tikla(b0);
  const kutuSecim = await secili();
  await ciftTikla(b0);
  const ogeSecim = await secili();
  await surukle(b0, await arkasi("d"));
  const serbestSira = await cizim();
  report(kutuSecim === "Grafik" && ogeSecim === "b" && serbestSira === "a|c|d|b", "serbest-yerlesim", `tık=${kutuSecim} · çift tık=${ogeSecim} · sıra ${serbestSira}`);

  /* 10 — kalıcılık */
  await sleep(400);
  await send("Page.reload");
  await sleep(2500);
  report((await cizim()) === "a|c|d|b", "kayitli", `yeniden yüklendi: ${await cizim()}`);

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nsıralama beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
