/**
 * Direct manipulation for everything the card can hold: placed decoration,
 * and — once free layout is on — the card's own title block, chart and note.
 *
 * Deliberately *outside* the card. ChartCard's contract is that it renders the
 * exact DOM that gets rasterised, so selection outlines and drag handles must
 * never live inside it. This overlay sits on the stage, over the scaled card
 * box, and only while the Süsle tab is open — which is what keeps chart
 * tooltips working everywhere else.
 *
 * All arithmetic is in card space; the stage's zoom is divided out on the way
 * in and multiplied back on the way out.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { Box, DecorItem, DecorSlot, SlotKey } from "@/decor/model";
import { SLOT_KEYS, SLOT_LABELS, grubuCoz, grupGenislet, grupla, restack, restackEnd } from "@/decor/model";
import { getAsset, newItem, otomatikBoy } from "@/decor/registry";
import { defaults, num, str, type AssetDef, type ZeminSlot } from "@/decor/types";
import type { ChartSpec } from "@/lib/spec";

import type { Arac } from "./Toolbar";

type Corner = "nw" | "ne" | "sw" | "se" | "w" | "e";
type Mode = { kind: "tasi" } | { kind: "boyut"; corner: Corner } | { kind: "dondur" } | { kind: "uc"; uc: "bas" | "son" };

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
/** Yalnız genişliği değişen kutular (metin) için: yükseklik metnin işi. */
const EDGES: Corner[] = ["w", "e"];
const SIGN: Record<Corner, [number, number]> = {
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
  w: [-1, 0],
  e: [1, 0],
};

interface Nokta {
  x: number;
  y: number;
}
/** How close, in card px, a drag has to get before it snaps to a guide. */
const SNAP = 5;

/** Slot ids are namespaced so one id space covers decoration and card parts. */
const slotId = (k: SlotKey) => `slot:${k}`;
const asSlot = (id: string): SlotKey | null => (id.startsWith("slot:") ? (id.slice(5) as SlotKey) : null);

/** What the overlay can drag: a decoration item or one of the card's own parts. */
interface Handle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  aci: number;
  kilit: boolean;
  /** Card parts do not rotate, mirror or delete — only move and resize. */
  slot: SlotKey | null;
  square: boolean;
  min: number;
  label: string;
  /** Süsleme nesnesinin tanımı — tutamaç setini o belirliyor. Kart parçalarında `null`. */
  def: AssetDef | null;
}

interface Drag {
  mode: Mode;
  id: string;
  start: Handle;
  px: number;
  py: number;
  /** Çoklu seçimde birlikte taşınanların başlangıç yerleri. */
  birlikte: { id: string; x: number; y: number }[] | null;
  /**
   * Uç sürüklenirken **yerinde kalan** uç, mutlak kart koordinatında.
   * Yüzdeden yeniden okunamaz: kutu her karede yeniden yazıldığı için aynı
   * yüzde her karede başka bir noktayı gösterirdi.
   */
  sabitUc: Nokta | null;
}

export interface DecorStageProps {
  spec: ChartSpec;
  scale: number;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (s: ChartSpec) => void;
  /** Etkin araç. `metin` ve `cizgi` sahnede çizim yapar, `sec` seçer. */
  arac: Arac;
  onArac: (a: Arac) => void;
}

/**
 * Pointer capture is a convenience, not a requirement: it keeps a fast drag
 * alive when the cursor outruns the element. It throws when there is no live
 * pointer for the id — a synthetic event, or a pointer already released — and
 * a drag must not die because of that.
 */
function capture(e: ReactPointerEvent) {
  try {
    (e.target as Element).setPointerCapture(e.pointerId);
  } catch {
    /* pointer already gone; the window-level handlers still track the drag */
  }
}

/**
 * Yerinde düzenleme kutusunun biçemi.
 *
 * Amaç birebir aynı yerleşim değil — yazarken okunaklı ve kabaca aynı
 * görünen bir alan. Punto, kalınlık, hiza ve iç boşluk varlığın kendi
 * parametrelerinden okunuyor; adları paylaşan balon ve rozet de bedavaya
 * doğru görünüyor, bilmeyen varlıklar makul varsayılanlara düşüyor.
 */
