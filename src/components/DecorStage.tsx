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
import { getAsset, newItem } from "@/decor/registry";
import { num, type ZeminSlot } from "@/decor/types";
import type { ChartSpec } from "@/lib/spec";

type Corner = "nw" | "ne" | "sw" | "se";
type Mode = { kind: "tasi" } | { kind: "boyut"; corner: Corner } | { kind: "dondur" };

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
const SIGN: Record<Corner, [number, number]> = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] };
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
}

interface Drag {
  mode: Mode;
  id: string;
  start: Handle;
  px: number;
  py: number;
  /** Çoklu seçimde birlikte taşınanların başlangıç yerleri. */
  birlikte: { id: string; x: number; y: number }[] | null;
}

export interface DecorStageProps {
  spec: ChartSpec;
  scale: number;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (s: ChartSpec) => void;
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

const rot = (x: number, y: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c] as const;
};

export function DecorStage({ spec, scale, selectedIds, onSelect, onChange }: DecorStageProps) {
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
      })),
    ...(free
      ? SLOT_KEYS.flatMap((k) => {
          const b = spec.yerlesim.kutular[k];
          if (!b || hiddenSlots.includes(k)) return [];
          return [{ id: slotId(k), ...b, aci: 0, kilit: false, slot: k, square: false, min: 24, label: SLOT_LABELS[k] }];
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
    setItems(items.map((n) => (n.id === id ? { ...n, ...p } : n)));
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
        if (e.shiftKey) setItems(grubuCoz(items, nesneler));
        else if (nesneler.length > 1) setItems(grupla(items, nesneler));
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
    dragRef.current = { mode, id, start: { ...h }, px, py, birlikte };
    onSelect(next);
  };

  const onMove = (e: ReactPointerEvent) => {
    if (dragAnchor.current) return onAnchorMove(e);
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
    let nw = Math.max(s.min, sx * qx);
    let nh = Math.max(s.min, sy * qy);
    if (keepRatio) {
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
    dragAnchor.current = null;
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
            onPointerDown={(e) => (h.kilit ? onSelect(sec(h.id, e.shiftKey)) : begin(e, h.id, { kind: "tasi" }))}
          >
            {sel && !h.kilit && (
              <>
                {CORNERS.map((c) => {
                  const [sx, sy] = SIGN[c];
                  return (
                    <div
                      key={c}
                      className="decor-handle"
                      style={{
                        left: sx < 0 ? -5 : undefined,
                        right: sx > 0 ? -5 : undefined,
                        top: sy < 0 ? -5 : undefined,
                        bottom: sy > 0 ? -5 : undefined,
                        cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                      }}
                      onPointerDown={(e) => begin(e, h.id, { kind: "boyut", corner: c })}
                    />
                  );
                })}
                {/* Card parts stay upright: a rotated title is a different feature
                    and a rotated chart would fight its own axis labels. */}
                {!h.slot && (
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
