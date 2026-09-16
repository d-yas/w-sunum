// PPTX dışa aktarımı — gerçek düğmeden sürülüp üretilen paketin içine bakılır.
//
// Bir .pptx'in doğruluğunu ekrandan anlamak mümkün değil; PowerPoint'i açana
// kadar hiçbir şey belli olmuyor. Burada paket indirme akışından yakalanıp
// ZIP'i çözülüyor ve slayt XML'i okunuyor:
//
//  1. Paket açılabiliyor ve beklenen parçalar içinde (presentation, slayt,
//     resim).
//  2. Başlık, alt başlık ve dipnot **gerçek metin kutusu** olarak slaytta.
//  3. Yerleştirilen metin kutusunun satırları ayrı paragraflar olarak gidiyor.
//  4. Balon yazısı da metin kutusu — şekil resimde, yazı üstünde.
//  5. Bu yazılar PNG'ye **girmiyor**: başlığın durduğu şerit resimde bomboş.
//  6. Çözünürlük ayarı gömülen resmin piksel boyuna yansıyor.
//  7. Slayt ölçüsü ayara uyuyor (16:9 / karta göre).
//
//   node scripts/pptx-check.mjs
import { launch } from "./cdp.mjs";

const CARD = { w: 800, h: 600 };

function workspace(pptxSlayt = "16:9", pptxScale = 3) {
  const nesne = (id, asset, params, box) => ({
    asset,
    id,
    ad: "",
    renk: "",
    renk2: "",
    opaklik: 1,
    gizli: false,
    params,
    x: box[0],
    y: box[1],
    w: box[2],
    h: box[3],
    aci: 0,
    aynala: false,
    katman: "on",
    kilit: false,
    grup: "",
  });
  return {
    version: 1,
    theme: "light",
    activeId: "a",
    palettes: [],
    export: { scale: 1, background: "theme", pptxScale, pptxSlayt },
    charts: [
      {
        id: "a",
        name: "a",
        kind: "bar",
        title: "ÇEYREKLİK SATIŞ",
        subtitle: "İkinci satır",
        note: "Kaynak: iç veri",
        data: { columns: ["x", "y"], rows: [["a", "10"], ["b", "40"]] },
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
          titleSize: 24,
          chartInset: 8,
          hover: false,
        },
        decor: {
          zemin: { doku: null, isik: null, cerceve: null },
          gruplar: {},
          nesneler: [
            nesne("t1", "metin/kutu", { yazi: "ALFA\nBETA", punto: 18, boy: "sabit", dolgu: "yok" }, [420, 90, 300, 70]),
            nesne("b1", "balon/etiket", { yazi: "GAMA", punto: 16 }, [60, 480, 170, 40]),
          ],
        },
        yerlesim: { serbest: false, kutular: {}, gizli: [] },
      },
    ],
  };
}

