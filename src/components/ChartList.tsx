/**
 * Sol paneldeki grafik listesi.
 *
 * Sıra iki yoldan değişir: satırı sürükleyerek, ya da `↑`/`↓` düğmeleriyle.
 * Düğmeler duruyor çünkü klavyeyle ve başsız kontrol betiğinden tıklanabilen
 * tek yol onlar; sürükleme ise listeyi tek hamlede baştan sona taşıyabildiği
 * için tek tek adım atmaktan hızlı.
 *
 * "+ Yeni grafik" kutusu panelin yanına açılır. 300 px'lik sütuna sıkışınca
 * yukarı taşıp kesiliyordu; yana açılınca 23 türün hepsi tek bakışta görünüyor.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

import { KIND_ICONS } from "@/lib/chart-icons";
import { KIND_LABELS, type ChartKind, type ChartSpec } from "@/lib/spec";
import type { Thumbs } from "@/lib/thumbnails";
import { useDragOrder } from "@/lib/use-drag-order";

import { KindGrid } from "./KindGrid";

/** Açılır kutunun ölçülmüş yeri — `position: fixed`, bkz. `place`. */
interface PopBox {
  left: number;
  bottom: number;
  width: number;
  maxHeight: number;
}

export function ChartList({
  charts,
  activeId,
  thumbs,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
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
  onReorder: (from: number, to: number) => void;
  onAdd: (kind: ChartKind) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pop, setPop] = useState<PopBox | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const drag = useDragOrder(charts.length, onReorder);

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

  // Kutu düğmenin sağına, alt kenarları hizalı açılır. Konum CSS'le değil
  // ölçüyle: `fixed` olduğu için ne panelin ne de sahnenin kırpması onu tutar,
  // ama o zaman koordinatı da kimse hesaplamaz.
  //
  // İki geçiş: ilkinde kutu henüz yok, düğmenin alt hizasına konur; çizildikten
  // sonra gerçek yüksekliği ölçülüp ekranın dışına taşmayacak kadar yukarı
  // kaydırılır. Tek geçişte yapılamaz, çünkü 23 türün kapladığı yer yazı
  // boyutuna ve sarmaya bağlı.
  useEffect(() => {
    if (!adding) {
      setPop(null);
      return;
    }
    const place = () => {
      const r = addRef.current?.getBoundingClientRect();
      if (!r) return;
      const maxHeight = window.innerHeight - 16;
      const width = Math.max(320, Math.min(640, window.innerWidth - r.right - 16));
      const h = Math.min(popRef.current?.scrollHeight ?? 0, maxHeight);
      const bottom = Math.min(Math.max(8, window.innerHeight - r.bottom), Math.max(8, window.innerHeight - 8 - h));
      setPop({ left: r.right + 6, bottom, width, maxHeight });
    };
    place();
    const again = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(again);
      window.removeEventListener("resize", place);
    };
  }, [adding]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5" ref={drag.listRef}>
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
              title="Sırayı değiştirmek için sürükleyin"
              {...drag.rowProps(i)}
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

      <div className="shrink-0 border-t border-border p-2" ref={addRef}>
        <button className="btn w-full justify-center" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
          <Plus size={14} /> Yeni grafik
        </button>
        {adding && pop && (
          <div className="kind-pop" ref={popRef} style={{ left: pop.left, bottom: pop.bottom, width: pop.width, maxHeight: pop.maxHeight }}>
            <KindGrid
              wide
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
