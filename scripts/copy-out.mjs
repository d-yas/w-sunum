// After `vite build`: put the single file where people will look for it.
import { copyFileSync, statSync } from "node:fs";

copyFileSync("dist/index.html", "veri-gorsel.html");
const kb = Math.round(statSync("veri-gorsel.html").size / 1024);
console.log(`veri-gorsel.html yazıldı (${kb} KB)`);