let failures = 0;
const report = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(18)} ${detail}`);
};

/**
 * Sayfa içinde .pptx üretir ve içindeki parçaları geri verir.
 *
 * ZIP'i tarayıcıda çözüyoruz: paket STORE yöntemiyle yazıldığı için her
 * parça sıkıştırılmamış duruyor, yani yerel dosya başlıklarını gezip
 * veriyi doğrudan okumak yetiyor. Node tarafına taşımak gereksiz bir adım.
 */
const ac = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Blob'un kendisini yakalıyoruz, URL'sini değil: file:// üzerinde bir
  // blob: adresi fetch edilemiyor (opak köken).
  const bloblar = [];
  const origUrl = URL.createObjectURL;
  URL.createObjectURL = function (b) { bloblar.push(b); return origUrl.call(URL, b); };
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {};
  document.querySelector('[data-tool="disa"]').click();
  await wait(300);
  document.querySelector('button[data-act="pptx"]').click();
  await wait(4000);
  HTMLAnchorElement.prototype.click = origClick;
  URL.createObjectURL = origUrl;
  if (!bloblar.length) return { hata: "indirme tetiklenmedi" };
  const buf = new Uint8Array(await bloblar[bloblar.length - 1].arrayBuffer());
  const dv = new DataView(buf.buffer);
  const dec = new TextDecoder();
  const parcalar = {};
  let i = 0;
  while (i < buf.length - 4 && dv.getUint32(i, true) === 0x04034b50) {
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const size = dv.getUint32(i + 18, true);
    const name = dec.decode(buf.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + size);
    parcalar[name] = name.endsWith(".png")
      ? { png: true, bytes: size, data, w: new DataView(data.buffer, data.byteOffset).getUint32(16), h: new DataView(data.buffer, data.byteOffset).getUint32(20) }
      : dec.decode(data);
    i = start + size;
  }
  // Başlığın durduğu şeridi resimden okuyoruz: yazı gizlenmemişse burası
  // koyu piksel taşır. Tek gerçek kanıt bu — XML'de metin kutusu olması,
  // resimde olmadığı anlamına gelmiyor.
  const ham = parcalar["ppt/media/image1.png"];
  let koyu = -1;
  if (ham) {
    const blob = new Blob([ham.data], { type: "image/png" });
    const img = new Image();
    const yuklendi = await new Promise((res) => { img.onload = () => res(true); img.onerror = () => res(false); img.src = URL.createObjectURL(blob); });
    if (yuklendi) {
      const cv = document.createElement("canvas");
      cv.width = img.width; cv.height = img.height;
      const cx2 = cv.getContext("2d");
      cx2.fillStyle = "#fff"; cx2.fillRect(0, 0, cv.width, cv.height);
      cx2.drawImage(img, 0, 0);
      const k = img.width / 800;
      const d = cx2.getImageData(Math.round(30 * k), Math.round(28 * k), Math.round(340 * k), Math.round(44 * k)).data;
      koyu = 0;
      for (let j = 0; j < d.length; j += 4) if (d[j] < 160 && d[j + 1] < 160) koyu++;
    }
  }
  return { parcalar: Object.keys(parcalar), slayt: parcalar["ppt/slides/slide1.xml"], sunu: parcalar["ppt/presentation.xml"], resim: ham && { bytes: ham.bytes, w: ham.w, h: ham.h }, koyu, boy: buf.length };
})()`;

