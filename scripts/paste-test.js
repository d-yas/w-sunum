// Simulates an Excel paste (TSV with header) into the data grid and reports
// the resulting table. Run: EVAL_FILE=scripts/paste-test.js node scripts/cdp-check.mjs bar light
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cell = document.querySelector('.grid-table input[data-r="0"][data-c="0"]');
  if (!cell) return "no grid cell";
  cell.focus();
  const dt = new DataTransfer();
  dt.setData("text/plain", "Bölge\tSatış\tHedef\nMarmara\t1.250,5\t1.400\nEge\t980\t1.000\nAkdeniz\t760,25\t900\n");
  const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  cell.dispatchEvent(ev);
  await sleep(300);
  const headers = [...document.querySelectorAll(".grid-table thead input")].map((i) => i.value);
  const rows = [...document.querySelectorAll(".grid-table tbody tr")].map((tr) =>
    [...tr.querySelectorAll("input")].map((i) => i.value)
  );
  const labels = [...document.querySelectorAll(".slide-card .chart-bar-x-axis text")].map((t) => t.textContent);
  const yTicks = [...document.querySelectorAll(".slide-card .chart-y-axis text")].map((t) => t.textContent);
  return { headers, rows, xLabels: labels, yTicks };
})()
