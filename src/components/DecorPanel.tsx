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
import { emptyDecor, grubuCoz, grupla, type DecorItem, type DecorSlot, type DecorState } from "@/decor/model";
import { NESNE_FAMILIES, ZEMIN_SLOTS, assetsOf, getAsset, newItem, newSlot, otomatikBoy } from "@/decor/registry";
import { FAMILY_LABELS, defaults, type AssetDef, type DecorFamily, type ParamDef, type ParamValues } from "@/decor/types";
import { setFreeLayout } from "@/lib/free-layout";
import { getPalette, seriesColor, type Palette } from "@/lib/palettes";
import type { ChartSpec, Theme } from "@/lib/spec";

import { ColorWell, Field, Section, Seg, Slider, Switch } from "./Panels";

/* ---------------- primitives ---------------- */

function ParamEditor({ param, values, onChange }: { param: ParamDef; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const set = (v: number | string) => onChange({ ...values, [param.key]: v });
  // Sahnede kendi tutamağı olan parametreler burada çizilmiyor: bir bağlantının
  // uç noktasını kaydırıcıyla aramak kimsenin işine yaramaz.
  if (param.gizli) return null;
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
  if (param.multiline) {
    return (
      <Field label={param.label} hint="Sahnede çift tıklayarak da yazabilirsiniz.">
        <textarea
          className="inp w-[170px]"
          rows={3}
          value={v}
          maxLength={param.maxLength ?? 4000}
          style={{ height: "auto", resize: "vertical", lineHeight: 1.35, padding: "4px 6px" }}
          onChange={(e) => set(e.target.value)}
        />
      </Field>
    );
  }
  return (
    <Field label={param.label}>
      <input className="inp w-[170px]" value={v} maxLength={param.maxLength ?? 120} onChange={(e) => set(e.target.value)} />
    </Field>
  );
}

/* ---------------- previews ---------------- */

function Preview({ def, theme, colors, w, h }: { def: AssetDef; theme: Theme; colors: string[]; w: number; h: number }) {
  const uid = `p${useId().replace(/:/g, "")}`;
  const slot: DecorSlot = { asset: def.id, renk: "", renk2: "", opaklik: 1, params: defaults(def), gizli: false };
  const bos = emptyDecor();
  const decor: DecorState =
    def.kind === "zemin"
      ? { ...bos, zemin: { doku: def.family === "doku" ? slot : null, isik: def.family === "isik" ? slot : null, cerceve: null } }
      : { ...bos, nesneler: [fitted(def, slot, w, h)] };
  // Frames are a background slot but paint in the "on" phase, so preview them there.
  const phase = def.family === "cerceve" ? "on" : def.kind === "zemin" ? "arka" : "on";
  const framed: DecorState = def.family === "cerceve" ? { ...bos, zemin: { doku: null, isik: null, cerceve: slot } } : decor;
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
    ad: "",
    x: (boxW - w) / 2,
    y: (boxH - h) / 2,
    w,
    h,
    aci: 0,
    aynala: false,
    katman: "on",
    kilit: false,
    grup: "",
  };
}

/* ---------------- the panel ---------------- */

