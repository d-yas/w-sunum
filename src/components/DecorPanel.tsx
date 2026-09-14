/**
 * The "Süsle" tab: pick a background, browse the asset gallery, and edit
 * whatever is selected on the stage.
 *
 * Previews are the real assets rendered into a small box. Because every asset
 * draws at its box's true pixel size, a 64×40 thumbnail is an honest preview
 * rather than a scaled-down approximation.
 */
import { useId, useMemo, useState } from "react";

import { DecorLayer } from "@/decor/DecorLayer";
import { SLOT_KEYS, SLOT_LABELS, emptyDecor, type Box, type DecorItem, type DecorSlot, type DecorState, type SlotKey } from "@/decor/model";
import { NESNE_FAMILIES, ZEMIN_SLOTS, assetsOf, getAsset, newItem, newSlot } from "@/decor/registry";
import { FAMILY_LABELS, defaults, type AssetDef, type DecorFamily, type ParamDef, type ParamValues } from "@/decor/types";
import { getPalette, seriesColor } from "@/lib/palettes";
import type { ChartSpec, Theme } from "@/lib/spec";

import { Field, Section, Seg, Switch } from "./Panels";

/* ---------------- primitives ---------------- */

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const places = step < 1 ? String(step).split(".")[1]?.length ?? 1 : 0;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input className="rng" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="rng-val">{value.toFixed(places)}</span>
    </div>
  );
}

/** A colour well that can also mean "whatever the palette says". */
function ColorWell({ value, fallback, onChange }: { value: string; fallback: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input className="swatch" type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => onChange("")}
        aria-pressed={value === ""}
        title="Grafiğin paletinden al"
      >
        {value === "" ? "Palet ✓" : "Palet"}
      </button>
    </div>
  );
}