const cdp = await launch();
try {
  const { evalIn, seed, sleep } = cdp;

  await seed(workspace("16:9", 3));
  await sleep(600);
  const p = await evalIn(ac);
  if (p.hata) throw new Error(p.hata);

  /* 1 — paket açıldı ve parçalar yerinde */
  const gerekli = ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/media/image1.png"];
  const eksik = gerekli.filter((k) => !p.parcalar.includes(k));
  report(eksik.length === 0, "paket", `${p.parcalar.length} parça · ${Math.round(p.boy / 1024)} KB${eksik.length ? " · eksik: " + eksik.join(", ") : ""}`);

  /* 2 — kart metinleri gerçek metin kutusu */
  const kutular = [...p.slayt.matchAll(/<p:sp>.*?<\/p:sp>/gs)].map((m) => m[0]);
  const yazisi = (sp) => [...sp.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((m) => m[1]);
  const tumYazilar = kutular.flatMap(yazisi);
  const kartMetni = ["ÇEYREKLİK SATIŞ", "İkinci satır", "Kaynak: iç veri"].every((t) => tumYazilar.includes(t));
  report(kartMetni, "kart-metinleri", `${kutular.length} metin kutusu · ${JSON.stringify(tumYazilar.slice(0, 3))}`);

  /* 3 — metin kutusunun satırları ayrı paragraf */
  const alfa = kutular.find((sp) => yazisi(sp).includes("ALFA"));
  const alfaSatir = alfa ? yazisi(alfa) : [];
  report(
    alfaSatir.join("|") === "ALFA|BETA" && /wrap="none"/.test(alfa ?? ""),
    "metin-katmani",
    `satırlar=${JSON.stringify(alfaSatir)}`
  );

  /* 4 — balon yazısı da kutu */
  report(tumYazilar.includes("GAMA"), "balon-yazisi", `yazılar=${JSON.stringify(tumYazilar)}`);

  /* 5 — başlık şeridi resimde boş: yazı gerçekten çıkarılmış */
  report(p.koyu === 0, "yazi-resimde-yok", `başlık şeridinde ${p.koyu} koyu piksel`);

  /* 6 — çözünürlük: kart 800×600, ölçek 3 → 2400×1800 */
  const beklenen = { w: CARD.w * 3, h: CARD.h * 3 };
  report(
    p.resim?.w === beklenen.w && p.resim?.h === beklenen.h,
    "cozunurluk",
    `resim ${p.resim?.w}×${p.resim?.h} (beklenen ${beklenen.w}×${beklenen.h}) · ${Math.round((p.resim?.bytes ?? 0) / 1024)} KB`
  );

  /* 6b — metin kutuları resmin üstüne, kart koordinatına oturuyor mu */
  // Resim 16:9 slayta sığdırılıp ortalanıyor; kart pikseli başına EMU oradan
  // çıkıyor. Başlık kartın 32 px kenar boşluğunda, yani kutusu resmin sol
  // kenarından tam 32 px içeride olmalı.
  const pic = p.slayt.match(/<p:pic>.*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/s);
  const [px0, py0, pcx, pcy] = pic ? pic.slice(1).map(Number) : [0, 0, 0, 0];
  const kx = pcx / CARD.w;
  const kutuYeri = (sp) => {
    const m = sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/);
    return m ? m.slice(1).map(Number) : null;
  };
  const baslikKutu = kutular.find((sp) => yazisi(sp).includes("ÇEYREKLİK SATIŞ"));
  const by = baslikKutu && kutuYeri(baslikKutu);
  const sapmaX = by ? Math.abs(by[0] - (px0 + 32 * kx)) / kx : 999;
  // Hepsi resmin içinde mi — ölçek ya da kaydırma hatası burada patlar.
  const icerde = kutular.every((sp) => {
    const q = kutuYeri(sp);
    return q && q[0] >= px0 - 2 * kx && q[1] >= py0 - 2 * kx && q[0] + q[2] <= px0 + pcx + 2 * kx && q[1] + q[3] <= py0 + pcy + 2 * kx;
  });
  report(sapmaX < 2 && icerde, "metin-yerlesimi", `başlık sapması ${sapmaX.toFixed(2)} px · hepsi resmin içinde=${icerde}`);

  /* 7 — slayt ölçüsü: 16:9, sonra karta göre */
  const sldSz = (xml) => {
    const m = xml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const gorunumlu = sldSz(p.sunu);
  report(
    gorunumlu?.[0] === 12192000 && gorunumlu?.[1] === 6858000,
    "slayt-16-9",
    `${gorunumlu?.join(" × ")}`
  );

  // "Karta göre": 800×600 kart → geniş ekran kutusuna sığan 4:3 slayt (10×7,5 inç).
  await seed(workspace("kart", 2));
  await sleep(600);
  const q = await evalIn(ac);
  const kartOlcu = sldSz(q.sunu);
  const oran = kartOlcu ? kartOlcu[0] / kartOlcu[1] : 0;
  report(
    Math.abs(oran - CARD.w / CARD.h) < 0.01 && kartOlcu?.[1] === 6858000 && q.resim?.w === CARD.w * 2,
    "slayt-karta-gore",
    `${kartOlcu?.join(" × ")} (oran ${oran.toFixed(3)}, kart ${(CARD.w / CARD.h).toFixed(3)}) · resim ${q.resim?.w}×${q.resim?.h}`
  );

  const exc = cdp.problems();
  console.log("console:", exc.length ? "\n  " + exc.join("\n  ") : "(clean)");
  if (exc.length) failures++;
  console.log(failures === 0 ? "\nsunu beklendiği gibi." : `\n${failures} sorun var.`);
} finally {
  await cdp.close();
}
process.exit(failures === 0 ? 0 : 1);
