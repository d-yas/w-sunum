// Metin kutusu ve bağlantı çizgisi — gerçek fare ve klavyeyle.
//
// Yedi davranışın hiçbiri birim testiyle yakalanamıyor; hepsi bir jestin
// React durumuna, durumun da karta ulaşmasıyla var oluyor:
//
//  1. `T` aracı: karta tıklamak oraya bir metin kutusu koyuyor, yazma kutusu
//     hemen açılıyor ve araç kendiliğinden `sec`'e dönüyor.
//  2. Yazmak çalışma alanına işliyor ve kutunun boyu metne göre büyüyor.
//  3. Katman satırı metnin ilk satırıyla adlanıyor.
//  4. `Esc` yazmayı iptal ediyor: metin eski hâline dönüyor, seçim düşmüyor.
//  5. Kutuyu genişletmek satır sayısını düşürüyor, yani yükseklik de düşüyor.
//  6. `L` aracı: sürüklemek iki ucu sürüklediğiniz yerde olan bir bağlantı
//     kuruyor.
//  7. Ucu sürüklemek kutuyu yeniden yazıyor — açıyı değil.
//
//   node scripts/text-check.mjs
import { launch } from "./cdp.mjs";

const CARD = { w: 960, h: 540 };

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
        note: "",
        data: { columns: ["x", "y"], rows: [["a", "1"], ["b", "2"]] },
        paletteId: "varsayilan",
        colors: [],
        options: {
          width: CARD.w,
          height: CARD.h,
          padding: 32,
          animate: false,
          legend: false,
          grid: false,
          xAxis: false,
          yAxis: false,
          titleSize: 22,
          chartInset: 8,
          hover: false,
        },
        decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [], gruplar: {} },
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
  const nesneler = async () => (await chart()).decor.nesneler;
  const kutu = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  /** Kart yüzeyindeki bir noktanın ekran koordinatı. */
  const kartNoktasi = async (cx, cy) => {
    const r = await kutu(".stage-card");
    const k = r.w / CARD.w;
    return { x: r.x + cx * k, y: r.y + cy * k, k };
  };
  const secili = () => evalIn(`document.querySelector('.inspector-name')?.textContent`);
  const aracAdi = () =>
    evalIn(`[...document.querySelectorAll('.toolbar [data-tool]')].find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.tool`);
  /** Bir input/textarea değerini React'in gördüğü biçimde yazar. */
  const yaz = (sel, deger) =>
    evalIn(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false;
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(i, ${JSON.stringify(deger)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

  /* 1 — T aracı karta metin kutusu koyuyor */
  await key("t", "KeyT", 84);
  await sleep(300);
  const aracT = await aracAdi();
  const nokta = await kartNoktasi(140, 120);
  await mouse("mousePressed", nokta.x, nokta.y);
  await mouse("mouseReleased", nokta.x, nokta.y, 0);
  await sleep(600);
  const kutular = await nesneler();
  const kutuVar = kutular.length === 1 && kutular[0].asset === "metin/kutu";
  const yerinde = kutuVar && Math.abs(kutular[0].x - 140) < 3 && Math.abs(kutular[0].y - 120) < 3;
  const yazmaAcik = await evalIn(`!!document.querySelector('.decor-edit')`);
  report(
    aracT === "metin" && kutuVar && yerinde && yazmaAcik && (await aracAdi()) === "sec" && (await secili()) !== "Grafik",
    "metin-araci",
    `araç=${aracT}→${await aracAdi()} · kutu (${kutular[0]?.x},${kutular[0]?.y}) · yazma=${yazmaAcik} · seçili="${await secili()}"`
  );

  /* 2 — yazmak çalışma alanına işliyor, boy metne göre büyüyor */
  const id = kutular[0].id;
  const oncekiBoy = kutular[0].h;
  await yaz(".decor-edit", "Birinci satır\nİkinci satır\nÜçüncü satır");
  await sleep(500);
  const yazili = (await nesneler()).find((n) => n.id === id);
  await key("Enter", "Enter", 13, 2); // Ctrl+Enter kapatır
  await sleep(400);
  report(
    yazili?.params.yazi?.startsWith("Birinci satır") && yazili.h > oncekiBoy && !(await evalIn(`!!document.querySelector('.decor-edit')`)),
    "yazma",
    `boy ${oncekiBoy} → ${yazili?.h} · ${JSON.stringify(yazili?.params.yazi)}`
  );

  /* 3 — katman satırı ilk satırla adlanıyor */
  const satirAdi = await evalIn(`document.querySelector('aside.left .katman-satir[data-tur="nesne"] .katman-ad')?.textContent`);
  report(satirAdi === "Birinci satır", "katman-adi", `satır="${satirAdi}"`);

  /* 4 — Esc yazmayı iptal ediyor */
  await evalIn(`document.querySelector('.decor-box')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
  await sleep(400);
  const acildi = await evalIn(`!!document.querySelector('.decor-edit')`);
  await yaz(".decor-edit", "SİLİNECEK");
  await sleep(400);
  await key("Escape", "Escape", 27);
  await sleep(400);
  const geriDondu = (await nesneler()).find((n) => n.id === id);
  report(
    acildi && geriDondu?.params.yazi?.startsWith("Birinci satır") && (await secili()) === "Birinci satır",
    "esc-iptal",
    `metin=${JSON.stringify(geriDondu?.params.yazi?.slice(0, 20))} · seçim korundu="${await secili()}"`
  );

  /* 5 — genişletmek yüksekliği düşürüyor (sarma satırı azalıyor) */
  // Tek bir uzun paragraf: üç ayrı satır yazılsaydı genişlik hiçbir şeyi
  // değiştirmezdi, çünkü satır sonlarını kullanıcı koymuş olurdu.
  await evalIn(`document.querySelector('.decor-box')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
  await sleep(400);
  await yaz(".decor-edit", "Dördüncü çeyrek tüm yılın en iyisi oldu ve artış üçüncü çeyreğe göre iki katından fazla gerçekleşti.");
  await sleep(500);
  await key("Enter", "Enter", 13, 2);
  await sleep(400);
  const dar = (await nesneler()).find((n) => n.id === id);
  const darBoy = dar.h;
  // Yalnız iki kenar tutamacı olmalı: yükseklik metnin işi, köşeden çekilmez.
  const tutamacSayisi = await evalIn(`document.querySelectorAll('.decor-box .decor-handle:not(.decor-rotate)').length`);
  // Tutamacın kendi yerini ölçüyoruz: kutu az önce boy değiştirdi, eski
  // ölçüyle hesaplanan nokta tutamacın 10 px'lik alanını ıskalıyor.
  const sagTutamac = await evalIn(`(() => {
    const hs = [...document.querySelectorAll('.decor-box .decor-handle:not(.decor-rotate)')];
    const e = hs.sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).at(-1);
    if (!e) return null;
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!sagTutamac) {
    report(false, "oto-yukseklik", "tutamaç yok");
  } else {
    await mouse("mousePressed", sagTutamac.x, sagTutamac.y);
    await mouse("mouseMoved", sagTutamac.x + 100, sagTutamac.y);
    await mouse("mouseMoved", sagTutamac.x + 320, sagTutamac.y);
    await mouse("mouseReleased", sagTutamac.x + 320, sagTutamac.y, 0);
    await sleep(600);
    const genis = (await nesneler()).find((n) => n.id === id);
    report(
      tutamacSayisi === 2 && genis.w > dar.w + 200 && genis.h < darBoy,
      "oto-yukseklik",
      `tutamaç ${tutamacSayisi} · en ${dar.w} → ${genis.w} · boy ${darBoy} → ${genis.h}`
    );
  }

  /* 6 — L aracı ile bağlantı çizmek */
  await key("Escape", "Escape", 27);
  await sleep(250);
  await key("l", "KeyL", 76);
  await sleep(300);
  const A = await kartNoktasi(200, 400);
  const B = await kartNoktasi(620, 260);
  await mouse("mousePressed", A.x, A.y);
  await mouse("mouseMoved", A.x + 40, A.y - 20);
  await mouse("mouseMoved", B.x, B.y);
  await mouse("mouseReleased", B.x, B.y, 0);
  await sleep(700);
  const bag = (await nesneler()).find((n) => n.asset === "ok/baglanti");
  // Uçlar kutunun yüzdesi; mutlak noktaya geri çevirip çizdiğimiz yerle
  // karşılaştırıyoruz — hesabın tamamı bir kez burada doğrulanıyor.
  const uc = (n, kx, ky) => ({ x: n.x + (n.params[kx] / 100) * n.w, y: n.y + (n.params[ky] / 100) * n.h });
  const u1 = bag && uc(bag, "x1", "y1");
  const u2 = bag && uc(bag, "x2", "y2");
  const yakin = (p, x, y) => p && Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3;
  report(
    !!bag && yakin(u1, 200, 400) && yakin(u2, 620, 260) && (await aracAdi()) === "sec",
    "cizgi-araci",
    `uçlar (${u1?.x.toFixed(0)},${u1?.y.toFixed(0)}) → (${u2?.x.toFixed(0)},${u2?.y.toFixed(0)}) · kutu ${bag?.w}×${bag?.h}`
  );

  /* 7 — ucu sürüklemek kutuyu yeniden yazıyor */
  const sonUc = await kutu(`.decor-uc[data-uc="son"]`);
  if (!sonUc || !bag) {
    report(false, "uc-surukle", "uç tutamacı yok");
  } else {
    const hedef = await kartNoktasi(820, 460);
    await mouse("mousePressed", sonUc.x + sonUc.w / 2, sonUc.y + sonUc.h / 2);
    await mouse("mouseMoved", hedef.x - 40, hedef.y - 20);
    await mouse("mouseReleased", hedef.x, hedef.y, 0);
    await sleep(700);
    const sonra = (await nesneler()).find((n) => n.id === bag.id);
    const yeniUc = uc(sonra, "x2", "y2");
    const sabitUc = uc(sonra, "x1", "y1");
    report(
      yakin(yeniUc, 820, 460) && yakin(sabitUc, 200, 400) && sonra.aci === 0 && sonra.w > bag.w,
      "uc-surukle",
      `son uç (${yeniUc.x.toFixed(0)},${yeniUc.y.toFixed(0)}) · baş uç sabit=${yakin(sabitUc, 200, 400)} · kutu ${bag.w}→${sonra.w}`
    );
  }

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nmetin ve bağlantı beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
