// Does decoration survive the PNG export?
//
// The export path is DOM clone → inlined computed styles → <foreignObject> →
// <img> → canvas. Most SVG survives that, but three things in the decoration
// pack are genuinely uncertain on it: a gradient <mask>, an feTurbulence
// <filter>, and a <pattern> referenced through url(#id). This script proves
// each one either lands in the PNG or does not.
//
// Method: build a workspace where the card is blank except for one asset,
// export it, and read the pixel back. A texture in the corner has to change
// the corner's colour; if the mask silently dropped, the pixel would come back
// as bare card white.
//
//   node scripts/decor-check.mjs        → scripts/out/decor-*.png + a report
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.env.OUT_DIR ?? "scripts/out");
mkdirSync(outDir, { recursive: true });
const html = resolve("dist/index.html").split("\\").join("/");
const url = `file:///${html}`;

const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chrome) throw new Error("No Chromium browser found");

/* ---------------- the cases ---------------- */

// Every case paints in the top-left corner of an otherwise empty card, which
// is where the probe samples. The chart itself is switched off (no axes, no
// grid, no legend, no title) so nothing else can colour that pixel.
const RED = "#e11d48";
const CASES = [
  { name: "doku-nokta-mask", slot: "doku", asset: "doku/nokta", params: { aralik: 8, cap: 3, solme: 0.6, yon: "sag" } },
  { name: "doku-gren-filter", slot: "doku", asset: "doku/gren", params: { incelik: 0.6, katman: 3 }, opaklik: 1 },
  { name: "doku-kagit-filter", slot: "doku", asset: "doku/kagit", params: {}, opaklik: 1 },
  { name: "doku-tarama-pattern", slot: "doku", asset: "doku/tarama", params: { aralik: 6, kalinlik: 3, solme: 0 } },
  { name: "doku-petek-pattern", slot: "doku", asset: "doku/petek", params: { aralik: 14, kalinlik: 2, solme: 0 } },
  { name: "isik-radyal-gradient", slot: "isik", asset: "isik/radyal", params: { x: 0, y: 0, yaricap: 1.2, ic: 1, dis: 1 } },
  { name: "isik-bant-hardstops", slot: "isik", asset: "isik/bant", params: { aci: 0, adet: 4, siddet: 1 } },
  { name: "cerceve-serit", slot: "cerceve", asset: "cerceve/serit", params: { kenar: "ust", kalinlik: 40, boy: 100 } },
];

// Placed objects: same idea, but the box is positioned so its ink crosses the
// probe point. The rotated case centres the box *on* the probe, so the shaft
// passes through it at any angle — that isolates the rotate transform itself.
const ITEMS = [
  { name: "ok-duz", asset: "ok/duz", box: [0, 0, 110, 80], aci: 0, params: { kalinlik: 14, uc: 20, ucTipi: "dolu" } },
  { name: "ok-duz-dondurulmus", asset: "ok/duz", box: [-15, -15, 110, 110], aci: 35, params: { kalinlik: 14, uc: 20, ucTipi: "dolu" } },
  { name: "ok-firca", asset: "ok/firca", box: [0, 0, 110, 80], aci: 0, params: { kalinlik: 26, egrilik: 0, uc: 20 } },
  { name: "ikon-hedef", asset: "ikon/hedef", box: [0, 0, 110, 110], aci: 0, params: { kalinlik: 3.5 } },
  { name: "isaret-konfeti", asset: "isaret/konfeti", box: [0, 0, 110, 110], aci: 0, params: { adet: 120, boy: 14, tohum: 9 } },
  { name: "balon-kurdele-text", asset: "balon/kurdele", box: [0, 0, 110, 110], aci: 0, params: { yazi: "TEST", punto: 40, katlama: 0, derinlik: 0 } },
];

/** Probe point in card pixels — well clear of any chart ink. */
const PROBE = { x: 40, y: 40 };
const CARD = { w: 480, h: 270 };

function baseChart(extra) {
  return {
    id: "c1",
    name: "t",
    kind: "bar",
    title: "",
    subtitle: "",
    note: "",
    data: { columns: ["x", "y"], rows: [["a", "1"]] },
    paletteId: "varsayilan",
    colors: [],
    options: {
      legend: false,
      grid: false,
      xAxis: false,
      yAxis: false,
      animate: false,
      width: CARD.w,
      height: CARD.h,
      padding: 0,
      chartInset: 0,
      titleSize: 10,
    },
    decor: { zemin: { doku: null, isik: null, cerceve: null }, nesneler: [] },
    ...extra,
  };
}

function workspace() {
  const charts = [];
  for (const c of CASES) {
    const chart = baseChart({});
    chart.id = c.name;
    chart.name = c.name;
    chart.decor.zemin[c.slot] = { asset: c.asset, renk: RED, renk2: RED, opaklik: c.opaklik ?? 1, params: c.params };
    charts.push(chart);
  }
  for (const it of ITEMS) {
    const chart = baseChart({});
    chart.id = it.name;
    chart.name = it.name;
    chart.decor.nesneler = [
      {
        asset: it.asset,
        renk: RED,
        renk2: RED,
        opaklik: 1,
        params: it.params,
        id: "n1",
        x: it.box[0],
        y: it.box[1],
        w: it.box[2],
        h: it.box[3],
        aci: it.aci,
        aynala: false,
        katman: "on",
        gizli: false,
        kilit: false,
      },
    ];
    charts.push(chart);
  }
  charts.push(Object.assign(baseChart({}), { id: "temiz", name: "temiz" }));
  return { version: 1, theme: "light", activeId: charts[0].id, charts, export: { scale: 1, background: "theme" } };
}