export function DecorPanel({
  spec,
  theme,
  palettes,
  selectedIds,
  onSelect,
  onChange,
}: {
  spec: ChartSpec;
  theme: Theme;
  palettes: Palette[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (s: ChartSpec) => void;
}) {
  const [family, setFamily] = useState<DecorFamily>("ok");
  const decor = spec.decor;
  const setDecor = (d: DecorState) => onChange({ ...spec, decor: d });

  const palette = getPalette(spec.paletteId, palettes);
  const colors = useMemo(
    () => Array.from({ length: 8 }, (_, i) => seriesColor(i, spec.colors, palette, theme)),
    [spec.colors, palette, theme]
  );

  const selected = selectedIds.length === 1 ? (decor.nesneler.find((n) => n.id === selectedIds[0]) ?? null) : null;
  const selectedDef = selected ? getAsset(selected.asset) : null;
  /** Yüksekliğini metnine bırakmış bir nesne mi — kutu elle değiştirilemez. */
  const otoBoy =
    !!selected &&
    !!selectedDef?.otomatikYukseklik &&
    selectedDef.otomatikYukseklik({ ...defaults(selectedDef), ...selected.params }, selected.w) != null;
  const coklu = decor.nesneler.filter((n) => selectedIds.includes(n.id));

  // `otomatikBoy`: metin kutusunun yüksekliği punto, satır aralığı ve yazının
  // kendisi değişince yeniden hesaplanmalı — panelden yapılan her değişiklik
  // buradan geçiyor.
  const setItem = (id: string, patch: Partial<DecorItem>) =>
    setDecor({ ...decor, nesneler: decor.nesneler.map((n) => (n.id === id ? otomatikBoy({ ...n, ...patch }) : n)) });

  const addAsset = (id: string) => {
    const item = newItem(id, spec.options.width, spec.options.height);
    if (!item) return;
    setDecor({ ...decor, nesneler: [...decor.nesneler, item] });
    onSelect([item.id]);
  };

  const layout = spec.yerlesim;

  return (
    <div className="flex flex-col">
      {/* ---- free layout ---- */}
      <Section id="yerlesim" title="Yerleşim">
        {!layout.serbest ? (
          <p className="text-[12px] text-muted-foreground">
            Araç çubuğundaki <strong>serbest yerleşim</strong> düğmesiyle açın; başlık, grafik ve dipnot sürüklenip
            boyutlandırılabilir olur.
          </p>
        ) : (
          <>
            {/* Parçaların görünürlüğü ve sırası artık Katmanlar panelinde;
                burada yalnız serbest yerleşime özgü olan kaldı. */}
            <p className="text-[12px] text-muted-foreground">
              Başlık, grafik ve dipnot sürüklenip boyutlandırılabilir. Görünürlükleri <strong>Katmanlar</strong> listesinde.
            </p>
            <button
              className="btn btn-sm mt-2 self-start"
              type="button"
              onClick={() => {
                // Drop back to flow layout for one frame and measure *that*.
                // Measuring while the boxes are applied would just hand back
                // the boxes we already have.
                onChange({ ...spec, yerlesim: { serbest: false, kutular: {}, gizli: [] } });
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    onChange(setFreeLayout({ ...spec, yerlesim: { serbest: false, kutular: {}, gizli: [] } }, true))
                  )
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
      <Section id="zemin" title="Zemin">
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
      <Section id="galeri" title="Galeri">
        <div className="seg mb-2 w-full flex-wrap justify-between gap-y-0.5">
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

      {/* ---- çoklu seçim ---- */}
      {coklu.length > 1 && (
        <Section id="coklu" title={`${coklu.length} nesne seçili`}>
          <div className="flex flex-wrap gap-1">
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => setDecor(grupla(decor, coklu.map((n) => n.id)))}
              title="Birlikte taşınsınlar (Ctrl+G)"
            >
              Grupla
            </button>
            <button
              className="btn btn-sm"
              type="button"
              disabled={!coklu.some((n) => n.grup)}
              onClick={() => setDecor(grubuCoz(decor, coklu.map((n) => n.id)))}
              title="Grubu çöz (Ctrl+Shift+G)"
            >
              Grubu çöz
            </button>
          </div>
          <Field label="Renk" hint="Seçili nesnelerin hepsine uygulanır.">
            <ColorWell
              value={coklu[0].renk}
              fallback={colors[0]}
              onChange={(renk) =>
                setDecor({ ...decor, nesneler: decor.nesneler.map((n) => (selectedIds.includes(n.id) ? { ...n, renk } : n)) })
              }
            />
          </Field>
          <Field label="Opaklık">
            <Slider
              value={coklu[0].opaklik}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(opaklik) =>
                setDecor({ ...decor, nesneler: decor.nesneler.map((n) => (selectedIds.includes(n.id) ? { ...n, opaklik } : n)) })
              }
            />
          </Field>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Gruplanmış nesneler birlikte taşınır ve birine tıklamak hepsini seçer. Boyutlandırma ve döndürme tek nesneye özeldir.
          </p>
        </Section>
      )}

      {/* ---- selection properties ---- */}
      {selected && selectedDef && (
        <Section id="secili" title={`Seçili: ${selectedDef.label}`}>
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
          {/* İki uçlu varlıkta açı ve aynalama yok: yön uçların yerinden geliyor. */}
          {!selectedDef.uclar && (
            <>
              <Field label="Açı">
                <Slider value={selected.aci} min={-180} max={180} step={1} onChange={(aci) => setItem(selected.id, { aci })} />
              </Field>
              {/* Sıralama artık Katmanlar listesinin işi: satırı sürükleyin, ya da
                  [ ve ] ile bir adım oynatın. */}
              <Field label="Aynala">
                <Switch checked={selected.aynala} onChange={(aynala) => setItem(selected.id, { aynala })} />
              </Field>
            </>
          )}
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
          {!selectedDef.uclar && (
            <Field label="Boyut (g, y)" hint={otoBoy ? "Yükseklik metne göre; sabitlemek için aşağıdaki Yükseklik ayarı." : undefined}>
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
                  disabled={otoBoy}
                  value={Math.round(selected.h)}
                  onChange={(e) => {
                    const h = Math.max(4, Number(e.target.value) || 4);
                    setItem(selected.id, selectedDef.square ? { w: h, h } : { h });
                  }}
                />
              </div>
            </Field>
          )}
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
