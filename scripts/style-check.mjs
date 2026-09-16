// Stili kopyala / yapıştır — neyin taşındığı ve neyin taşınmadığı.
//
// Bu işin tamamı bir sınır çizgisinden ibaret: biçem nerede biter, içerik
// nerede başlar. Sınır yanlış çizilirse kimse fark etmez, yalnızca bir gün
// bir kartın ekseni başka bir kartın eksen adını taşımaya başlar. O yüzden
// kontrol iki yönlü: taşınması gerekenler taşındı mı, **taşınmaması**
// gerekenler yerinde kaldı mı.
//
//  1. Panele basıp yapıştırmak paleti, kart ölçüsünü, gösterge ayarını ve
//     süslemeyi ikinci karta geçiriyor.
//  2. Veri, tür, başlık, alt başlık ve dipnot yerinde kalıyor.
//  3. İçerik alanları (vurgu, eksen adı, değer aralığı, referans çizgisi)
//     kaynaktan taşınmıyor.
//  4. Süsleme derin kopyalanıyor: hedefteki nesneyi taşımak kaynağı oynatmıyor.
//  5. `Tümüne uygula` bütün öteki kartlara geçiriyor.
//  6. Ctrl+Alt+C / Ctrl+Alt+V kısayolları aynı işi yapıyor.
//
//   node scripts/style-check.mjs
import { launch } from "./cdp.mjs";

const NESNE = {
  asset: "sekil/kare",
  id: "s1",
  ad: "",
  renk: "",
  renk2: "",
  opaklik: 1,
  gizli: false,
  params: {},
  x: 100,
  y: 100,
  w: 80,
  h: 80,
  aci: 0,
  aynala: false,
  katman: "on",
  kilit: false,
  grup: "",
};

function kart(id, extra) {
  return {
    id,
    name: id,
    kind: "bar",
    title: `${id} başlık`,
    subtitle: `${id} alt`,
    note: `${id} dipnot`,
    data: { columns: ["x", "y"], rows: [["a", "1"], ["b", "2"]] },
    paletteId: "varsayilan",
    colors: [],
    options: {
      width: 960,
      height: 540,
      padding: 32,
      animate: false,
      legend: true,
      grid: false,
      xAxis: true,
      yAxis: true,
      titleSize: 22,
      chartInset: 8,
      hover: false,
      highlight: [],
      xTitle: "",
      yMin: null,
      refLines: [],
    },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [], gruplar: {} },
    yerlesim: { serbest: false, kutular: {}, gizli: [] },
    ...extra,
  };
}

