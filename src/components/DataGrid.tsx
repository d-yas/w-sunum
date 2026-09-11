import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { parseDelimited, toCsv } from "@/lib/parse";
import { columnRoles, sampleData, type ChartKind, type TableData } from "@/lib/spec";
import { downloadText } from "@/lib/storage";

/** First row reads as a header when most cells after the first are not numbers. */
function looksLikeHeader(matrix: string[][]): boolean {
  const first = matrix[0] ?? [];
  if (first.length < 2) return false;
  const nonNumeric = first.slice(1).filter((c) => c && Number.isNaN(Number(c.replace(/[.,\s]/g, "")))).length;
  return nonNumeric >= Math.ceil((first.length - 1) / 2);
}

interface Props {
  kind: ChartKind;
  data: TableData;
  onChange: (data: TableData) => void;
}

/**
 * Spreadsheet-like editor. Paste from Excel lands at the focused cell (or
 * replaces everything when the header row is focused / nothing is focused).
 */
export function DataGrid({ kind, data, onChange }: Props) {
  const roles = columnRoles(kind);
  const fixedCount = roles.fixed.length;
  const canAddColumns = roles.seriesLabel != null;
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const setCell = (r: number, c: number, v: string) => {
    const rows = data.rows.map((row) => [...row]);
    while (rows[r].length < data.columns.length) rows[r].push("");
    rows[r][c] = v;
    onChange({ ...data, rows });
  };
  const setColumn = (c: number, v: string) => {
    const columns = [...data.columns];
    columns[c] = v;
    onChange({ ...data, columns });
  };
  const addRow = (at?: number) => {
    const rows = [...data.rows];
    const blank = data.columns.map(() => "");
    rows.splice(at ?? rows.length, 0, blank);
    onChange({ ...data, rows });
  };
  const removeRow = (r: number) => {
    if (data.rows.length <= 1) return;
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== r) });
  };
  const addColumn = () => {
    const n = data.columns.length - fixedCount + 1;
    onChange({
      columns: [...data.columns, `${roles.seriesLabel} ${n}`],
      rows: data.rows.map((r) => [...r, ""]),
    });
  };
  const removeColumn = (c: number) => {
    if (c < fixedCount || data.columns.length <= fixedCount + 1) return;
    onChange({
      columns: data.columns.filter((_, i) => i !== c),
      rows: data.rows.map((r) => r.filter((_, i) => i !== c)),
    });
  };

  /** Merge a matrix into the table starting at (r0, c0), growing as needed. */
  const applyMatrix = (matrix: string[][], r0: number, c0: number, replace: boolean) => {
    if (matrix.length === 0) return;
    let columns = [...data.columns];
    let rows = replace ? [] : data.rows.map((row) => [...row]);
    let body = matrix;
    if (replace) {
      // First row is a header when its cells are mostly non-numeric.
      const first = matrix[0];
      if (looksLikeHeader(matrix)) {
        body = matrix.slice(1);
        columns = canAddColumns ? first.map((c, i) => c || columns[i] || `${roles.seriesLabel} ${i}`) : columns;
      }
      if (!canAddColumns) body = body.map((r) => r.slice(0, fixedCount));
    }
    const neededCols = c0 + Math.max(...body.map((r) => r.length));
    if (canAddColumns) {
      while (columns.length < neededCols) columns.push(`${roles.seriesLabel} ${columns.length - fixedCount + 1}`);
    }
    for (let i = 0; i < body.length; i++) {
      const r = r0 + i;
      while (rows.length <= r) rows.push(columns.map(() => ""));
      for (let j = 0; j < body[i].length; j++) {
        const c = c0 + j;
        if (c >= columns.length) break;
        while (rows[r].length < columns.length) rows[r].push("");
        rows[r][c] = body[i][j];
      }
    }
    rows = rows.map((r) => {
      const out = [...r];
      while (out.length < columns.length) out.push("");
      return out.slice(0, columns.length);
    });
    onChange({ columns, rows });
  };

  const onPaste = (e: ClipboardEvent<HTMLTableElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // single value → default input paste
    e.preventDefault();
    const matrix = parseDelimited(text);
    const target = e.target as HTMLElement;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    // Pasting a whole sheet (header row included) into the first cell means
    // "replace the table", exactly like the Yapıştır button; anywhere else it
    // fills from the focused cell the way Excel does.
    const wholeTable = !Number.isFinite(r) || r < 0 || (r === 0 && c === 0 && looksLikeHeader(matrix));
    if (wholeTable) applyMatrix(matrix, 0, 0, true);
    else applyMatrix(matrix, r, c, false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const move = (dr: number, dc: number) => {
      const next = wrapRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r + dr}"][data-c="${c + dc}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    };
    if (e.key === "Enter") {
      if (r === data.rows.length - 1) {
        addRow();
        setTimeout(() => move(1, 0), 0);
      } else move(1, 0);
    } else if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "Tab" && !e.shiftKey && c === data.columns.length - 1 && r === data.rows.length - 1) {
      addRow();
    }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj?.columns) && Array.isArray(obj?.rows)) {
          onChange({ columns: obj.columns.map(String), rows: obj.rows.map((r: unknown[]) => r.map(String)) });
          return;
        }
        if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === "object") {
          const cols = Object.keys(obj[0]);
          onChange({ columns: cols, rows: obj.map((o: Record<string, unknown>) => cols.map((k) => String(o[k] ?? ""))) });
          return;
        }
      } catch {
        /* fall through to delimited */
      }
    }
    applyMatrix(parseDelimited(text), 0, 0, true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-sm" onClick={() => addRow()}>
          + Satır
        </button>
        {canAddColumns && (
          <button className="btn btn-sm" onClick={addColumn}>
            + Seri
          </button>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <button className="btn btn-sm" onClick={() => setPasteOpen((v) => !v)} aria-pressed={pasteOpen}>
          Yapıştır
        </button>
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          CSV/JSON yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
        <button className="btn btn-sm" onClick={() => downloadText("veri.csv", toCsv(data.columns, data.rows), "text/csv")}>
          CSV indir
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button className="btn btn-sm btn-danger" onClick={() => onChange(sampleData(kind))}>
          Örnek veri
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {data.rows.length} satır · {data.columns.length} sütun
        </span>
      </div>

      {pasteOpen && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted p-2">
          <textarea
            className="inp font-mono text-[11px]"
            rows={6}
            placeholder={"Excel'den kopyalayıp buraya yapıştırın.\nİlk satır başlık olabilir; sütunlar sekme, ; veya , ile ayrılır."}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex gap-1.5">
            <button
              className="btn btn-sm btn-primary"
              disabled={!pasteText.trim()}
              onClick={() => {
                applyMatrix(parseDelimited(pasteText), 0, 0, true);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Tabloyu değiştir
            </button>
            <button
              className="btn btn-sm"
              disabled={!pasteText.trim()}
              onClick={() => {
                applyMatrix(parseDelimited(pasteText), data.rows.length, 0, false);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Alta ekle
            </button>
            <button className="btn btn-sm" onClick={() => setPasteOpen(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      <div className="grid-wrap min-h-0 flex-1" ref={wrapRef}>
        <table className="grid-table" onPaste={onPaste}>
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              {data.columns.map((col, c) => (
                <th key={c} style={{ position: "sticky" }}>
                  <div className="relative">
                    <input
                      value={col}
                      data-r={-1}
                      data-c={c}
                      onChange={(e) => setColumn(c, e.target.value)}
                      title={c < fixedCount ? roles.fixed[c] : `${roles.seriesLabel} ${c - fixedCount + 1}`}
                      placeholder={c < fixedCount ? roles.fixed[c] : roles.seriesLabel ?? ""}
                    />
                    {canAddColumns && c >= fixedCount && data.columns.length > fixedCount + 1 && (
                      <button
                        className="col-x btn btn-sm"
                        style={{ height: 16, padding: "0 4px", fontSize: 10 }}
                        title="Seriyi sil"
                        onClick={() => removeColumn(c)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r}>
                <td className="rownum">{r + 1}</td>
                {data.columns.map((_, c) => (
                  <td key={c} className={c >= 1 && (kind !== "sankey" || c >= 2) ? "num" : undefined}>
                    <input
                      value={row[c] ?? ""}
                      data-r={r}
                      data-c={c}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onKeyDown={(e) => onKeyDown(e, r, c)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </td>
                ))}
                <td className="rownum">
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    style={{ background: "none", border: 0, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                    title="Satırı sil"
                    onClick={() => removeRow(r)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {kind === "heatmap"
          ? "Tarih: 2025-03-14, 14.03.2025 veya 14/03/2025. Aynı güne düşen satırlar toplanır."
          : kind === "sankey"
            ? "Her satır bir akış: Kaynak → Hedef, Değer. Düğümler adlarından türetilir."
            : kind === "ring"
              ? "Hedef boşsa halka toplam içindeki payı gösterir; doluysa hedefe göre ilerlemeyi."
              : "İlk sütun kategori ya da tarih (Oca 2025, 2025-01, Ç1 2025…). Sayılar 1.250,5 veya 1,250.5 biçiminde olabilir."}
      </p>
    </div>
  );
}
