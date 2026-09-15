/**
 * Bir listenin satırlarını sürükleyerek yeniden sıralama.
 *
 * Pointer olayları, HTML5 drag-and-drop değil: sahne zaten pointer ile
 * sürüklüyor, ve başsız kontrol betikleri DnD olaylarını üretemiyor.
 *
 * Satırın kendisi tutamaç — ayrı bir tutamaç ikonu listede yer kaplıyor ve
 * hedefi küçültüyor. Sürükleme ancak eşik aşılınca başlar, böylece tıklayarak
 * seçmek ve çift tıklayarak ad değiştirmek bozulmaz.
 *
 * Metin seçimi iki ayrı yerde kapatılıyor ve ikisi de şart: satırların kendisi
 * seçilemez (`user-select`, CSS'te), çünkü basış seçilebilir bir metinden
 * başlarsa Chrome seçme hareketini üstleniyor ve sürüklemeyi `pointercancel`
 * ile iptal ediyor — sürükleme daha ilk adımda sessizce ölüyordu. Sürükleme
 * boyunca da gövdeye bir sınıf konuyor, yoksa imleç komşu panellerin metnini
 * tarayıp seçiyor.
 */
import { useCallback, useRef, useState } from "react";

/** Bu kadar piksel dikey hareket etmeden sürükleme sayılmaz. */
const ESIK = 4;

/** Sürükleme boyunca gövdede duran sınıf; seçimi kapatan CSS buna bakıyor. */
const GOVDE_SINIFI = "suruklerken";

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
  const [offsetY, setOffsetY] = useState(0);
  const drag = useRef<{ from: number; y0: number; canli: boolean } | null>(null);
  const hedef = useRef<number | null>(null);
  /** Sürüklemenin ardından gelen tıklama yutulsun mu — bkz. `onClickCapture`. */
  const yut = useRef(false);

  /**
   * İmlecin hangi iki satır arasına denk geldiği. Satırlar canlı ölçülüyor;
   * havalanan satırın ölçüsü kendi kaymasınca geri alınıyor, yoksa satır kendi
   * altından kayıp hedefi bir basamak şaşırtıyor.
   */
  const bosluk = useCallback((clientY: number, kalkan: number, dy: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-drag-row]") ?? [])];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      const top = i === kalkan ? r.top - dy : r.top;
      if (clientY < top + r.height / 2) return i;
    }
    return rows.length;
  }, []);

  const begin = useCallback(
    (index: number, e: React.PointerEvent) => {
      // Düğme ya da giriş kutusundan başlayan basış onların işi.
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select, textarea")) return;
      yut.current = false;
      drag.current = { from: index, y0: e.clientY, canli: false };

      const move = (ev: PointerEvent) => {
        const st = drag.current;
        if (!st) return;
        const dy = ev.clientY - st.y0;
        if (!st.canli) {
          if (Math.abs(dy) < ESIK) return;
          st.canli = true;
          document.body.classList.add(GOVDE_SINIFI);
          setDragging(st.from);
        }
        setOffsetY(dy);
        const g = bosluk(ev.clientY, st.from, dy);
        hedef.current = g;
        setDropAt(g);
      };

      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        document.body.classList.remove(GOVDE_SINIFI);
        const st = drag.current;
        const to = hedef.current;
        drag.current = null;
        hedef.current = null;
        setDragging(null);
        setDropAt(null);
        setOffsetY(0);
        if (!st?.canli) return;
        // Bırakmanın ardından gelen tıklama satırı bir de seçerdi. Bayrak bir
        // sonraki basışta sıfırlanıyor, yani tıklama hiç gelmezse de takılmıyor.
        yut.current = true;
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
      style: dragging === index ? { transform: `translateY(${offsetY}px)` } : undefined,
      ...(sabit
        ? {}
        : {
            onPointerDown: (e: React.PointerEvent) => begin(index, e),
            onClickCapture: (e: React.MouseEvent) => {
              if (!yut.current) return;
              yut.current = false;
              e.stopPropagation();
              e.preventDefault();
            },
          }),
    }),
    [begin, count, dragging, dropAt, offsetY]
  );

  return { listRef, rowProps, dragging, dropAt };
}
