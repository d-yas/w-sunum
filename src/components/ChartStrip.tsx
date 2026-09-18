/**
 * Sahnenin altındaki grafik şeridi.
 *
 * Eskiden sol sütunun tepesinde dikey bir listeydi. Kartlar 16:9 olduğu için
 * dikey listede her satır ya minicik bir küçük resim ya da yarım sütun yer
 * demekti; yatay şeritte aynı genişlikte üç kat daha fazla slayt görünüyor ve
 * sıralama hareketi slaytların gerçek sırasıyla aynı yöne gidiyor.
 *
 * Hareketler sunum araçlarının şeritlerinden alındı ve hepsinin tek bir
 * gerekçesi var — eli fareden kaldırmamak:
 *
 * - Kartı sürüklemek sırayı değiştirir; aradaki kartlar yer açar, bırakma yeri
 *   dikey bir çizgiyle gösterilir, kenara gelince şerit kendiliğinden kayar.
 * - Tekerlek şeridi yatay kaydırır (şeritte dikey kaydıracak bir şey yok).
 * - Aktif kart görünür alana kendiliğinden gelir; sıradaki slayda geçmek için
 *   önce onu aramak gerekmez.
 * - `←`/`→` kartlar arasında gezer, `Home`/`End` uçlara gider.
 * - İki kartın arasına gelince çıkan `+` yeni grafiği **oraya** ekler; sona
 *   eklemek için şeridin sonundaki düğme duruyor.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";

import { KIND_ICONS } from "@/lib/chart-icons";
import { KIND_LABELS, type ChartKind, type ChartSpec } from "@/lib/spec";
import type { Thumbs } from "@/lib/thumbnails";
import { useDragOrder } from "@/lib/use-drag-order";

import { KindGrid } from "./KindGrid";

/** Açılır kutunun ölçülmüş yeri — `position: fixed`, bkz. `yerlestir`. */
interface PopBox {
  left: number;
  bottom: number;
  width: number;
  maxHeight: number;
}

/** Kutunun hangi noktadan açıldığı: bir ara yeri, ya da şeridin sonu. */
type Ekleme = { index: number; x: number; y: number };

