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
 *
 * Yer açma `transform` ile: aradaki satırlar kayıp boşluğu açıyor, ama düzen
 * hiç değişmiyor. Listeye gerçek bir boş kutu eklemek satırların ölçülerini
 * sürüklemenin ortasında oynatır ve hedef hesabı zıplamaya başlar.
 */
import { useCallback, useRef, useState } from "react";

/** Bu kadar piksel dikey hareket etmeden sürükleme sayılmaz. */
const ESIK = 4;

/** Sürükleme boyunca gövdede duran sınıf; seçimi kapatan CSS buna bakıyor. */
const GOVDE_SINIFI = "suruklerken";

/** Bir satırın sürükleme başındaki yeri — listenin üst kenarına göre. */
interface Taban {
  top: number;
  h: number;
}

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
  /** Sürüklenen satırın kendi yuvası: yüksekliği + komşuya kalan boşluk. */
  const [yuva, setYuva] = useState(0);
  const drag = useRef<{ from: number; y0: number; canli: boolean } | null>(null);
  const hedef = useRef<number | null>(null);
  /** Sürüklemenin ardından gelen tıklama yutulsun mu — bkz. `onClickCapture`. */
  const yut = useRef(false);
  /**
   * Satırların sürükleme başındaki yerleri. Bir kez ölçülüyor: hesap böylece
   * kendi uyguladığı kaymalardan etkilenmiyor. Liste kendi içinde kaydırılırsa
   * fark `scroll0` üzerinden düşülüyor.
   */
  const taban = useRef<{ rows: Taban[]; scroll0: number } | null>(null);

  const olc = useCallback(() => {
    const list = listRef.current;
    if (!list) return null;
    const lr = list.getBoundingClientRect();
    const rows = [...list.querySelectorAll<HTMLElement>("[data-drag-row]")].map((el) => {
      const q = el.getBoundingClientRect();
      return { top: q.top - lr.top, h: q.height };
    });
    return { rows, scroll0: list.scrollTop };
  }, []);

  /** İmlecin hangi iki satır arasına denk geldiği — taban ölçülerine göre. */
  const bosluk = useCallback((clientY: number) => {
    const list = listRef.current;
    const t = taban.current;
    if (!list || !t) return null;
    const lr = list.getBoundingClientRect();
    const kaydi = list.scrollTop - t.scroll0;
    for (let i = 0; i < t.rows.length; i++) {
      const top = lr.top + t.rows[i].top - kaydi;
      if (clientY < top + t.rows[i].h / 2) return i;
    }
    return t.rows.length;
  }, []);

  const begin = useCallback(
    (index: number, e: React.PointerEvent) => {
      // Düğme ya da giriş kutusundan başlayan basış onların işi.
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select, textarea")) return;
      const t = olc();
      if (!t || index >= t.rows.length) return;
      yut.current = false;
      taban.current = t;
      drag.current = { from: index, y0: e.clientY, canli: false };

      // Satırların yüksekliği eşit değil (dekor listesindeki grafik ayıracı
      // daha kısa), o yüzden yuva komşuya olan mesafeden hesaplanıyor.
      const r = t.rows;
      const aralik =
        index + 1 < r.length
          ? r[index + 1].top - r[index].top - r[index].h
          : index > 0
            ? r[index].top - r[index - 1].top - r[index - 1].h
            : 0;

      const move = (ev: PointerEvent) => {
        const st = drag.current;
        if (!st) return;
        const dy = ev.clientY - st.y0;
        if (!st.canli) {
          if (Math.abs(dy) < ESIK) return;
          st.canli = true;
          document.body.classList.add(GOVDE_SINIFI);
          setYuva(r[st.from].h + aralik);
          setDragging(st.from);
        }
        setOffsetY(dy);
        const g = bosluk(ev.clientY);
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
        taban.current = null;
        setDragging(null);
        setDropAt(null);
        setOffsetY(0);
        if (!st?.canli) return;
        // Bırakmanın ardından gelen tıklama satırı bir de seçerdi. Tıklama
        // `pointerup` ile aynı turda geliyor, o yüzden bayrağı bir sonraki
        // makro göreve bırakmak yetiyor — ve orada kendiliğinden düşüyor.
        // Basışta sıfırlamak yeterli değildi: `pointerdown` üretmeyen bir
        // tıklama (betikler, erişilebilirlik araçları) bayrağı hiç açmadan
        // gelip yutuluyordu.
        yut.current = true;
        setTimeout(() => {
          yut.current = false;
        }, 0);
        if (to == null) return;
        const target = to > st.from ? to - 1 : to;
        if (target !== st.from) onReorder(st.from, target);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    },
    [bosluk, olc, onReorder]
  );

  /**
   * Bir satırın kayması. Sürüklenen satır parmağı takip eder; kaynak ile hedef
   * arasında kalanlar bir yuva boyu kayıp bırakılacak yeri açar.
   */
  const kayma = useCallback(
    (i: number) => {
      if (dragging == null) return 0;
      if (i === dragging) return offsetY;
      if (dropAt == null) return 0;
      if (dropAt > dragging && i > dragging && i < dropAt) return -yuva;
      if (dropAt <= dragging && i >= dropAt && i < dragging) return yuva;
      return 0;
    },
    [dragging, dropAt, offsetY, yuva]
  );

  const rowProps = useCallback(
    (index: number, sabit = false) => {
      const dy = kayma(index);
      return {
        "data-drag-row": index,
        "data-dragging": dragging === index ? "" : undefined,
        "data-drop-before": dropAt === index ? "" : undefined,
        // Son boşluk için satırın altına — öncesi diye işaretlenecek satır yok.
        "data-drop-after": dropAt === count && index === count - 1 ? "" : undefined,
        style: dy === 0 ? undefined : { transform: `translateY(${dy}px)` },
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
      };
    },
    [begin, count, dragging, dropAt, kayma]
  );

  return { listRef, rowProps, dragging, dropAt };
}