/* ---------------- driver ---------------- */

const port = 9333 + Math.floor(Math.random() * 500);
const proc = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${outDir}/profile-decor-${port}`,
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1600,1000",
    "--allow-file-access-from-files",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let version;
for (let i = 0; i < 50; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    break;
  } catch {
    await sleep(200);
  }
}
if (!version) {
  proc.kill();
  throw new Error("Chrome did not start");
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id) {
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  } else events.push(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

let failures = 0;
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await sleep(2000);

  // Seed the workspace through localStorage, then reload so the app boots on
  // it. There is no back door into React state and this needs none.
  const json = JSON.stringify(workspace());
  await send(
    "Runtime.evaluate",
    { expression: `localStorage.setItem(${JSON.stringify("data-gorsel.workspace.v1")}, ${JSON.stringify(json)}); true` },
    sessionId
  );
  await send("Page.reload", {}, sessionId);
  await sleep(2500);

  const probe = async (chartId) => {
    const expression = `(async () => {
      document.querySelector('.chart-row[data-id=' + JSON.stringify(${JSON.stringify(chartId)}) + ']').click();
      await new Promise(r => setTimeout(r, 400));
      const url = await window.__veriGorsel.snapshotDataUrl(1);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      // Average an 8x8 patch so a thin hatch line is not missed by one pixel.
      const d = cx.getImageData(${PROBE.x - 4}, ${PROBE.y - 4}, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      return { rgb: [Math.round(r/n), Math.round(g/n), Math.round(b/n)], url, w: img.width, h: img.height };
    })()`;
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (!r.result.value) throw new Error(r.exceptionDetails?.exception?.description ?? "probe failed");
    return r.result.value;
  };

  const clean = await probe("temiz");
  console.log(`baseline (dekorsuz) rgb: ${clean.rgb.join(",")}  ${clean.w}x${clean.h}`);
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

  for (const c of [...CASES, ...ITEMS]) {
    const got = await probe(c.name);
    const d = dist(got.rgb, clean.rgb);
    const ok = d > 12;
    if (!ok) failures++;
    console.log(`${ok ? "OK  " : "FAIL"} ${c.name.padEnd(24)} rgb ${got.rgb.join(",").padEnd(13)} Δ${String(d).padStart(4)}`);
    writeFileSync(`${outDir}/decor-${c.name}.png`, Buffer.from(got.url.split(",")[1], "base64"));
  }

  // The SVG download is its own composition path, not the PNG one, and it
  // used to grab `querySelector("svg")` — which the decoration layer now wins.
  // Drive the real button, capture the blob, and render the result.
  const svgProbe = await send(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        document.querySelector('.chart-row[data-id="doku-tarama-pattern"]').click();
        await wait(400);
        const hrefs = [];
        const orig = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { hrefs.push(this.href); };
        document.querySelector('[data-tool="disa"]').click();
        await wait(300);
        // Metne göre değil data-act özniteliğine göre: yazı bir kez değişti.
        const btn = document.querySelector('button[data-act="svg"]');
        if (!btn) { HTMLAnchorElement.prototype.click = orig; return { error: 'SVG indir düğmesi yok' }; }
        btn.click();
        await wait(1800);
        HTMLAnchorElement.prototype.click = orig;
        if (!hrefs.length) return { error: 'indirme tetiklenmedi' };
        const text = await (await fetch(hrefs[0])).text();
        const img = new Image();
        const ok = await new Promise((res) => {
          img.onload = () => res(true); img.onerror = () => res(false);
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
        });
        let rgb = null;
        if (ok) {
          const cv = document.createElement('canvas');
          cv.width = img.width || 480; cv.height = img.height || 270;
          const cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          cx.drawImage(img, 0, 0);
          const d = cx.getImageData(${PROBE.x - 4}, ${PROBE.y - 4}, 8, 8).data;
          let r = 0, g = 0, b = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
          const n = d.length / 4;
          rgb = [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
        }
        return { loaded: ok, rgb, bytes: text.length, hasChart: /<g transform="translate/.test(text), hasDecor: /data-decor="arka"/.test(text) };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  );
  const sv = svgProbe.result.value ?? { error: svgProbe.exceptionDetails?.exception?.description };
  const svgOk = sv.loaded && sv.hasChart && sv.hasDecor && sv.rgb && dist(sv.rgb, clean.rgb) > 12;
  if (!svgOk) failures++;
  console.log(`${svgOk ? "OK  " : "FAIL"} ${"svg-indir".padEnd(24)} ${JSON.stringify(sv)}`);

  const fmt = (e) =>
    e.method === "Runtime.exceptionThrown"
      ? `EXC ${e.params.exceptionDetails.text} ${e.params.exceptionDetails.exception?.description ?? ""}`
      : `${e.params.type}: ${e.params.args.map((a) => a.value ?? a.description).join(" ")}`;
  const logs = events.filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Runtime.exceptionThrown").map(fmt);
  console.log("console:", logs.length ? "\n  " + logs.join("\n  ") : "(clean)");
  console.log(failures === 0 ? "\nhepsi dışa aktarımda göründü." : `\n${failures} varlık dışa aktarımda KAYBOLDU.`);
} finally {
  ws.close();
  proc.kill();
}
process.exit(failures === 0 ? 0 : 1);