export function ChartStrip({
  charts,
  activeId,
  thumbs,
  previews,
  onPreviewHover,
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
  /** Tür kutusundaki örnek resimler; hazır olmayan tür ikonla kalır. */
  previews?: Partial<Record<ChartKind, string>>;
  onPreviewHover?: (kind: ChartKind | null) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  /** `index` verilmezse sona eklenir. */
  onAdd: (kind: ChartKind, index?: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [ekleme, setEkleme] = useState<Ekleme | null>(null);
  const [pop, setPop] = useState<PopBox | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // Kaydırma kutusu ile sürükleme listesi **aynı** öğe olmalı: kenarda
  // kendiliğinden kaydırma, kaydırılan kutunun kenarını ve `scrollLeft`ini
  // okuyor. İçeride ayrı bir sarmalayıcı olsaydı onun genişliği görünür alan
  // değil içerik kadar olurdu ve kenar hiç yakalanmazdı.
  const drag = useDragOrder(charts.length, onReorder, "x");
  const seritRef = drag.listRef;

  // Dışarı tıklama ve Esc açılır kutuyu kapatır — kutu sahnenin üstüne binen
  // mutlak konumlu bir katman, kapanmazsa kartı kullanılmaz hâle getirir.
  useEffect(() => {
    if (!ekleme) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (popRef.current?.contains(t) || t.closest("[data-ekle]")) return;
      setEkleme(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEkleme(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ekleme]);

  // Kutu basılan noktanın üstüne açılır, sol kenarı ona hizalı. Konum CSS'le
  // değil ölçüyle: `fixed` olduğu için ne şeridin ne sahnenin kırpması onu
  // tutar, ama o zaman koordinatı da kimse hesaplamaz.
  useEffect(() => {
    if (!ekleme) {
      setPop(null);
      return;
    }
    const yerlestir = () => {
      const bottom = window.innerHeight - ekleme.y + 8;
      const maxHeight = Math.max(160, ekleme.y - 16);
      const width = Math.max(320, Math.min(720, window.innerWidth - 32));
      const left = Math.max(8, Math.min(ekleme.x, window.innerWidth - 8 - width));
      setPop({ left, bottom, width, maxHeight });
    };
    yerlestir();
    window.addEventListener("resize", yerlestir);
    return () => window.removeEventListener("resize", yerlestir);
  }, [ekleme]);

  // Aktif kart görünür alana gelsin. Sürüklerken değil: orada kaydırmayı
  // sürükleme yönetiyor ve ikisi birbiriyle kavga ederdi.
  useEffect(() => {
    if (drag.dragging != null) return;
    const el = seritRef.current?.querySelector<HTMLElement>(`.strip-card[data-id="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId, drag.dragging]);

  /** Tekerlek şeridi yatay kaydırır; burada kaydırılacak dikey bir şey yok. */
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = seritRef.current;
    if (!el || e.deltaY === 0 || e.shiftKey) return;
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
  };

  /** `←`/`→` kartlar arasında gezer, `Home`/`End` uçlara gider. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(charts[i].id);
      return;
    }
    const hedef =
      e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? charts.length - 1 : null;
    if (hedef == null) return;
    e.preventDefault();
    const c = charts[Math.max(0, Math.min(charts.length - 1, hedef))];
    onSelect(c.id);
    seritRef.current?.querySelector<HTMLElement>(`.strip-card[data-id="${CSS.escape(c.id)}"]`)?.focus();
  };

  /**
   * İki kartın arasındaki ekleme noktası. Sürüklerken görünmez ama **yerinde
   * kalır**: kaldırılsaydı kartlar sürüklemenin ortasında kayar ve ölçülmüş
   * hedef hesabı zıplardı.
   */
  const araNokta = (index: number) => (
    <button
      type="button"
      className="strip-slot"
      data-sessiz={drag.dragging != null ? "" : undefined}
      tabIndex={-1}
      data-ekle={index}
      aria-label={`Buraya yeni grafik ekle (${index + 1}. sıra)`}
      title="Buraya yeni grafik ekle"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setEkleme((v) => (v?.index === index ? null : { index, x: r.left, y: r.top }));
      }}
    >
      <span className="strip-slot-cizgi" aria-hidden />
      <span className="strip-slot-arti" aria-hidden>
        <Plus size={12} />
      </span>
    </button>
  );

  return (
    <div className="strip flex shrink-0 items-stretch border-t border-border bg-card">
      <div className="strip-kaydir flex min-w-0 flex-1 items-center overflow-x-auto px-1 py-2" ref={seritRef} onWheel={onWheel}>
        {charts.map((c, i) => {
            const Icon = KIND_ICONS[c.kind];
            return (
              <div key={c.id} className="flex shrink-0 items-center">
                {araNokta(i)}
                <div
                  className="chart-row strip-card"
                  data-id={c.id}
                  role="option"
                  aria-selected={c.id === activeId}
                  tabIndex={0}
                  title="Sırayı değiştirmek için sürükleyin"
                  {...drag.rowProps(i)}
                  onClick={() => onSelect(c.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className="strip-no" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="chart-thumb" aria-hidden>
                    {thumbs[c.id] ? <img src={thumbs[c.id]} alt="" /> : <Icon size={20} strokeWidth={1.6} />}
                  </div>
                  {editing === c.id ? (
                    <input
                      className="inp h-5 w-full text-[11px]"
                      autoFocus
                      defaultValue={c.name}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        onRename(c.id, e.target.value.trim() || c.name);
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                  ) : (
                    <div
                      className="chart-name"
                      onDoubleClick={() => setEditing(c.id)}
                      title={`${c.name} — ${KIND_LABELS[c.kind]}. Adı değiştirmek için çift tıkla`}
                    >
                      {c.name}
                    </div>
                  )}
                  <div className="chart-acts">
                    <button
                      className="icon-btn"
                      title="Sola taşı"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(c.id, -1);
                      }}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Sağa taşı"
                      disabled={i === charts.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(c.id, 1);
                      }}
                    >
                      <ChevronRight size={13} />
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
              </div>
            );
          })}
        {araNokta(charts.length)}
      </div>

      <div className="flex shrink-0 items-center border-l border-border px-2">
        <button
          className="strip-add"
          data-ekle="son"
          aria-expanded={ekleme != null}
          title="Sona yeni grafik ekle"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setEkleme((v) => (v ? null : { index: charts.length, x: r.left, y: r.top }));
          }}
        >
          <Plus size={16} />
          <span>Yeni grafik</span>
        </button>
      </div>

      {ekleme && pop && (
        <div
          className="kind-pop"
          ref={popRef}
          style={{ left: pop.left, bottom: pop.bottom, width: pop.width, maxHeight: pop.maxHeight }}
        >
          <KindGrid
            wide
            previews={previews}
            onHover={onPreviewHover}
            onPick={(k) => {
              onAdd(k, ekleme.index);
              setEkleme(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
