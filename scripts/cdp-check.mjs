// Headless Chromium smoke test over the DevTools protocol (no npm deps).
// Usage: node scripts/cdp-check.mjs [kind] [theme]
//   → scripts/out/app-<kind>-<theme>.png     (what the studio looks like)
//   → scripts/out/export-<kind>-<theme>.png  (what "PNG indir" produces)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const kind = process.argv[2] ?? "bar";
const theme = process.argv[3] ?? "light";
const outDir = resolve(process.env.OUT_DIR ?? "scripts/out");
mkdirSync(outDir, { recursive: true });
const html = resolve("dist/index.html").split("\\").join("/");
const url = `file:///${html}?kind=${kind}&theme=${theme}`;
const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chrome) throw new Error("No Chromium browser found");
const port = 9333 + Math.floor(Math.random() * 500);
const proc = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${outDir}/profile-${port}`,
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

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await sleep(2500);

  // Optional: open a side-panel tab (1-based index) before the screenshot.
  const tab = Number(process.argv[4] ?? 0);
  if (tab > 0) {
    await send(
      "Runtime.evaluate",
      { expression: `document.querySelectorAll('[role="tab"]')[${tab - 1}]?.click()` },
      sessionId
    );
    await sleep(400);
  }

  const fmt = (e) =>
    e.method === "Runtime.exceptionThrown"
      ? `EXC ${e.params.exceptionDetails.text} ${e.params.exceptionDetails.exception?.description ?? ""}`
      : `${e.params.type}: ${e.params.args.map((a) => a.value ?? a.description).join(" ")}`;
  const logs = events.filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Runtime.exceptionThrown").map(fmt);
  console.log("console:", logs.length ? "\n  " + logs.join("\n  ") : "(clean)");

  const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(`${outDir}/app-${kind}-${theme}.png`, Buffer.from(shot.data, "base64"));

  const res = await send(
    "Runtime.evaluate",
    {
      expression: `(async()=>{ if(!window.__veriGorsel) return "no hook"; return await window.__veriGorsel.snapshotDataUrl(2); })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  );
  const val = res.result.value;
  if (typeof val === "string" && val.startsWith("data:image/png")) {
    writeFileSync(`${outDir}/export-${kind}-${theme}.png`, Buffer.from(val.split(",")[1], "base64"));
    console.log(`export ok: ${Math.round((val.length * 0.75) / 1024)} KB → export-${kind}-${theme}.png`);
  } else {
    console.log("export result:", val, res.exceptionDetails?.text ?? "", res.exceptionDetails?.exception?.description ?? "");
  }
  if (process.env.EVAL_FILE) {
    const { readFileSync } = await import("node:fs");
    const expression = readFileSync(process.env.EVAL_FILE, "utf8");
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    console.log("eval:", JSON.stringify(r.result.value ?? r.exceptionDetails?.exception?.description ?? null, null, 1));
  }
  if (process.env.DUMP_MARKUP) {
    const m = await send("Runtime.evaluate", { expression: `window.__veriGorsel.staticMarkup()`, awaitPromise: true, returnByValue: true }, sessionId);
    writeFileSync(`${outDir}/markup-${kind}-${theme}.svg`, String(m.result.value ?? ""));
    console.log(`markup → markup-${kind}-${theme}.svg (${String(m.result.value ?? "").length} chars)`);
  }
  const late = events.filter((e) => e.method === "Runtime.exceptionThrown").map(fmt);
  if (late.length) console.log("exceptions:\n  " + late.join("\n  "));
} finally {
  ws.close();
  proc.kill();
}
