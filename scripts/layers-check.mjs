// Katmanlar paneli — ağaç, ad değiştirme, göz, sürükleme, arama, sağ tık.
//
// Buradaki sekiz davranışın hiçbiri birim testiyle yakalanamıyor: hepsi bir
// tıklamanın React durumuna, durumun da karta ya da localStorage'a ulaşmasıyla
// var oluyor.
//
//  1. Grup bir ağaç düğümü: çocuklar girintili, ok grubu kapatıp açıyor.
//  2. Çift tıkla ad değiştirmek çalışma alanına yazıyor (`ad` alanı).
//  3. Göz bir süslemeyi karttan kaldırıyor, tekrar basınca geri getiriyor.
//  4. Kart parçasının gözü akış yerleşiminde de çalışıyor (eskiden yalnız
//     serbest yerleşimde çalışıyordu).
//  5. Zemin yuvası listede bir satır ve gözü zemini kapatıyor.
//  6. Bir nesneyi grubun içine sürüklemek onu gruba katıyor.
//  7. Arama kutusu satırları süzüyor.
//  8. Sağ tık menüsündeki "En arkaya gönder" nesneyi arka katmana atıyor.
//  9. Zemin yuvası "Nesneye dönüştür" ile öne alınabilen bir katmana dönüyor:
//     kart boyunda, grafiğin önünde ve sürüklenebilir.
//
//   node scripts/layers-check.mjs
import { launch } from "./cdp.mjs";

