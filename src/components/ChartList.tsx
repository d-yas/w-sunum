/**
 * Sol paneldeki grafik listesi.
 *
 * Sıralama sürükleyerek değil `↑`/`↓` düğmeleriyle yapılıyor — dekor
 * listesindeki (`DecorPanel`) kalıbın aynısı. Sürükleme burada bir şey
 * kazandırmıyor: liste kısa, hedef belirsiz değil, ve düğme hem klavyeyle hem
 * de başsız testten tıklanabilir.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

import { KIND_ICONS } from "@/lib/chart-icons";
import { KIND_LABELS, type ChartKind, type ChartSpec } from "@/lib/spec";
import type { Thumbs } from "@/lib/thumbnails";

import { KindGrid } from "./KindGrid";

export function ChartList({
  charts,
  activeId,
  thumbs,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onAdd,
}: {
  charts: ChartSpec[];
  activeId: string;
  thumbs: Thumbs;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAdd: (kind: ChartKind) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklama ve Esc açılır kutuyu kapatır — kutu panelin üstüne binen
  // mutlak konumlu bir katman, kapanmazsa listeyi kullanılmaz hâle getirir.
  useEffect(() => {
    if (!adding) return;
    const onDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAdding(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdding(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [adding]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5">
        {charts.map((c, i) => {
          const Icon = KIND_ICONS[c.kind];
          return (
            <div
              key={c.id}
              className="chart-row"
              data-id={c.id}
              role="option"
              aria-selected={c.id === activeId}
              tabIndex={0}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(c.id);
                }
              }}
            >
              <div className="chart-thumb" aria-hidden>
                {thumbs[c.id] ? <img src={thumbs[c.id]} alt="" /> : <Icon size={18} strokeWidth={1.6} />}
              </div>
              <div className="grow">
                {editing === c.id ? (
                  <input
                    className="inp h-6 w-full text-[12px]"
                    autoFocus
                    defaultValue={c.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      onRename(c.id, e.target.value.trim() || c.name);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="chart-name" onDoubleClick={() => setEditing(c.id)} title="Adı değiştirmek için çift tıkla">
                      {c.name}
                    </div>
                    <div className="chart-kind">{KIND_LABELS[c.kind]}</div>
                  </>
                )}
              </div>
              <div className="chart-acts">
                <button
                  className="icon-btn"
                  title="Yukarı taşı"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(c.id, -1);
                  }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  className="icon-btn"
                  title="Aşağı taşı"
                  disabled={i === charts.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(c.id, 1);
                  }}
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  className="icon-btn"
                  title="Kopyala"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(c.id);
                  }}
                >
                  <Copy size={13} />
                </button>
                <button
                  className="icon-btn danger"
                  title="Sil"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative shrink-0 border-t border-border p-2" ref={addRef}>
        <button className="btn w-full justify-center" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
          <Plus size={14} /> Yeni grafik
        </button>
        {adding && (
          <div className="kind-pop">
            <KindGrid
              onPick={(k) => {
                onAdd(k);
                setAdding(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