function ParamEditor({ param, values, onChange }: { param: ParamDef; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const set = (v: number | string) => onChange({ ...values, [param.key]: v });
  if (param.type === "sayi") {
    const v = typeof values[param.key] === "number" ? (values[param.key] as number) : param.def;
    return (
      <Field label={param.label}>
        <Slider value={v} min={param.min} max={param.max} step={param.step} onChange={set} />
      </Field>
    );
  }
  if (param.type === "secim") {
    const v = typeof values[param.key] === "string" ? (values[param.key] as string) : param.def;
    return (
      <Field label={param.label}>
        <select className="inp" value={v} onChange={(e) => set(e.target.value)}>
          {param.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  const v = typeof values[param.key] === "string" ? (values[param.key] as string) : param.def;
  return (
    <Field label={param.label}>
      <input className="inp w-[170px]" value={v} maxLength={param.maxLength ?? 120} onChange={(e) => set(e.target.value)} />
    </Field>
  );
}

/* ---------------- previews ---------------- */

function Preview({ def, theme, colors, w, h }: { def: AssetDef; theme: Theme; colors: string[]; w: number; h: number }) {
  const uid = `p${useId().replace(/:/g, "")}`;
  const slot: DecorSlot = { asset: def.id, renk: "", renk2: "", opaklik: 1, params: defaults(def) };
  const decor: DecorState =
    def.kind === "zemin"
      ? { zemin: { doku: def.family === "doku" ? slot : null, isik: def.family === "isik" ? slot : null, cerceve: null }, nesneler: [] }
      : {
          zemin: { doku: null, isik: null, cerceve: null },
          nesneler: [fitted(def, slot, w, h)],
        };
  // Frames are a background slot but paint in the "on" phase, so preview them there.
  const phase = def.family === "cerceve" ? "on" : def.kind === "zemin" ? "arka" : "on";
  const framed: DecorState = def.family === "cerceve" ? { zemin: { doku: null, isik: null, cerceve: slot }, nesneler: [] } : decor;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", borderRadius: 4 }}>
      <DecorLayer decor={framed} phase={phase} w={w} h={h} uid={uid} colors={colors} theme={theme} />
    </div>
  );
}

/** Centre a nesne asset inside a preview box at its own aspect ratio. */
function fitted(def: AssetDef, slot: DecorSlot, boxW: number, boxH: number): DecorItem {
  const want = def.size ?? { w: 100, h: 100 };
  const k = Math.min((boxW - 6) / want.w, (boxH - 6) / want.h);
  const w = Math.max(6, want.w * k);
  const h = Math.max(6, def.square ? w : want.h * k);
  return {
    ...slot,
    id: "pv",
    x: (boxW - w) / 2,
    y: (boxH - h) / 2,
    w,
    h,
    aci: 0,
    aynala: false,
    katman: "on",
    gizli: false,
    kilit: false,
  };
}

/**
 * Read the card's own parts off the live stage card.
 *
 * Measured rather than computed: the header's height depends on the font, the
 * chart's on the legend position, and guessing would make the layout jump the
 * moment free layout is switched on. Rects are divided by the stage zoom,
 * which the card itself reveals — its rendered width over its true width.
 */
function measureSlots(width: number): Partial<Record<SlotKey, Box>> {
  const card = document.querySelector<HTMLElement>(".stage-card");
  if (!card) return {};
  const cardRect = card.getBoundingClientRect();
  const k = cardRect.width / width || 1;
  const out: Partial<Record<SlotKey, Box>> = {};
  for (const key of SLOT_KEYS) {
    const el = card.querySelector<HTMLElement>(`[data-slot="${key}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Two decimals, not whole pixels: the flow layout lands on fractions, and
    // rounding them would nudge every part when free layout is switched on.
    const fix = (n: number) => Math.round(n * 100) / 100;
    out[key] = {
      x: fix((r.left - cardRect.left) / k),
      y: fix((r.top - cardRect.top) / k),
      w: fix(r.width / k),
      h: fix(r.height / k),
    };
  }
  return out;
}

/* ---------------- the panel ---------------- */

export function DecorPanel({
  spec,
  theme,
  selectedId,
  onSelect,
  onChange,
}: {
  spec: ChartSpec;
  theme: Theme;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (s: ChartSpec) => void;
}) {
  const [family, setFamily] = useState<DecorFamily>("ok");
  const decor = spec.decor;
  const setDecor = (d: DecorState) => onChange({ ...spec, decor: d });

  const palette = getPalette(spec.paletteId);
  const colors = useMemo(
    () => Array.from({ length: 8 }, (_, i) => seriesColor(i, spec.colors, palette, theme)),
    [spec.colors, palette, theme]
  );

  const selected = decor.nesneler.find((n) => n.id === selectedId) ?? null;
  const selectedDef = selected ? getAsset(selected.asset) : null;

  const setItem = (id: string, patch: Partial<DecorItem>) =>
    setDecor({ ...decor, nesneler: decor.nesneler.map((n) => (n.id === id ? { ...n, ...patch } : n)) });

  const addAsset = (id: string) => {
    const item = newItem(id, spec.options.width, spec.options.height);
    if (!item) return;
    setDecor({ ...decor, nesneler: [...decor.nesneler, item] });
    onSelect(item.id);
  };

  const removeItem = (id: string) => {
    setDecor({ ...decor, nesneler: decor.nesneler.filter((n) => n.id !== id) });
    if (selectedId === id) onSelect(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = [...decor.nesneler];
    const i = list.findIndex((n) => n.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setDecor({ ...decor, nesneler: list });
  };

  const layout = spec.yerlesim;
  const setFree = (on: boolean) => {
    // Seed from where the parts already are, so switching on changes nothing
    // visually — it only makes them grabbable.
    const kutular = on && Object.keys(layout.kutular).length === 0 ? measureSlots(spec.options.width) : layout.kutular;
    onChange({ ...spec, yerlesim: { serbest: on, kutular } });
  };

  return (
    <div className="flex flex-col">
      {/* ---- free layout ---- */}
      <Section title="Yerleşim">
        <Field label="Serbest yerleşim" hint="Başlık, grafik ve dipnot da sürüklenip boyutlandırılabilir olur.">
          <Switch checked={layout.serbest} onChange={setFree} />
        </Field>
        {layout.serbest && (
          <>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SLOT_KEYS.filter((k) => layout.kutular[k]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="btn btn-sm"
                  aria-pressed={selectedId === `slot:${k}`}
                  onClick={() => onSelect(`slot:${k}`)}
                >
                  {SLOT_LABELS[k]}
                </button>
              ))}
            </div>
            <button
              className="btn btn-sm mt-2 self-start"
              type="button"
              onClick={() => {
                // Drop back to flow layout for one frame and measure *that*.
                // Measuring while the boxes are applied would just hand back
                // the boxes we already have.
                onChange({ ...spec, yerlesim: { serbest: false, kutular: {} } });
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => onChange({ ...spec, yerlesim: { serbest: true, kutular: measureSlots(spec.options.width) } }))
                );
              }}
              title="Kutuları kartın kendi akışına göre yeniden hesapla"
            >
              Kutuları sıfırla
            </button>
          </>
        )}
      </Section>

      {/* ---- background slots ---- */}
      <Section title="Zemin">
        {ZEMIN_SLOTS.map(({ slot, family: fam, label }) => (
          <ZeminRow
            key={slot}
            label={label}
            family={fam}
            slot={decor.zemin[slot]}
            theme={theme}
            colors={colors}
            onChange={(next) => setDecor({ ...decor, zemin: { ...decor.zemin, [slot]: next } })}
          />
        ))}
      </Section>

      {/* ---- gallery ---- */}
      <Section title="Galeri">
        <div className="seg mb-2 w-full justify-between">
          {NESNE_FAMILIES.map((f) => (
            <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)} className="flex-1">
              {FAMILY_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="decor-grid">
          {assetsOf(family).map((def) => (
            <button key={def.id} type="button" className="decor-cell" onClick={() => addAsset(def.id)} title={`${def.label} — karta ekle`}>
              <Preview def={def} theme={theme} colors={colors} w={60} h={40} />
              <span>{def.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tıklayın; kartın ortasına düşer. Sahnede sürükleyerek taşıyın, köşeden boyutlandırın, üstteki tutamaçtan döndürün.
        </p>
      </Section>

      {/* ---- placed items ---- */}
      <Section title={`Yerleştirilenler (${decor.nesneler.length})`}>
        {decor.nesneler.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Henüz nesne yok.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {decor.nesneler.map((n, i) => {
              const def = getAsset(n.asset);
              return (
                <div key={n.id} className="decor-row" aria-selected={n.id === selectedId} onClick={() => onSelect(n.id)} role="option">
                  <span className="grow">
                    {def?.label ?? n.asset}
                    <span className="ml-1 text-[10px] text-muted-foreground">{n.katman === "arka" ? "arka" : ""}</span>
                  </span>
                  <button className="icon-btn" type="button" title="Yukarı" onClick={(e) => (e.stopPropagation(), move(n.id, -1))} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    title="Aşağı"
                    onClick={(e) => (e.stopPropagation(), move(n.id, 1))}
                    disabled={i === decor.nesneler.length - 1}
                  >
                    ↓
                  </button>
                  <button className="icon-btn" type="button" title={n.gizli ? "Göster" : "Gizle"} onClick={(e) => (e.stopPropagation(), setItem(n.id, { gizli: !n.gizli }))}>
                    {n.gizli ? "◻" : "◉"}
                  </button>
                  <button className="icon-btn" type="button" title={n.kilit ? "Kilidi aç" : "Kilitle"} onClick={(e) => (e.stopPropagation(), setItem(n.id, { kilit: !n.kilit }))}>
                    {n.kilit ? "🔒" : "🔓"}
                  </button>
                  <button className="icon-btn" type="button" title="Sil" onClick={(e) => (e.stopPropagation(), removeItem(n.id))}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {decor.nesneler.length > 0 && (
          <button className="btn btn-sm mt-2 self-start" type="button" onClick={() => setDecor({ ...emptyDecor(), zemin: decor.zemin })}>
            Nesneleri temizle
          </button>
        )}
      </Section>

      {/* ---- selection properties ---- */}
      {selected && selectedDef && (
        <Section title={`Seçili: ${selectedDef.label}`}>
          <Field label="Renk">
            <ColorWell value={selected.renk} fallback={colors[0]} onChange={(renk) => setItem(selected.id, { renk })} />
          </Field>
          {selectedDef.twoTone && (
            <Field label="İkinci renk">
              <ColorWell value={selected.renk2} fallback={colors[1]} onChange={(renk2) => setItem(selected.id, { renk2 })} />
            </Field>
          )}
          <Field label="Opaklık">
            <Slider value={selected.opaklik} min={0.05} max={1} step={0.05} onChange={(opaklik) => setItem(selected.id, { opaklik })} />
          </Field>
          <Field label="Açı">
            <Slider value={selected.aci} min={-180} max={180} step={1} onChange={(aci) => setItem(selected.id, { aci })} />
          </Field>
          <Field label="Katman">
            <Seg
              value={selected.katman}
              options={[
                ["arka", "Grafiğin arkası"],
                ["on", "Önü"],
              ]}
              onChange={(katman) => setItem(selected.id, { katman })}
            />
          </Field>
          <Field label="Aynala">
            <Switch checked={selected.aynala} onChange={(aynala) => setItem(selected.id, { aynala })} />
          </Field>
          <Field label="Konum (x, y)">
            <div className="flex gap-1.5">
              <input
                className="inp inp-num w-[64px]"
                type="number"
                value={Math.round(selected.x)}
                onChange={(e) => setItem(selected.id, { x: Number(e.target.value) || 0 })}
              />
              <input
                className="inp inp-num w-[64px]"
                type="number"
                value={Math.round(selected.y)}
                onChange={(e) => setItem(selected.id, { y: Number(e.target.value) || 0 })}
              />
            </div>
          </Field>
          <Field label="Boyut (g, y)">
            <div className="flex gap-1.5">
              <input
                className="inp inp-num w-[64px]"
                type="number"
                min={4}
                value={Math.round(selected.w)}
                onChange={(e) => {
                  const w = Math.max(4, Number(e.target.value) || 4);
                  setItem(selected.id, selectedDef.square ? { w, h: w } : { w });
                }}
              />
              <input
                className="inp inp-num w-[64px]"
                type="number"
                min={4}
                value={Math.round(selected.h)}
                onChange={(e) => {
                  const h = Math.max(4, Number(e.target.value) || 4);
                  setItem(selected.id, selectedDef.square ? { w: h, h } : { h });
                }}
              />
            </div>
          </Field>
          {(selectedDef.params ?? []).map((param) => (
            <ParamEditor
              key={param.key}
              param={param}
              values={selected.params}
              onChange={(params) => setItem(selected.id, { params })}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

/* ---------------- one background slot ---------------- */

function ZeminRow({
  label,
  family,
  slot,
  theme,
  colors,
  onChange,
}: {
  label: string;
  family: DecorFamily;
  slot: DecorSlot | null;
  theme: Theme;
  colors: string[];
  onChange: (s: DecorSlot | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = assetsOf(family);
  const def = slot ? getAsset(slot.asset) : null;
  return (
    <div className="border-b border-border/60 py-1.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="w-[58px] shrink-0 text-[12px] text-foreground/80">{label}</span>
        <select
          className="inp min-w-0 flex-1"
          value={slot?.asset ?? ""}
          onChange={(e) => {
            onChange(e.target.value ? newSlot(e.target.value) : null);
            setOpen(Boolean(e.target.value));
          }}
        >
          <option value="">— yok —</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {slot && def && (
          <>
            <Preview def={def} theme={theme} colors={colors} w={44} h={26} />
            <button className="icon-btn" type="button" title="Ayarlar" onClick={() => setOpen((o) => !o)}>
              {open ? "▴" : "▾"}
            </button>
          </>
        )}
      </div>
      {slot && def && open && (
        <div className="mt-1 pl-2">
          <Field label="Renk">
            <ColorWell
              value={slot.renk}
              fallback={def.tone === "murekkep" ? (theme === "dark" ? "#ffffff" : "#0b0b0b") : colors[0]}
              onChange={(renk) => onChange({ ...slot, renk })}
            />
          </Field>
          {def.twoTone && (
            <Field label="İkinci renk">
              <ColorWell value={slot.renk2} fallback={colors[1]} onChange={(renk2) => onChange({ ...slot, renk2 })} />
            </Field>
          )}
          <Field label="Opaklık">
            <Slider value={slot.opaklik} min={0.02} max={1} step={0.02} onChange={(opaklik) => onChange({ ...slot, opaklik })} />
          </Field>
          {(def.params ?? []).map((param) => (
            <ParamEditor key={param.key} param={param} values={slot.params} onChange={(params) => onChange({ ...slot, params })} />
          ))}
        </div>
      )}
    </div>
  );
}