const nesne = (id, asset, x, extra = {}) => ({
  asset,
  id,
  ad: "",
  renk: "",
  renk2: "",
  opaklik: 1,
  params: {},
  x,
  y: 120,
  w: 90,
  h: 90,
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
        decor: {
          zemin: { doku: null, isik: { asset: "isik/kure", renk: "", renk2: "", opaklik: 1, params: {}, gizli: false }, cerceve: null },
          // Depo dipten tepeye: yalniz, sonra grubun iki üyesi (en üstte).
          nesneler: [
            nesne("yalniz", "sekil/kare", 60),
            nesne("uye1", "sekil/daire", 300, { grup: "g1" }),
            nesne("uye2", "sekil/ucgen", 480, { grup: "g1" }),
          ],
          gruplar: { g1: { ad: "Rozetler" } },
        },
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
  const satirlar = () =>
    evalIn(`[...document.querySelectorAll('aside.left .katman-satir')].map((e) => ({
      id: e.dataset.satirId, tur: e.dataset.tur, ad: e.querySelector('.katman-ad')?.textContent ?? "",
      girinti: parseInt(e.style.paddingLeft, 10) || 0, gizli: e.hasAttribute('data-gizli') }))`);
  const kutu = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const tik = async (sel, opts = "{}") =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
      e.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true }, ${opts}))); return true; })()`);
  const satirSec = (id) => `aside.left .katman-satir[data-satir-id=${JSON.stringify(id)}]`;

  /* 1 — grup bir ağaç düğümü */
  const acik = await satirlar();
  const grupSatiri = acik.find((r) => r.tur === "grup");
  const cocuklar = acik.filter((r) => r.tur === "nesne" && r.girinti > (grupSatiri?.girinti ?? 0));
  await evalIn(`document.querySelector('${satirSec("g:g1")} .katman-ok button')?.click(); true`);
  await sleep(350);
  const kapaliHal = await satirlar();
  const kapaliCocuk = kapaliHal.filter((r) => r.tur === "nesne" && r.girinti > 6).length;
  await evalIn(`document.querySelector('${satirSec("g:g1")} .katman-ok button')?.click(); true`);
  await sleep(350);
  report(
    grupSatiri?.ad === "Rozetler" && cocuklar.length === 2 && kapaliCocuk === 0 && (await satirlar()).length === acik.length,
    "grup-agaci",
    `grup="${grupSatiri?.ad}" · açık ${cocuklar.length} çocuk · kapalı ${kapaliCocuk}`
  );

  /* 2 — çift tıkla ad değiştirme */
  await evalIn(`document.querySelector('${satirSec("n:yalniz")}')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
  await sleep(350);
  const girisVar = await evalIn(`!!document.querySelector('${satirSec("n:yalniz")} .katman-ad-giris')`);
  await evalIn(`(() => { const i = document.querySelector('${satirSec("n:yalniz")} .katman-ad-giris');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, 'Vurgu kutusu'); i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); return true; })()`);
  await key("Enter", "Enter", 13);
  await sleep(500);
  const adli = (await chart()).decor.nesneler.find((n) => n.id === "yalniz");
  const listeAdi = (await satirlar()).find((r) => r.id === "n:yalniz")?.ad;
  report(girisVar && adli?.ad === "Vurgu kutusu" && listeAdi === "Vurgu kutusu", "ad-degistir", `ad="${adli?.ad}" · listede "${listeAdi}"`);

  /* 3 — göz bir süslemeyi karttan kaldırır */
  const svgSay = () => evalIn(`document.querySelectorAll('.stage-card [data-decor="on"] > g').length`);
  const oncekiSvg = await svgSay();
  await tik(`${satirSec("n:yalniz")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  const gizliSvg = await svgSay();
  const gizliKayit = (await chart()).decor.nesneler.find((n) => n.id === "yalniz")?.gizli;
  await tik(`${satirSec("n:yalniz")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  report(gizliKayit === true && gizliSvg === oncekiSvg - 1 && (await svgSay()) === oncekiSvg, "goz-nesne", `${oncekiSvg} → ${gizliSvg} → ${await svgSay()}`);

  /* 4 — kart parçasının gözü akış yerleşiminde de çalışır */
  const serbestMi = (await chart()).yerlesim.serbest;
  await tik(`${satirSec("p:dipnot")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  const dipnotGitti = await evalIn(`!document.querySelector('.stage-card [data-part="note"]')`);
  await tik(`${satirSec("p:dipnot")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  const dipnotGeldi = await evalIn(`!!document.querySelector('.stage-card [data-part="note"]')`);
  report(serbestMi === false && dipnotGitti && dipnotGeldi, "goz-kart-parcasi", `akış yerleşiminde gizle=${dipnotGitti}, geri getir=${dipnotGeldi}`);

  /* 5 — zemin yuvası listede bir satır, gözü zemini kapatır */
  const zeminSatiri = (await satirlar()).find((r) => r.tur === "zemin");
  const zeminVar = () => evalIn(`!!document.querySelector('.stage-card [data-decor="arka"]')`);
  await tik(`${satirSec("z:isik")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  const zeminKapali = await zeminVar();
  await tik(`${satirSec("z:isik")} .katman-acts .icon-btn:last-child`);
  await sleep(450);
  report(!!zeminSatiri && zeminKapali === false && (await zeminVar()) === true, "zemin-satiri", `satır="${zeminSatiri?.ad}" · kapalıyken zemin=${zeminKapali}`);

  /* 6 — sürükleyerek gruba katmak */
  const rowRect = (id) => kutu(satirSec(id));
  const kaynak = await rowRect("n:yalniz");
  const hedef = await rowRect("n:uye2");
  if (!kaynak || !hedef) {
    report(false, "gruba-surukle", "satırlar bulunamadı");
  } else {
    await mouse("mousePressed", kaynak.x + 40, kaynak.y + kaynak.h / 2);
    await mouse("mouseMoved", kaynak.x + 40, kaynak.y + kaynak.h / 2 - 10);
    await mouse("mouseMoved", hedef.x + 40, hedef.y + hedef.h - 2);
    await mouse("mouseReleased", hedef.x + 40, hedef.y + hedef.h - 2, 0);
    await sleep(700);
    const n = (await chart()).decor.nesneler.find((q) => q.id === "yalniz");
    const girinti = (await satirlar()).find((r) => r.id === "n:yalniz")?.girinti;
    report(n?.grup === "g1" && girinti > 6, "gruba-surukle", `grup="${n?.grup}" · girinti ${girinti}px`);
  }

  /* 7 — arama satırları süzer */
  await evalIn(`(() => { const i = document.querySelector('.katman-arama input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, 'rozet'); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await sleep(400);
  const suzulmus = await satirlar();
  await evalIn(`(() => { const i = document.querySelector('.katman-arama input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await sleep(400);
  report(
    suzulmus.some((r) => r.tur === "grup") && !suzulmus.some((r) => r.tur === "parca") && suzulmus.length < (await satirlar()).length,
    "arama-suzer",
    `"rozet" → ${suzulmus.length} satır (${suzulmus.map((r) => r.tur).join(",")})`
  );

  /* 8 — sağ tık menüsü ve "En arkaya gönder" */
  const menuKaynak = await rowRect("n:yalniz");
  // `contextmenu` doğrudan gönderiliyor: CDP'nin sağ tuş basışı Windows'ta
  // menüyü işletim sistemine bırakıyor ve sayfaya olay ulaşmıyor.
  await evalIn(`(() => { const e = document.querySelector('${satirSec("n:yalniz")}'); if (!e) return false;
    e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: ${Math.round(menuKaynak.x + 40)}, clientY: ${Math.round(menuKaynak.y + menuKaynak.h / 2)} }));
    return true; })()`);
  await sleep(500);
  const menuOgeleri = await evalIn(`[...document.querySelectorAll('.katman-menu-oge')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  await evalIn(`[...document.querySelectorAll('.katman-menu-oge')].find((e) => e.textContent.includes('En arkaya'))?.click(); true`);
  await sleep(600);
  const arkaya = (await chart()).decor.nesneler.find((n) => n.id === "yalniz");
  report(
    menuOgeleri.length >= 5 && menuOgeleri.some((t) => t.includes("Yeniden adlandır")) && arkaya?.katman === "arka",
    "baglam-menusu",
    `${menuOgeleri.length} eylem · katman=${arkaya?.katman}`
  );

  /* 9 — zemin yuvasını nesneye dönüştürmek */
  const zeminOnce = (await chart()).decor.zemin.isik;
  const zKutu = await rowRect("z:isik");
  await evalIn(`(() => { const e = document.querySelector('${satirSec("z:isik")}'); if (!e) return false;
    e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: ${Math.round(zKutu.x + 40)}, clientY: ${Math.round(zKutu.y + zKutu.h / 2)} }));
    return true; })()`);
  await sleep(450);
  await evalIn(`[...document.querySelectorAll('.katman-menu-oge')].find((e) => e.textContent.includes('Nesneye dönüştür'))?.click(); true`);
  await sleep(600);
  const sonra = await chart();
  const yeni = sonra.decor.nesneler.find((n) => n.asset === zeminOnce?.asset);
  // Dönüşen katman artık grafiğin önünde çizilen SVG'de olmalı.
  const ondeCiziliyor = await evalIn(`!!document.querySelector('.stage-card [data-decor="on"]')`);
  report(
    !!zeminOnce &&
      sonra.decor.zemin.isik === null &&
      yeni?.katman === "on" &&
      yeni?.w === sonra.options.width &&
      yeni?.h === sonra.options.height &&
      ondeCiziliyor,
    "zemin-nesneye",
    `yuva=${sonra.decor.zemin.isik} · nesne ${yeni?.w}×${yeni?.h} katman=${yeni?.katman} · önde çiziliyor=${ondeCiziliyor}`
  );

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nkatman paneli beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
