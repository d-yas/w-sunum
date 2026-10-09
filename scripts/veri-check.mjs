// Veri tablosu — kullanıcı yolculukları, gerçek fare ve klavyeyle.
//
// Her senaryo bir yolculuk: kurum içi sunum hazırlayan biri verisini
// Excel'den getiriyor, dönem dönem güncelliyor, grafiğe bakıp düzeltiyor ve
// sonucu geri Excel'e ya da PowerPoint'e taşıyor. Birim testleri
// (`tablo-test.mjs`) kuralların doğruluğunu sınıyor; bu betik kullanıcının o
// kurallara **ulaşabildiğini**: tıklamanın hangi hücreye düştüğünü, tuşların
// kime gittiğini, bildirimdeki düğmenin doğru işi yaptığını.
//
// Pano: kopyalamada gerçek `Ctrl+C`/`Ctrl+X` basılıyor ve ızgaranın panoya
// yazdığı metin `copy`/`cut` olayından okunuyor. Yapıştırmada başsız
// tarayıcının sistem panosu kullanılamadığı için `paste` olayı Excel'in
// yazdığı metinle ızgaraya gönderiliyor — Ctrl+V'nin tarayıcıda ürettiği olay.
//
//   node scripts/veri-check.mjs
import { launch } from "./cdp.mjs";

const SHIFT = 8;
const CTRL = 2;
const ALT = 1;

function kart(kind, data) {
  return {
    id: "k",
    name: "k",
    kind,
    title: "",
    subtitle: "",
    note: "",
    data,
    paletteId: "varsayilan",
    colors: [],
    options: { width: 960, height: 540, animate: false, sira: { oge: [], seri: [], alt: {} } },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [], gruplar: {} },
    yerlesim: { serbest: false, kutular: {}, gizli: [] },
  };
}
const alan = (c) => ({ version: 1, theme: "light", activeId: c.id, palettes: [], export: { scale: 1, background: "theme" }, charts: [c] });