function workspace() {
  const kaynak = kart("kaynak", {
    paletteId: "varsayilan",
    colors: ["#ff0066", "#00aa88"],
    options: {
      ...kart("x").options,
      width: 800,
      height: 600,
      legend: false,
      titleSize: 30,
      barRadius: 14,
      // İçerik: hiçbiri hedefe geçmemeli.
      highlight: ["a"],
      xTitle: "KAYNAK EKSENİ",
      yMin: 5,
      refLines: [{ id: "r1", value: 1, label: "hedef", color: "", dash: true }],
    },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [NESNE], gruplar: {} },
  });
  const hedef = kart("hedef");
  const ucuncu = kart("ucuncu");
  return {
    version: 1,
    theme: "light",
    activeId: "kaynak",
    palettes: [],
    export: { scale: 1, background: "theme" },
    charts: [kaynak, hedef, ucuncu],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(18)} ${detail}`);
};

const cdp = await launch();
try {
  const { evalIn, seed, sleep, key } = cdp;
  await seed(workspace());

  const store = () => evalIn(`JSON.parse(localStorage.getItem("data-gorsel.workspace.v1"))`);
  const kartAl = async (id) => (await store()).charts.find((c) => c.id === id);
  const secKart = async (id) => {
    await evalIn(`[...document.querySelectorAll('.chart-row')].find((r) => r.dataset.id === ${JSON.stringify(id)})?.click(); true`);
    await sleep(450);
  };
  const dugme = async (yazi) => {
    const ok = await evalIn(`(() => { const b = [...document.querySelectorAll('aside.right button')]
      .find((x) => x.textContent.trim() === ${JSON.stringify(yazi)});
      if (!b || b.disabled) return false; b.click(); return true; })()`);
    await sleep(600);
    return ok;
  };
  /** Hiçbir şey seçili değil — Stil bölümü ancak slayt seçiliyken görünür. */
  const slayt = async () => {
    await key("Escape", "Escape", 27);
    await sleep(350);
  };

  /* 1 + 2 + 3 — kopyala, yapıştır, sınırı kontrol et */
  await slayt();
  const kopyaOk = await dugme("Stili kopyala");
  await secKart("hedef");
  await slayt();
  const yapistirOk = await dugme("Yapıştır");

  const hed = await kartAl("hedef");

  const bicemGecti =
    hed.colors.join() === "#ff0066,#00aa88" &&
    hed.options.width === 800 &&
    hed.options.height === 600 &&
    hed.options.legend === false &&
    hed.options.titleSize === 30 &&
    hed.options.barRadius === 14 &&
    hed.decor.nesneler.length === 1;
  report(kopyaOk && yapistirOk && bicemGecti, "bicem-gecti", `renk=${hed.colors.join(",")} · ${hed.options.width}×${hed.options.height} · gösterge=${hed.options.legend} · süsleme=${hed.decor.nesneler.length}`);

  const icerikKaldi =
    hed.title === "hedef başlık" &&
    hed.subtitle === "hedef alt" &&
    hed.note === "hedef dipnot" &&
    hed.kind === "bar" &&
    JSON.stringify(hed.data) === JSON.stringify(kart("hedef").data);
  report(icerikKaldi, "icerik-kaldi", `başlık="${hed.title}" · dipnot="${hed.note}"`);

  const sinir =
    hed.options.highlight.length === 0 &&
    hed.options.xTitle === "" &&
    hed.options.yMin === null &&
    hed.options.refLines.length === 0;
  report(
    sinir,
    "icerik-alanlari",
    `vurgu=${JSON.stringify(hed.options.highlight)} · eksen adı="${hed.options.xTitle}" · yMin=${hed.options.yMin} · referans=${hed.options.refLines.length}`
  );

  /* 4 — süsleme derin kopyalandı mı */
  await evalIn(`(() => {
    const k = "data-gorsel.workspace.v1"; const w = JSON.parse(localStorage.getItem(k));
    w.charts.find((c) => c.id === "hedef").decor.nesneler[0].x = 400;
    localStorage.setItem(k, JSON.stringify(w)); location.reload(); return true; })()`);
  await sleep(2500);
  const kaynakSonra = await kartAl("kaynak");
  const hedefSonra = await kartAl("hedef");
  report(
    kaynakSonra.decor.nesneler[0].x === 100 && hedefSonra.decor.nesneler[0].x === 400,
    "derin-kopya",
    `kaynak x=${kaynakSonra.decor.nesneler[0].x} · hedef x=${hedefSonra.decor.nesneler[0].x}`
  );

  /* 5 — tümüne uygula */
  await secKart("kaynak");
  await slayt();
  const hepsiOk = await dugme("Tümüne uygula");
  const sonrasi = (await store()).charts;
  const hepsiGecti = sonrasi.every((c) => c.options.width === 800 && c.colors.join() === "#ff0066,#00aa88");
  const adlarKaldi = sonrasi.map((c) => c.title).join("|") === "kaynak başlık|hedef başlık|ucuncu başlık";
  report(hepsiOk && hepsiGecti && adlarKaldi, "tumune-uygula", `${sonrasi.length} kart · başlıklar korundu=${adlarKaldi}`);

  /* 6 — Ctrl+Alt+C / Ctrl+Alt+V */
  // Üçüncü karta ayrı bir ölçü verip kaynaktan kısayolla geri alıyoruz.
  await evalIn(`(() => {
    const k = "data-gorsel.workspace.v1"; const w = JSON.parse(localStorage.getItem(k));
    w.charts.find((c) => c.id === "ucuncu").options.width = 1200;
    localStorage.setItem(k, JSON.stringify(w)); location.reload(); return true; })()`);
  await sleep(2500);
  await secKart("kaynak");
  await slayt();
  await key("c", "KeyC", 67, 3); // CDP değiştirici bitleri: alt=1, ctrl=2, meta=4, shift=8
  await sleep(400);
  const panoYazisi = await evalIn(`[...document.querySelectorAll('aside.right p')].map((p) => p.textContent).find((t) => t.includes('Panoda'))`);
  await secKart("ucuncu");
  await slayt();
  await key("v", "KeyV", 86, 3);
  await sleep(700);
  const uc = await kartAl("ucuncu");
  report(uc.options.width === 800 && !!panoYazisi, "kisayollar", `panoda="${(panoYazisi ?? "").slice(0, 28)}…" · genişlik ${uc.options.width}`);

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nstil panosu beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
