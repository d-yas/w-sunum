/**
 * Bir listenin satırlarını sürükleyerek yeniden sıralama.
 *
 * Pointer olayları, HTML5 drag-and-drop değil: sahne zaten pointer ile
 * sürüklüyor, ve başsız kontrol betikleri DnD olaylarını üretemiyor.
 *
 * Satırın kendisi tutamaç — ayrı bir tutamaç ikonu listede yer kaplıyor ve
 * hedefi küçültüyor. Sürükleme ancak eşik aşılınca başlar, böylece tıklayarak
 * seçmek ve çift tıklayarak ad değiştirmek bozulmaz; gerçekten sürüklendiyse
 * arkadan gelen `click` yutulur, yoksa satır bırakıldığı anda bir de seçilirdi.
 */
import { useCallback, useRef, useState } from "react";

/** Bu kadar piksel dikey hareket etmeden sürükleme sayılmaz. */
const ESIK = 4;

export interface DragOrder {
  /** Satırları saran öğeye verilecek ref. */
  listRef: React.RefObject<HTMLDivElement | null>;
  /** Her satıra yayılacak öznitelikler. `sabit` satırlar taşınmaz ama sırada yer tutar. */
  rowProps: (index: number, sabit?: boolean) => Record<string, unknown>;
  /** Sürüklenen satırın indisi. */
  dragging: number | null;
  /** Bırakma çizgisinin çizileceği boşluk: 0…satır sayısı. */
  dropAt: number | null;
}

export function useDragOrder(count: number, onReorder: (from: number, to: number) => void): DragOrder {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const drag = useRef<{ from: number; y0: number; canli: boolean } | null>(null);
  const hedef = useRef<number | null>(null);

  /** İmlecin hangi iki satır arasına denk geldiği — satırlar canlı ölçülür. */
  const bosluk = useCallback((clientY: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-drag-row]") ?? [])];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return rows.length;
  }, []);

  const begin = useCallback(
    (index: number, e: React.PointerEvent) => {
      // Düğme ya da giriş kutusundan başlayan basış onların işi.
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select, textarea")) return;
      drag.current = { from: index, y0: e.clientY, canli: false };

      const move = (ev: PointerEvent) => {
        const st = drag.current;
        if (!st) return;
        if (!st.canli) {
          if (Math.abs(ev.clientY - st.y0) < ESIK) return;
          st.canli = true;
          setDragging(st.from);
        }
        const g = bosluk(ev.clientY);
        hedef.current = g;
        setDropAt(g);
      };

      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        const st = drag.current;
        const to = hedef.current;
        drag.current = null;
        hedef.current = null;
        setDragging(null);
        setDropAt(null);
        if (!st?.canli) return;
        const yut = (c: Event) => {
          c.stopPropagation();
          c.preventDefault();
        };
        // Bırakmanın ardından gelen tıklamayı yut. Tıklama gelmezse dinleyici
        // bir sonraki tıklamayı kaçırmasın diye kendini hemen söker.
        document.addEventListener("click", yut, { capture: true, once: true });
        setTimeout(() => document.removeEventListener("click", yut, { capture: true }), 0);
        if (to == null) return;
        const target = to > st.from ? to - 1 : to;
        if (target !== st.from) onReorder(st.from, target);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    },
    [bosluk, onReorder]
  );

  const rowProps = useCallback(
    (index: number, sabit = false) => ({
      "data-drag-row": index,
      "data-dragging": dragging === index ? "" : undefined,
      "data-drop-before": dropAt === index ? "" : undefined,
      // Son boşluk için satırın altına — öncesi diye işaretlenecek satır yok.
      "data-drop-after": dropAt === count && index === count - 1 ? "" : undefined,
      ...(sabit ? {} : { onPointerDown: (e: React.PointerEvent) => begin(index, e) }),
    }),
    [begin, count, dragging, dropAt]
  );

  return { listRef, rowProps, dragging, dropAt };
}