const CEYREK = () => ({
  columns: ["Çeyrek", "A", "B"],
  rows: [
    ["Ç1", "10", "1"],
    ["Ç2", "40", "2"],
    ["Ç3", "20", "3"],
    ["Ç4", "30", "4"],
  ],
});

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(26)} ${detail}`);
};

const cdp = await launch({ width: 1500, height: 950 });
try {
  const { evalIn, seed, mouse, key, sleep, send } = cdp;

  /** İşin kaydı: uygulama depoya 250 ms gecikmeyle yazıyor, okumadan önce beklenir. */
  const tablo = async () => {
    await sleep(320);
    return evalIn(`(() => { const ws = JSON.parse(localStorage.getItem("data-gorsel.workspace.v1")); return ws.charts.find((c) => c.id === ws.activeId).data; })()`);
  };
  const sutun = async (c) => (await tablo()).rows.map((r) => r[c]);
  const durum = () =>
    evalIn(`({ etiket: document.querySelector("[data-secim-etiketi]")?.textContent ?? null,
      ozet: document.querySelector("[data-secim-ozeti]")?.textContent ?? null,
      hata: document.querySelector("[data-hata-sayisi]")?.textContent ?? null,
      bildirim: document.querySelector("[data-bildirim]")?.textContent ?? null,
      arac: document.querySelector(".stage")?.dataset.arac ?? null })`);
  const merkez = (sel) =>
    evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const hucre = (r, c) => merkez(`.veri-izgara [data-r="${r}"][data-c="${c}"]`);
  const satirNo = (r) =>
    evalIn(`(() => { const e = document.querySelectorAll(".veri-izgara tbody td.rownum")[${r}]; const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);

  const tikla = async (p, modifiers = 0, button = "left") => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button, buttons: button === "left" ? 1 : 2, clickCount: 1, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button, buttons: 0, clickCount: 1, modifiers });
    await sleep(200);
  };
  const sagTikla = (p) => tikla(p, 0, "right");
  const surukle = async (a, b, adim = 10) => {
    await mouse("mouseMoved", a.x, a.y, 0);
    await mouse("mousePressed", a.x, a.y, 1);
    for (let i = 1; i <= adim; i++) {
      await mouse("mouseMoved", a.x + ((b.x - a.x) * i) / adim, a.y + ((b.y - a.y) * i) / adim, 1);
      await sleep(16);
    }
    await mouse("mouseReleased", b.x, b.y, 0);
    await sleep(350);
  };
  /** Harf harf yazmak: her tuş gerçek bir `keydown` (ızgara ilk harfte düzenlemeyi açıyor) + metin. */
  const yaz = async (metin) => {
    for (const ch of metin) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep(30);
    }
    await sleep(120);
  };
  const tus = async (k, code, vk, mod = 0) => {
    await key(k, code, vk, mod);
    await sleep(160);
  };
  /** Excel'den kopyalanmış metni ızgaraya yapıştırmak — Ctrl+V'nin ürettiği olay. */
  const yapistir = async (metin) => {
    await evalIn(`(() => { const g = document.querySelector(".veri-izgara"); const dt = new DataTransfer();
      dt.setData("text/plain", ${JSON.stringify(metin)});
      g.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
    await sleep(450);
  };
  /**
   * Ctrl+C / Ctrl+X: tarayıcının düzenleme komutu (`commands`) — kullanıcının
   * tuşu gibi odaktaki ızgaraya `copy`/`cut` olayı gönderir. Izgaranın panoya
   * yazdığı metin olayın kendisinden okunuyor.
   */
  const panoyaAl = async (harf, code, vk) => {
    await evalIn(`(() => { window.__pano = null;
      const al = (e) => { window.__pano = e.clipboardData.getData("text/plain"); window.removeEventListener("copy", al); window.removeEventListener("cut", al); };
      window.addEventListener("copy", al); window.addEventListener("cut", al); return true; })()`);
    const komut = harf === "x" ? "cut" : "copy";
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: harf, code, windowsVirtualKeyCode: vk, modifiers: CTRL, commands: [komut] });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: harf, code, windowsVirtualKeyCode: vk, modifiers: CTRL });
    await sleep(200);
    return evalIn(`window.__pano`);
  };
  const bildirimDugmesi = (ad) =>
    evalIn(`(() => { const b = [...document.querySelectorAll("[data-bildirim] button")].find((x) => x.textContent.includes(${JSON.stringify(ad)}));
      if (!b) return false; b.click(); return true; })()`);
  const menuSec = async (ad) => {
    await sleep(150);
    const ok = await evalIn(`(() => { const b = [...document.querySelectorAll(".katman-menu .katman-menu-oge")].find((x) => x.textContent.startsWith(${JSON.stringify(ad)}));
      if (!b || b.disabled) return false; b.click(); return true; })()`);
    await sleep(350);
    return ok;
  };

  /* 1 — Excel'den ilk tablo: başlıkları yıl olan bir tablo A1'e */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(0, 0));
  await yapistir("Ürün\t2023\t2024\r\nX\t120\t140\r\nY\t90\t95\r\n");
  const y1 = await tablo();
  const y1Bildirim = (await durum()).bildirim ?? "";
  report(
    y1.columns.join() === "Ürün,2023,2024" && y1.rows.length === 2 && y1Bildirim.includes("ilk satır başlık"),
    "excelden-ilk-tablo",
    `sütunlar ${y1.columns.join("|")} · ${y1.rows.length} satır · "${y1Bildirim.slice(0, 48)}…"`
  );
  await bildirimDugmesi("İlk satır veriydi");
  const y1b = await tablo();
  await tus("z", "KeyZ", 90, CTRL);
  await sleep(300);
  const y1c = await tablo();
  report(
    y1b.rows.length === 3 && y1b.rows[0][0] === "Ürün" && y1c.columns.join() === "Ürün,2023,2024",
    "baslik-tahmini-cevrilir",
    `"İlk satır veriydi" → ${y1b.rows.length} satır · Ctrl+Z → ${y1c.columns.join("|")}`
  );

  /* 2 — tek sütunu yeni dönemin sayılarıyla güncellemek */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(0, 1));
  await yapistir("11\n22");
  const y2 = await sutun(1);
  const sildi = await bildirimDugmesi("eski satırı sil");
  await sleep(300);
  report(y2.join() === "11,22,20,30" && sildi && (await tablo()).rows.length === 2, "tek-sutun-guncelle", `${y2.join("|")} · eski satırları sil → ${(await tablo()).rows.length} satır`);

  /* 3 — yeni seri: "+ Seri", adıyla birlikte başlığa yapıştır */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await merkez('[data-act="seri-ekle"]'));
  await yapistir("2026\n7\n8\n9\n10");
  const y3 = await tablo();
  report(y3.columns.join() === "Çeyrek,A,B,2026" && y3.rows.map((r) => r[3]).join() === "7,8,9,10", "yeni-seri", `sütunlar ${y3.columns.join("|")} · ${y3.rows.map((r) => r[3]).join("|")}`);

  /* 4 — geri kopyala: aralık, sonra bütün tablo başlığıyla */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(0, 0));
  await tikla(await hucre(1, 1), SHIFT);
  const aralikPano = await panoyaAl("c", "KeyC", 67);
  await tus("a", "KeyA", 65, CTRL);
  const tumPano = await panoyaAl("c", "KeyC", 67);
  report(
    aralikPano === "Ç1\t10\nÇ2\t40" && tumPano?.startsWith("Çeyrek\tA\tB\nÇ1\t10\t1"),
    "geri-kopyala",
    `aralık ${JSON.stringify(aralikPano)} · tümü ${JSON.stringify(tumPano?.slice(0, 22))}…`
  );

  /* 5 — hızlı düzelt: tıkla-yaz-Enter, Esc vazgeç, Del, F2 */
  await tikla(await hucre(0, 1));
  await yaz("99");
  await tus("Enter", "Enter", 13);
  const yazildi = (await sutun(1))[0];
  const asagi = (await durum()).etiket;
  await yaz("x");
  await tus("Escape", "Escape", 27);
  const vazgecti = (await sutun(1))[1];
  await tus("Delete", "Delete", 46);
  const silindi = (await sutun(1))[1];
  await tus("F2", "F2", 113);
  await yaz("5");
  await tus("Enter", "Enter", 13);
  report(
    yazildi === "99" && asagi?.includes("2. satır") && vazgecti === "40" && silindi === "" && (await sutun(1))[1] === "5",
    "hizli-duzelt",
    `yaz=${yazildi} · Enter→${asagi} · Esc=${vazgecti} · Del="${silindi}" · F2+5=${(await sutun(1))[1]}`
  );

  /* 6 — uygulama kısayolları ızgaraya yazarken tetiklenmiyor (H = el aracı) */
  await tikla(await hucre(2, 0));
  await yaz("h");
  await tus("Escape", "Escape", 27);
  report((await durum()).arac === "sec", "kisayol-yalitimi", `ızgarada "h" yazınca araç=${(await durum()).arac}`);

  /* 7 — satırlar: sağ tık ekle, çoklu seç-sil, sürükle-taşı, Alt+↓ */
  await seed(alan(kart("bar", CEYREK())));
  await sagTikla(await satirNo(0));
  const eklendi = await menuSec("Altına satır ekle");
  const y7a = (await sutun(0)).join();
  await tikla(await satirNo(1));
  await tikla(await satirNo(2), SHIFT);
  await sagTikla(await satirNo(1));
  const sil = await menuSec("2 satırı sil");
  const y7b = (await sutun(0)).join();
  await tikla(await satirNo(0));
  const son = await satirNo((await tablo()).rows.length - 1);
  await surukle(await satirNo(0), { x: son.x, y: son.y + 10 });
  const y7c = (await sutun(0)).join();
  await tus("ArrowUp", "ArrowUp", 38, ALT);
  const y7d = (await sutun(0)).join();
  report(
    eklendi && y7a === "Ç1,,Ç2,Ç3,Ç4" && sil && y7b === "Ç1,Ç3,Ç4" && y7c === "Ç3,Ç4,Ç1" && y7d === "Ç3,Ç1,Ç4",
    "satirlar",
    `ekle ${y7a} · sil ${y7b} · sürükle ${y7c} · Alt+↑ ${y7d}`
  );

  /* 8 — sütunlar: seçili seriyi başlığından sürükle, sütuna göre sırala */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await merkez('.veri-izgara th[data-c="2"]'));
  await surukle(await merkez('.veri-izgara th[data-c="2"]'), await merkez('.veri-izgara th[data-c="1"]'));
  const y8 = await tablo();
  await sagTikla(await merkez('.veri-izgara th[data-c="2"]'));
  await menuSec("Büyükten küçüğe");
  report(
    y8.columns.join() === "Çeyrek,B,A" && y8.rows[0].join() === "Ç1,1,10" && (await sutun(0)).join() === "Ç2,Ç4,Ç3,Ç1",
    "sutunlar",
    `taşı ${y8.columns.join("|")} · A'ya göre azalan ${(await sutun(0)).join("|")}`
  );

  /* 9 — kes-taşı */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(0, 1));
  await tikla(await hucre(1, 1), SHIFT);
  const kesilen = await panoyaAl("x", "KeyX", 88);
  await sleep(250);
  const kesildi = (await sutun(1)).slice(0, 2).join();
  await tikla(await hucre(2, 2));
  await yapistir(kesilen ?? "");
  report(kesildi === "," && (await sutun(2)).slice(2).join() === "10,40", "kes-tasi", `kesilince ${JSON.stringify(kesildi)} · hedef ${(await sutun(2)).join("|")}`);

  /* 10 — hatalı hücreyi yakala, 11 — doldur, 12 — seçimi ölç */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(1, 1));
  await yaz("12a");
  await tus("Enter", "Enter", 13);
  const hata = (await durum()).hata;
  await tikla(await merkez("[data-hata-sayisi]"));
  const hataSecim = (await durum()).etiket;
  await tikla(await hucre(0, 2));
  await tikla(await hucre(3, 2), SHIFT);
  await tus("d", "KeyD", 68, CTRL);
  const dolu = (await sutun(2)).join();
  await tikla(await hucre(0, 1));
  await tikla(await hucre(3, 1), SHIFT);
  const olcu = (await durum()).ozet;
  report(
    hata === "1 hücre sayı değil" && hataSecim?.includes("2. satır") && dolu === "1,1,1,1" && olcu === "Toplam 60 · Ort. 20",
    "hata-doldur-olc",
    `hata="${hata}" → ${hataSecim} · Ctrl+D ${dolu} · ${olcu}`
  );

  /* 13 — yapıştırma tek geri al adımı */
  await seed(alan(kart("bar", CEYREK())));
  await tikla(await hucre(0, 1));
  await yaz("7");
  await tus("Enter", "Enter", 13);
  await tikla(await hucre(0, 2));
  await yapistir("5\n6");
  await tus("z", "KeyZ", 90, CTRL);
  await sleep(300);
  const geri = await tablo();
  report(geri.rows[0][1] === "7" && geri.rows[0][2] === "1", "yapistirma-tek-adim", `Ctrl+Z → A=${geri.rows[0][1]}, B=${geri.rows[0][2]}`);

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nveri yolculukları beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
