// Sahnede süsleme seçmek — gerçek fare olaylarıyla.
//
// Bu üç davranışın hiçbiri birim testiyle yakalanamıyor: üçü de bir tıklamanın
// hangi DOM düğümüne düştüğüne, yani tarayıcının hit-test'ine bağlı.
//
//  1. Serbest yerleşim **açıkken** grafiğin üstündeki bir ok seçilebiliyor.
//     Eskiden seçilemiyordu: `.decor-box` kutuları `z-index: auto` kardeşti,
//     yani tıklamayı DOM sırası belirliyordu, ve `slot:grafik` kutusu
//     `handles` dizisinin sonunda üretildiği için — görselde `zIndex: 1` ile
//     en altta durmasına rağmen — hit-test'te en üstteydi. Grafiğin üstüne
//     düşen her süsleme tıklanamaz oluyordu.
//  2. Üst üste binen iki süslemede `Ctrl`+tık alttakine iniyor. Böyle bir
//     jest hiç yoktu; yutulan bir tıklamadan kurtulmanın tek yolu katman
//     paneliydi.
//  3. Kilitli bir nesnenin altındaki nesne seçilebiliyor. Kilitli kutu
//     `pointer-events: none` olmadan tıklamayı yutuyordu, yani "yoldan
//     çekilsin diye kilitle" jesti tersine çalışıyordu.
//
//   node scripts/secim-check.mjs
import { launch } from "./cdp.mjs";

const nesne = (id, asset, x, y, w, h, extra = {}) => ({
  asset,
  id,
  ad: id.toUpperCase(),
  renk: "",
  renk2: "",
  opaklik: 1,
  params: {},
  x,
  y,
  w,
  h,
  aci: 0,
  aynala: false,
  katman: "on",
  gizli: false,
  kilit: false,
  grup: "",
  ...extra,
});

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
        subtitle: "",
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
        decor: {
          zemin: { doku: null, isik: null, cerceve: null },
          // Depo dipten tepeye. Üç bölge, üç vaka:
          //   A) alt/üst — üst üste binen iki kutu (Ctrl+tık)
          //   B) ok      — grafik kutusunun tam üstünde
          //   C) hedef/kilitli — kilitli kutu hedefin üstünü örtüyor
          nesneler: [
            nesne("alt", "sekil/kare", 40, 40, 150, 110),
            nesne("ust", "sekil/daire", 80, 70, 150, 110),
            nesne("ok", "ok/duz", 360, 250, 240, 36),
            nesne("hedef", "sekil/ucgen", 740, 400, 140, 100),
            nesne("kilitli", "sekil/dikdortgen", 700, 360, 240, 160, { kilit: true }),
          ],
          gruplar: {},
        },
        // Serbest yerleşim AÇIK: `slot:grafik` kutusu ancak böyle doğuyor ve
        // 1. vaka ancak o kutu varken anlamlı.
        yerlesim: {
          serbest: true,
          kutular: {
            baslik: { x: 32, y: 32, w: 896, h: 40 },
            grafik: { x: 32, y: 100, w: 896, h: 380 },
            dipnot: { x: 32, y: 492, w: 896, h: 16 },
          },
          gizli: [],
        },
      },
    ],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(20)} ${detail}`);
};

const CTRL = 2;

const cdp = await launch();
try {
  const { evalIn, seed, mouse, sleep } = cdp;
  await seed(workspace());
  await sleep(400);

  /**
   * Kart uzayındaki bir noktanın ekran karşılığı.
   *
   * Kutuları `data-id` ile aramıyoruz bilerek: o öznitelik bu düzeltmeyle
   * geldi, oysa testin **düzeltmeden önceki** kodda da koşup düşmesi gerek —
   * yoksa neyi koruduğunu kanıtlamış olmaz.
   */
  const nokta = (cx, cy) =>
    evalIn(`(() => { const e = document.querySelector('.stage-card'); if (!e) return null;
      const r = e.getBoundingClientRect(); const s = r.width / 960;
      return { x: r.left + ${cx} * s, y: r.top + ${cy} * s }; })()`);

  /** Seçili öğenin adı. Müfettiş her iki sürümde de aynı yeri yazıyor. */
  const secili = () => evalIn(`document.querySelector('.inspector-name')?.textContent ?? null`);

  const tikla = async (x, y, modifiers = 0) => {
    await mouse("mousePressed", x, y, 1, modifiers);
    await mouse("mouseReleased", x, y, 0, modifiers);
    await sleep(300);
  };

  /* 1 — grafiğin üstündeki ok, serbest yerleşim açıkken */
  const grafikKutusu = await evalIn(`!!document.querySelector('.decor-box[data-slot="grafik"]')`);
  const okNoktasi = await nokta(480, 268);
  await tikla(okNoktasi.x, okNoktasi.y);
  const okSecim = await secili();
  report(grafikKutusu === true && okSecim === "OK", "ok-grafigin-ustunde", `grafik kutusu=${grafikKutusu} · seçili=${okSecim}`);

  /* 2 — üst üste binen iki kutuda Ctrl+tık alttakine iniyor */
  // Örtüşme bölgesi: x 80…190, y 70…150 (kart uzayında). Üstteki `ust`.
  const ustNoktasi = await nokta(135, 110);
  await tikla(ustNoktasi.x, ustNoktasi.y);
  const ilkSecim = await secili();
  await tikla(ustNoktasi.x, ustNoktasi.y, CTRL);
  const altSecim = await secili();
  report(ilkSecim === "UST" && altSecim === "ALT", "ctrl-tik-altindaki", `düz tık=${ilkSecim} · Ctrl+tık=${altSecim}`);

  /* 3 — kilitli bir kutunun altındaki nesne seçilebiliyor */
  const hedefNoktasi = await nokta(810, 450);
  await tikla(hedefNoktasi.x, hedefNoktasi.y);
  const hedefSecim = await secili();
  // Kilitli kutu gerçekten hedefin üstünü örtüyor mu: yoksa test kendiliğinden
  // geçer ve hiçbir şey kanıtlamazdı.
  const ortuyor = await evalIn(`(() => {
    const ws = JSON.parse(localStorage.getItem("data-gorsel.workspace.v1"));
    const n = ws.charts[0].decor.nesneler; const i = (id) => n.findIndex((q) => q.id === id);
    const k = n[i("kilitli")];
    return i("kilitli") > i("hedef") && k.kilit === true &&
      810 >= k.x && 810 <= k.x + k.w && 450 >= k.y && 450 <= k.y + k.h; })()`);
  report(ortuyor === true, "kilitli-ortuyor", `kilitli hedefin üstünde ve kilitli=${ortuyor}`);
  report(hedefSecim === "HEDEF", "kilitli-yolu-kapatmiyor", `seçili=${hedefSecim}`);

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nsahnede seçim beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
