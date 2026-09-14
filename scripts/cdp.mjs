// Shared headless-Chromium driver for the check scripts. No npm deps: the
// DevTools protocol over a WebSocket is all these tests need.
//
// `cdp-check.mjs` predates this and keeps its own copy; the two decoration
// checks share this one rather than making a third.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The built single-file app as a file:// URL. */
export function appUrl() {
  return `file:///${resolve("dist/index.html").split("\\").join("/")}`;
}

export function outDir() {
  const dir = resolve(process.env.OUT_DIR ?? "scripts/out");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Start a headless browser, attach to a blank tab, and hand back the pieces
 * every check needs: `send` for raw protocol calls, `evalIn` for page
 * JavaScript, `events` for the console and exception stream.
 */
export async function launch({ width = 1400, height = 900 } = {}) {
  const chrome = CHROME_CANDIDATES.find(existsSync);
  if (!chrome) throw new Error("Chromium tabanlı tarayıcı bulunamadı");
  const dir = outDir();
  const port = 9333 + Math.floor(Math.random() * 500);
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}/profile-${port}`,
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${width},${height}`,
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

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
    throw new Error("Chrome başlamadı");
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
  const raw = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params = {}) => raw(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  /** Run an expression in the page and return its value; throws on page errors. */
  const evalIn = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  /** Seed a workspace through localStorage and reload onto it. */
  const seed = async (workspace) => {
    await send("Page.navigate", { url: appUrl() });
    await sleep(2000);
    await evalIn(`localStorage.setItem("data-gorsel.workspace.v1", ${JSON.stringify(JSON.stringify(workspace))}); true`);
    await send("Page.reload");
    await sleep(2500);
  };

  const mouse = (type, x, y, buttons = 1) =>
    send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1, pointerType: "mouse" });

  const key = async (k, code, vk, modifiers = 0) => {
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  };

  const problems = () =>
    events
      .filter((e) => e.method === "Runtime.exceptionThrown")
      .map((e) => `${e.params.exceptionDetails.text} ${e.params.exceptionDetails.exception?.description ?? ""}`);

  return {
    send,
    evalIn,
    seed,
    mouse,
    key,
    sleep,
    events,
    problems,
    dir,
    close: () => {
      ws.close();
      proc.kill();
    },
  };
}
