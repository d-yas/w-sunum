import type { Locale } from "./format";

/**
 * Parse a number typed by a human. Handles "1.234,56" (tr), "1,234.56" (en),
 * "%12", "12%", "₺1.500", spaces as thousands separators and unicode minus.
 */
export function parseNumber(raw: string | number | null | undefined, locale: Locale = "tr-TR"): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/[\s ]/g, "").replace(/[₺$€£%]/g, "").replace(/−/g, "-");
  if (!s || s === "-") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // whichever comes last is the decimal separator
    const decimalIsComma = s.lastIndexOf(",") > s.lastIndexOf(".");
    s = decimalIsComma ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    const groups = /^-?\d{1,3}(,\d{3})+$/.test(s);
    if (groups && locale === "en-US") s = s.replace(/,/g, "");
    else if (groups && (s.match(/,/g)?.length ?? 0) > 1) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    const groups = /^-?\d{1,3}(\.\d{3})+$/.test(s);
    if (groups && locale === "tr-TR") s = s.replace(/\./g, "");
    else if (groups && (s.match(/\./g)?.length ?? 0) > 1) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const TR_MONTHS = ["oca", "şub", "mar", "nis", "may", "haz", "tem", "ağu", "eyl", "eki", "kas", "ara"];
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parse a date label. Returns null when it is not a date (categorical label). */
export function parseDate(raw: string | Date | number | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") return null;
  const s = raw.trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;

  // 2024-03-15, 2024/03/15, 2024-03
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/))) {
    return mk(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
  }
  // 15.03.2024, 15/03/2024, 15-03-2024
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    return mk(+m[3], +m[2] - 1, +m[1]);
  }
  // 03/2024, 03.2024
  if ((m = s.match(/^(\d{1,2})[-/.](\d{4})$/))) {
    return mk(+m[2], +m[1] - 1, 1);
  }
  // Mart 2024 / Mar 2024 / March 2024 / Oca 24
  if ((m = s.match(/^([A-Za-zÇçĞğİıÖöŞşÜü]+)\.?\s+(\d{2}|\d{4})$/))) {
    const mon = monthIndex(m[1]);
    if (mon >= 0) return mk(m[2].length === 2 ? 2000 + +m[2] : +m[2], mon, 1);
  }
  // 2024 Mart
  if ((m = s.match(/^(\d{4})\s+([A-Za-zÇçĞğİıÖöŞşÜü]+)$/))) {
    const mon = monthIndex(m[2]);
    if (mon >= 0) return mk(+m[1], mon, 1);
  }
  // Q1 2024, Ç1 2024, 2024 Q1, 2024-Q1
  if ((m = s.match(/^[QÇ]([1-4])[\s-]*(\d{4})$/i)) || (m = s.match(/^(\d{4})[\s-]*[QÇ]([1-4])$/i))) {
    const [q, y] = /^[QÇ]/i.test(s) ? [+m[1], +m[2]] : [+m[2], +m[1]];
    return mk(y, (q - 1) * 3, 1);
  }
  // Bare year 1990..2100
  if ((m = s.match(/^(19|20|21)\d{2}$/))) {
    return mk(+s, 0, 1);
  }
  return null;
}

function monthIndex(word: string): number {
  const w = word.toLocaleLowerCase("tr-TR").slice(0, 3);
  let i = TR_MONTHS.indexOf(w);
  if (i < 0) i = EN_MONTHS.indexOf(word.toLowerCase().slice(0, 3));
  return i;
}

function mk(y: number, mo: number, d: number): Date | null {
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Split pasted text (TSV from Excel, CSV, or semicolon CSV) into a string matrix. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!clean.trim()) return [];
  const firstLine = clean.split("\n")[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function toCsv(columns: string[], rows: string[][], delimiter = ";"): string {
  const esc = (v: string) => (/[";\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns, ...rows].map((r) => r.map(esc).join(delimiter)).join("\n");
}