function metinBicemi(n: DecorItem, def: AssetDef, scale: number): React.CSSProperties {
  const p = { ...defaults(def), ...n.params };
  const punto = num(p, "punto", 16) * scale;
  const hiza = str(p, "hiza", "sol");
  return {
    fontSize: punto,
    fontWeight: str(p, "kalinlik", "500"),
    lineHeight: num(p, "satir", 1.3),
    padding: Math.max(2, num(p, "bosluk", 6) * scale),
    textAlign: hiza === "orta" ? "center" : hiza === "sag" ? "right" : "left",
  };
}

const rot = (x: number, y: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c] as const;
};

export function DecorStage({ spec, scale, selectedIds, onSelect, onChange, arac, onArac }: DecorStageProps) {
  /** Tek seçim; tutamaçlar ancak bir nesne seçiliyken çıkıyor. */
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const { width: CW, height: CH } = spec.options;

  const items = spec.decor.nesneler;
  const free = spec.yerlesim.serbest;
  const hiddenSlots = spec.yerlesim.gizli;

  const handles: Handle[] = [
    ...items
      .filter((n) => !n.gizli)
      .map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        aci: n.aci,
        kilit: n.kilit,
        slot: null,
        square: getAsset(n.asset)?.square === true,
        min: 8,
        label: getAsset(n.asset)?.label ?? n.asset,
        def: getAsset(n.asset),
      })),
    ...(free
      ? SLOT_KEYS.flatMap((k) => {
          const b = spec.yerlesim.kutular[k];
          if (!b || hiddenSlots.includes(k)) return [];
          return [{ id: slotId(k), ...b, aci: 0, kilit: false, slot: k, square: false, min: 24, label: SLOT_LABELS[k], def: null }];
        })
      : []),
  ];

  const setItems = (next: DecorItem[]) => onChange({ ...spec, decor: { ...spec.decor, nesneler: next } });

  const patch = (id: string, p: Partial<Box> & { aci?: number }) => {
    const key = asSlot(id);
    if (key) {
      const cur = spec.yerlesim.kutular[key];
      if (!cur) return;
      onChange({ ...spec, yerlesim: { ...spec.yerlesim, kutular: { ...spec.yerlesim.kutular, [key]: { ...cur, ...p } } } });
      return;
    }
    // `otomatikBoy`: bir metin kutusu genişletilince yüksekliği de yeniden
    // hesaplanmalı, ve boyutlandırma her karede buradan geçtiği için kutu
    // sürüklerken büyüyor — bırakınca zıplamıyor.
    setItems(items.map((n) => (n.id === id ? otomatikBoy({ ...n, ...p }) : n)));
  };

  /* ---------------- iki uçlu nesneler ---------------- */

  /** Bir bağlantının uçları, mutlak kart koordinatında. */
  const ucNoktalari = (n: DecorItem, def: AssetDef): [Nokta, Nokta] => {
    const u = def.uclar!;
    const p = { ...defaults(def), ...n.params };
    return [
      { x: n.x + (num(p, u.x1, 0) / 100) * n.w, y: n.y + (num(p, u.y1, 100) / 100) * n.h },
      { x: n.x + (num(p, u.x2, 100) / 100) * n.w, y: n.y + (num(p, u.y2, 0) / 100) * n.h },
    ];
  };

  /**
   * İki noktadan bir bağlantı kurar: kutu, iki ucun sınırlayıcı dikdörtgeni
   * artı çizgi kalınlığı/ok başı payı; uçlar o kutunun yüzdesi olarak yazılır.
   *
   * Saf: hem uç sürüklemesi hem de çizerek oluşturma aynı işlevi çağırıyor, o
   * yüzden "çizilen" ile "sonradan düzeltilen" bir bağlantı ayırt edilemez.
   */
  const ucluKur = (n: DecorItem, def: AssetDef, A: Nokta, B: Nokta): DecorItem => {
    const u = def.uclar!;
    const pay = u.pay?.({ ...defaults(def), ...n.params }) ?? 8;
    const x = Math.round(Math.min(A.x, B.x) - pay);
    const y = Math.round(Math.min(A.y, B.y) - pay);
    const w = Math.max(8, Math.round(Math.abs(B.x - A.x) + 2 * pay));
    const h = Math.max(8, Math.round(Math.abs(B.y - A.y) + 2 * pay));
    // Yüzdeler **yuvarlanmış** kutuya göre: yuvarlamadan önce hesaplasak uç,
    // her sürükleme karesinde yarım piksel kayardı.
    const yzd = (v: number, o: number, boy: number) => Math.round(((v - o) / boy) * 10000) / 100;
    return {
      ...n,
      x,
      y,
      w,
      h,
      aci: 0,
      aynala: false,
      params: {
        ...n.params,
        [u.x1]: yzd(A.x, x, w),
        [u.y1]: yzd(A.y, y, h),
        [u.x2]: yzd(B.x, x, w),
        [u.y2]: yzd(B.y, y, h),
      },
    };
  };

  const ucYaz = (id: string, A: Nokta, B: Nokta) => {
    setItems(
      items.map((n) => {
        if (n.id !== id) return n;
        const def = getAsset(n.asset);
        return def?.uclar ? ucluKur(n, def, A, B) : n;
      })
    );
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Never steal keys from the panel's own inputs.
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "Escape") return onSelect([]);

      // Gruplama çoklu seçimle çalışıyor, o yüzden tek seçim şartından önce.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        const nesneler = selectedIds.filter((id) => !asSlot(id));
        if (e.shiftKey) onChange({ ...spec, decor: grubuCoz(spec.decor, nesneler) });
        else if (nesneler.length > 1) onChange({ ...spec, decor: grupla(spec.decor, nesneler) });
        return;
      }

      if (selectedIds.length > 1) {
        const secili = items.filter((n) => selectedIds.includes(n.id) && !n.kilit);
        if ((e.key === "Delete" || e.key === "Backspace") && secili.length) {
          e.preventDefault();
          setItems(items.filter((n) => !secili.some((m) => m.id === n.id)));
          onSelect([]);
          return;
        }
        const adim = e.shiftKey ? 10 : 1;
        const it: Record<string, [number, number]> = {
          ArrowLeft: [-adim, 0],
          ArrowRight: [adim, 0],
          ArrowUp: [0, -adim],
          ArrowDown: [0, adim],
        };
        const dd = it[e.key];
        if (dd && secili.length) {
          e.preventDefault();
          setItems(items.map((n) => (secili.some((m) => m.id === n.id) ? { ...n, x: n.x + dd[0], y: n.y + dd[1] } : n)));
        }
        return;
      }

      if (!selectedId) return;
      const h = handles.find((b) => b.id === selectedId);
      if (!h) return;

      if (h.slot) {
        // Delete on a card part hides it rather than destroying anything: the
        // title text stays in the spec, and the panel can put it back.
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onChange({ ...spec, yerlesim: { ...spec.yerlesim, gizli: [...hiddenSlots, h.slot] } });
          onSelect([]);
          return;
        }
      } else {
        const it = items.find((n) => n.id === selectedId);
        if (!it) return;
        if ((e.key === "Delete" || e.key === "Backspace") && !it.kilit) {
          e.preventDefault();
          setItems(items.filter((n) => n.id !== selectedId));
          onSelect([]);
          return;
        }
        if (e.key === "[" || e.key === "]") {
          e.preventDefault();
          const dir = e.key === "]" ? 1 : -1;
          setItems(e.shiftKey ? restackEnd(items, it.id, dir === 1 ? "on" : "arka") : restack(items, it.id, dir));
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          e.preventDefault();
          const copy = newItem(it.asset, CW, CH);
          if (!copy) return;
          const clone: DecorItem = { ...it, id: copy.id, x: it.x + 16, y: it.y + 16 };
          setItems([...items, clone]);
          onSelect([clone.id]);
          return;
        }
      }

      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = nudge[e.key];
      if (d && !h.kilit) {
        e.preventDefault();
        patch(h.id, { x: h.x + d[0], y: h.y + d[1] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------------- pointer ---------------- */

  const toCard = (e: { clientX: number; clientY: number }) => {
    const r = hostRef.current?.getBoundingClientRect();
    if (!r) return [0, 0] as const;
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale] as const;
  };

  /**
   * Background assets fill the card, so there is no box to grab. The ones that
   * declare an anchor get a dot at their centre instead, dragged in percent.
   */
  const anchors = (["isik", "doku", "cerceve"] as ZeminSlot[]).flatMap((key) => {
    const slotData: DecorSlot | null = spec.decor.zemin[key];
    if (!slotData) return [];
    const def = getAsset(slotData.asset);
    if (!def?.anchor) return [];
    const px = def.anchor.x ? num({ ...Object.fromEntries((def.params ?? []).map((q) => [q.key, q.def])), ...slotData.params }, def.anchor.x, 50) : 50;
    const py = def.anchor.y ? num({ ...Object.fromEntries((def.params ?? []).map((q) => [q.key, q.def])), ...slotData.params }, def.anchor.y, 50) : 50;
    return [{ key, def, slotData, px, py }];
  });

  const dragAnchor = useRef<{ key: ZeminSlot } | null>(null);

  const onAnchorMove = (e: ReactPointerEvent) => {
    const a = dragAnchor.current;
    if (!a) return;
    const entry = anchors.find((x) => x.key === a.key);
    if (!entry) return;
    const [cx, cy] = toCard(e);
    const next = { ...entry.slotData.params };
    if (entry.def.anchor?.x) next[entry.def.anchor.x] = Math.round(Math.min(120, Math.max(-20, (cx / CW) * 100)));
    if (entry.def.anchor?.y) next[entry.def.anchor.y] = Math.round(Math.min(120, Math.max(-20, (cy / CH) * 100)));
    onChange({ ...spec, decor: { ...spec.decor, zemin: { ...spec.decor.zemin, [a.key]: { ...entry.slotData, params: next } } } });
  };

  /**
   * Bir kutuya basmak. `Shift` seçime ekler/çıkarır; düz basış, tıklanan
   * öğenin grubunu seçer — grup olmanın anlamı bu.
   */
  const sec = (id: string, ekle: boolean): string[] => {
    if (asSlot(id)) return [id];
    if (ekle) {
      const var_ = selectedIds.includes(id);
      const ham = var_ ? selectedIds.filter((x) => x !== id) : [...selectedIds.filter((x) => !asSlot(x)), id];
      return grupGenislet(items, ham);
    }
    return grupGenislet(items, [id]);
  };

  const begin = (e: ReactPointerEvent, id: string, mode: Mode) => {
    const h = handles.find((b) => b.id === id);
    if (!h || h.kilit) return;
    e.preventDefault();
    e.stopPropagation();
    capture(e);
    const [px, py] = toCard(e);
    const next = mode.kind === "tasi" ? sec(id, e.shiftKey) : selectedIds;
    // Birlikte taşınacak olanların başlangıç yerleri: her kare yeniden okumak
    // yuvarlama hatalarını biriktirir, grup yavaşça dağılırdı.
    const birlikte =
      mode.kind === "tasi" && next.length > 1
        ? items.filter((n) => next.includes(n.id) && !n.kilit).map((n) => ({ id: n.id, x: n.x, y: n.y }))
        : null;
    // Uç sürüklemesinde yerinde kalan uç bir kez okunuyor; bkz. Drag.sabitUc.
    const sabitUc =
      mode.kind === "uc" && h.def?.uclar
        ? (() => {
            const n = items.find((q) => q.id === id);
            if (!n) return null;
            const [A, B] = ucNoktalari(n, h.def!);
            return mode.uc === "bas" ? B : A;
          })()
        : null;
    dragRef.current = { mode, id, start: { ...h }, px, py, birlikte, sabitUc };
    onSelect(next);
  };

  /* ---------------- araçla oluşturma ---------------- */

  /** Çizilmekte olan bağlantı. `id` ilk birkaç pikselden sonra doluyor. */
  const cizim = useRef<{ id: string | null; A: Nokta } | null>(null);

  /**
   * `T` ve `L` araçları. Sahneye basmak bir nesne doğuruyor; iş bitince araç
   * kendiliğinden `sec`'e dönüyor — Figma'da da metin aracı tek kutu koyup
   * bırakır, arka arkaya kutu dizmek isteyen aracı yeniden seçer.
   */
  const aracIleBasla = (e: ReactPointerEvent) => {
    if (arac !== "metin" && arac !== "cizgi") return;
    e.preventDefault();
    e.stopPropagation();
    const [px, py] = toCard(e);
    if (arac === "metin") {
      const taze = newItem("metin/kutu", CW, CH);
      if (!taze) return;
      const yeni: DecorItem = {
        ...taze,
        x: Math.round(Math.max(0, Math.min(CW - taze.w, px))),
        y: Math.round(Math.max(0, Math.min(CH - taze.h, py))),
      };
      setItems([...items, yeni]);
      onSelect([yeni.id]);
      setDuzenleme({ id: yeni.id, ilk: str(yeni.params, "yazi", "") });
      onArac("sec");
      return;
    }
    capture(e);
    cizim.current = { id: null, A: { x: px, y: py } };
  };

  const onCizimMove = (e: ReactPointerEvent) => {
    const c = cizim.current;
    if (!c) return;
    const [px, py] = toCard(e);
    const B = { x: px, y: py };
    if (c.id === null) {
      // Kısacık bir titreme yüzünden bağlantı doğmasın; tıklama (sürüklemesiz)
      // hâli `end` içinde varsayılan boyda kuruluyor.
      if (Math.hypot(B.x - c.A.x, B.y - c.A.y) < 3) return;
      const taze = newItem("ok/baglanti", CW, CH);
      const def = getAsset("ok/baglanti");
      if (!taze || !def) return;
      const kur = ucluKur(taze, def, c.A, B);
      c.id = kur.id;
      setItems([...items, kur]);
      onSelect([kur.id]);
      return;
    }
    ucYaz(c.id, c.A, B);
  };

  const cizimiBitir = () => {
    const c = cizim.current;
    cizim.current = null;
    if (!c) return;
    if (c.id === null) {
      // Sürüklemeden bırakıldı: kullanıcı "buraya bir bağlantı" dedi, boyunu
      // biz veriyoruz.
      const taze = newItem("ok/baglanti", CW, CH);
      const def = getAsset("ok/baglanti");
      if (taze && def) {
        const kur = ucluKur(taze, def, c.A, { x: c.A.x + 160, y: c.A.y });
        setItems([...items, kur]);
        onSelect([kur.id]);
      }
    }
    onArac("sec");
  };

  /* ---------------- yerinde metin düzenleme ---------------- */

  /** Hangi nesnenin metni yazılıyor, ve `Esc` ile dönülecek ilk hâli. */
  const [duzenleme, setDuzenleme] = useState<{ id: string; ilk: string } | null>(null);

  // Nesne silinir ya da seçim başkasına geçerse kutu açık kalmasın.
  useEffect(() => {
    if (duzenleme && !items.some((n) => n.id === duzenleme.id && !n.gizli && !n.kilit)) setDuzenleme(null);
  }, [duzenleme, items]);

  const duzenlemeYaz = (id: string, anahtar: string, deger: string) =>
    setItems(items.map((n) => (n.id === id ? otomatikBoy({ ...n, params: { ...n.params, [anahtar]: deger } }) : n)));

  const onMove = (e: ReactPointerEvent) => {
    if (dragAnchor.current) return onAnchorMove(e);
    if (cizim.current) return onCizimMove(e);
    const d = dragRef.current;
    if (!d) return;
    const [px, py] = toCard(e);
    const s = d.start;
    const keepRatio = e.shiftKey || s.square;

    if (d.mode.kind === "tasi") {
      let nx = s.x + (px - d.px);
      let ny = s.y + (py - d.py);
      if (e.shiftKey) {
        // Axis lock: whichever direction moved further wins.
        if (Math.abs(px - d.px) > Math.abs(py - d.py)) ny = s.y;
        else nx = s.x;
      }
      const snapped = snap(nx, ny, s.w, s.h, CW, CH);
      setGuides(snapped.guides);
      if (d.birlikte) {
        // Hizalama tutulan nesneye göre hesaplanıyor, kayma hepsine aynen
        // uygulanıyor: grup içindeki aralıklar bozulmasın.
        const dx = snapped.x - s.x;
        const dy = snapped.y - s.y;
        const yer = new Map(d.birlikte.map((b) => [b.id, b]));
        setItems(items.map((n) => {
          const b = yer.get(n.id);
          return b ? { ...n, x: Math.round(b.x + dx), y: Math.round(b.y + dy) } : n;
        }));
        return;
      }
      patch(d.id, { x: snapped.x, y: snapped.y });
      return;
    }

    if (d.mode.kind === "uc") {
      if (!d.sabitUc) return;
      const hareketli = { x: px, y: py };
      const [A, B] = d.mode.uc === "bas" ? [hareketli, d.sabitUc] : [d.sabitUc, hareketli];
      ucYaz(d.id, A, B);
      return;
    }

    if (d.mode.kind === "dondur") {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      if (deg > 180) deg -= 360;
      if (deg < -180) deg += 360;
      patch(d.id, { aci: Math.round(deg * 10) / 10 });
      return;
    }

    // Resize: hold the opposite corner still in card space, so the box grows
    // along its own axes no matter how far it has been rotated.
    const [sx, sy] = SIGN[d.mode.corner];
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const [ax, ay] = rot((-sx * s.w) / 2, (-sy * s.h) / 2, s.aci);
    const AX = cx + ax;
    const AY = cy + ay;
    const [qx, qy] = rot(px - AX, py - AY, -s.aci);
    // Kenar tutamacı tek eksende çalışır: ötekini olduğu gibi bırakıyoruz,
    // yoksa `sy * qy` sıfır çıkıp yüksekliği en küçük değere düşürürdü.
    let nw = sx === 0 ? s.w : Math.max(s.min, sx * qx);
    let nh = sy === 0 ? s.h : Math.max(s.min, sy * qy);
    if (keepRatio && sx !== 0 && sy !== 0) {
      const ratio = s.h / s.w || 1;
      if (nw * ratio > nh) nh = nw * ratio;
      else nw = nh / ratio;
    }
    const [ox, oy] = rot((sx * nw) / 2, (sy * nh) / 2, s.aci);
    patch(d.id, {
      w: Math.round(nw),
      h: Math.round(nh),
      x: Math.round(AX + ox - nw / 2),
      y: Math.round(AY + oy - nh / 2),
    });
  };

  const end = (e: ReactPointerEvent) => {
    // Bırakma noktası da sayılıyor: hızlı bir sürüklemede son `pointermove`
    // hedefin gerisinde kalabiliyor ve nesne birkaç piksel geride duruyordu.
    onMove(e);
    dragAnchor.current = null;
    if (cizim.current) cizimiBitir();
    if (!dragRef.current) return;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    dragRef.current = null;
    setGuides({ x: [], y: [] });
  };

  return (
    <div
      ref={hostRef}
      className="decor-overlay"
      data-arac={arac}
      onPointerDown={aracIleBasla}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      // Boşluğa tıklamak seçimi düşürür ama bunu katman değil sahne yapıyor:
      // katman artık her zaman çiziliyor ve kartın üstünde duruyor, o yüzden
      // "boşluk" ile "kartın bir parçası" ayrımını ancak sahne bilebilir.
    >
      {handles.map((h) => {
        const coklu = selectedIds.includes(h.id);
        const sel = h.id === selectedId;
        const nesne = h.slot ? null : (items.find((q) => q.id === h.id) ?? null);
        const ucluMu = !!h.def?.uclar && !!nesne;
        // "Otomatik" gerçekten açık mı: kullanıcı yüksekliği sabitlediyse kutu
        // yine köşelerinden tutulabilmeli.
        const otoBoy =
          !!h.def?.otomatikYukseklik &&
          !!nesne &&
          h.def.otomatikYukseklik({ ...defaults(h.def), ...nesne.params }, nesne.w) != null;
        return (
          <div
            key={h.id}
            className="decor-box"
            data-selected={coklu ? "true" : undefined}
            data-grup={items.find((n) => n.id === h.id)?.grup || undefined}
            data-locked={h.kilit ? "true" : undefined}
            data-slot={h.slot ?? undefined}
            title={h.label}
            style={{
              left: h.x * scale,
              top: h.y * scale,
              width: h.w * scale,
              height: h.h * scale,
              transform: h.aci ? `rotate(${h.aci}deg)` : undefined,
              transformOrigin: "center",
            }}
            onDoubleClick={(e) => {
              if (arac !== "sec" || h.kilit || !h.def?.duzenle) return;
              e.stopPropagation();
              const n = items.find((q) => q.id === h.id);
              if (n) setDuzenleme({ id: h.id, ilk: str(n.params, h.def.duzenle, "") });
            }}
            onPointerDown={(e) => (h.kilit ? onSelect(sec(h.id, e.shiftKey)) : begin(e, h.id, { kind: "tasi" }))}
          >
            {sel && !h.kilit && duzenleme?.id !== h.id && (
              <>
                {/* Üç tutamaç seti. İki uçlu bir bağlantıda köşe ve döndürme
                    yok — yön uçların yerinden geliyor. Yüksekliğini metnine
                    bırakmış bir kutuda ise yalnız genişlik tutulur. */}
                {(ucluMu ? [] : otoBoy ? EDGES : CORNERS).map((c) => {
                  const [sx, sy] = SIGN[c];
                  return (
                    <div
                      key={c}
                      className="decor-handle"
                      style={{
                        left: sx < 0 ? -5 : sx === 0 ? "50%" : undefined,
                        right: sx > 0 ? -5 : undefined,
                        top: sy < 0 ? -5 : sy === 0 ? "50%" : undefined,
                        bottom: sy > 0 ? -5 : undefined,
                        marginLeft: sx === 0 ? -5 : undefined,
                        marginTop: sy === 0 ? -5 : undefined,
                        cursor: sy === 0 ? "ew-resize" : sx === 0 ? "ns-resize" : c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                      }}
                      onPointerDown={(e) => begin(e, h.id, { kind: "boyut", corner: c })}
                    />
                  );
                })}
                {ucluMu &&
                  ucNoktalari(nesne!, h.def!).map((P, i) => (
                    <div
                      key={i === 0 ? "bas" : "son"}
                      className="decor-handle decor-uc"
                      data-uc={i === 0 ? "bas" : "son"}
                      title={i === 0 ? "Baş ucu" : "Son ucu"}
                      style={{ left: (P.x - h.x) * scale - 6, top: (P.y - h.y) * scale - 6 }}
                      onPointerDown={(e) => begin(e, h.id, { kind: "uc", uc: i === 0 ? "bas" : "son" })}
                    />
                  ))}
                {/* Card parts stay upright: a rotated title is a different feature
                    and a rotated chart would fight its own axis labels. */}
                {!h.slot && !ucluMu && (
                  <>
                    <div
                      className="decor-handle decor-rotate"
                      style={{ left: "50%", top: -22, marginLeft: -5, cursor: "grab" }}
                      onPointerDown={(e) => begin(e, h.id, { kind: "dondur" })}
                      title="Döndür (Shift = 15°)"
                    />
                    <div style={{ position: "absolute", left: "50%", top: -13, width: 1, height: 13, background: "var(--ring)", marginLeft: -0.5 }} />
                  </>
                )}
              </>
            )}
            {duzenleme?.id === h.id && h.def?.duzenle && nesne && (
              <textarea
                className="decor-edit"
                autoFocus
                value={str(nesne.params, h.def.duzenle, "")}
                style={metinBicemi(nesne, h.def, scale)}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onChange={(e) => duzenlemeYaz(h.id, h.def!.duzenle!, e.target.value)}
                onKeyDown={(e) => {
                  // Esc sahnenin genel "seçimi bırak" kısayoluna ulaşmasın:
                  // yazarken vazgeçmek seçimi değil metni geri almalı.
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    duzenlemeYaz(h.id, h.def!.duzenle!, duzenleme.ilk);
                    setDuzenleme(null);
                  }
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) setDuzenleme(null);
                }}
                onBlur={() => setDuzenleme(null)}
              />
            )}
          </div>
        );
      })}
      {anchors.map((a) => (
        <div
          key={a.key}
          className="decor-anchor"
          title={`${a.def.label} — merkezi sürükleyin`}
          style={{ left: (a.px / 100) * CW * scale, top: (a.py / 100) * CH * scale }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            capture(e);
            dragAnchor.current = { key: a.key };
          }}
        />
      ))}
      {guides.x.map((gx, i) => (
        <div key={`x${i}`} className="decor-guide" style={{ left: gx * scale, top: 0, width: 1, height: "100%" }} />
      ))}
      {guides.y.map((gy, i) => (
        <div key={`y${i}`} className="decor-guide" style={{ top: gy * scale, left: 0, height: 1, width: "100%" }} />
      ))}
    </div>
  );
}

/**
 * Pull a moving box onto the card's edges, centre lines and thirds. Compares
 * the box's own leading edge, centre and trailing edge against each guide, so
 * a shape snaps by whichever part of it is closest.
 */
function snap(x: number, y: number, w: number, h: number, CW: number, CH: number) {
  const linesX = [0, CW / 3, CW / 2, (CW * 2) / 3, CW];
  const linesY = [0, CH / 3, CH / 2, (CH * 2) / 3, CH];
  const hit = (v: number, size: number, lines: number[]) => {
    let best: { delta: number; line: number } | null = null;
    for (const anchor of [v, v + size / 2, v + size]) {
      for (const line of lines) {
        const delta = line - anchor;
        if (Math.abs(delta) <= SNAP && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line };
      }
    }
    return best;
  };
  const bx = hit(x, w, linesX);
  const by = hit(y, h, linesY);
  return {
    x: Math.round(bx ? x + bx.delta : x),
    y: Math.round(by ? y + by.delta : y),
    guides: { x: bx ? [bx.line] : [], y: by ? [by.line] : [] },
  };
}
