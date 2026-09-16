import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

import { GRADIENT_LABELS, PATTERN_LABELS } from "@/decor";
import type { Bicem } from "@/lib/bicem";
import { KIND_ICONS, PICTO_ICONS } from "@/lib/chart-icons";
import { PALETTES, getPalette, isCustom, newPalette, seriesColor, type Palette } from "@/lib/palettes";
import type { Locale } from "@/lib/format";
import { SCOPE_LABELS } from "@/lib/geo";
import { sectionOpen, setSectionOpen } from "@/lib/ui-prefs";

import { KindGrid } from "./KindGrid";
import { RefLineList } from "./RefLineList";
import {
  KIND_LABELS,
  adaptDataForKind,
  dataShape,
  type ChartOptions,
  type ChartSpec,
  type ExportBackground,
  type MapProjection,
  type MapScope,
  type Theme,
} from "@/lib/spec";

/* ---------------- primitives ---------------- */

export function Field({
  label,
  children,
  hint,
  stack = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  /** Denetim satıra sığmıyorsa etiketi üste al. */
  stack?: boolean;
}) {
  return (
    <label className={stack ? "field field-stack" : "field"} title={hint}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Num({
  value,
  onChange,
  min,
  max,
  step = 1,
  allowEmpty = false,
  width,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
  width?: number;
}) {
  return (
    <input
      className="inp inp-num"
      style={width ? { width } : undefined}
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={allowEmpty ? "oto" : undefined}
      onChange={(e) => {
        if (e.target.value === "") {
          if (allowEmpty) onChange(null);
          return;
        }
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

/**
 * Katlanabilir panel bölümü.
 *
 * `id` iki iş yapıyor: açık/kapalı hâli `ui-prefs`'te o id ile saklanıyor ve
 * `[data-section]` seçicisi sahnede bir parçaya tıklandığında ilgili bölüme
 * kaydırmayı mümkün kılıyor (bkz. `App.tsx` inceleyici).
 */
/**
 * Görünecek bölümlerin kimlikleri. `null` = süzme yok, hepsi görünür.
 *
 * Sağ panel artık seçime göre içerik gösteriyor ve paneller bunun için yeniden
 * yazılmadı: hangi bölümün görüneceğini dışarıdan bu bağlam söylüyor. Bölümler
 * zaten `<Section id>` olarak ayrılmıştı, tek eksik hangisinin ne zaman
 * görüneceğiydi.
 */
const KapsamCtx = createContext<Set<string> | null>(null);

export function SectionScope({ show, children }: { show: string[]; children: ReactNode }) {
  const anahtar = show.join("|");
  const set = useMemo(() => new Set(show), [anahtar]); // eslint-disable-line react-hooks/exhaustive-deps
  return <KapsamCtx.Provider value={set}>{children}</KapsamCtx.Provider>;
}

export function Section({
  id,
  title,
  children,
  collapsible = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  const kapsam = useContext(KapsamCtx);
  const [open, setOpen] = useState(() => (collapsible ? sectionOpen(id) : true));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    setSectionOpen(id, next);
  };
  if (kapsam && !kapsam.has(id)) return null;
  return (
    <section className="section border-b border-border px-3 py-2.5 last:border-b-0" data-section={id} data-open={open}>
      {collapsible ? (
        <button type="button" className="section-head" aria-expanded={open} onClick={toggle}>
          <span className="panel-label">{title}</span>
          <ChevronDown size={13} strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <div className="section-head" aria-hidden>
          <span className="panel-label">{title}</span>
        </div>
      )}
      <div className="section-body flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

/** Sürekli bir sayı için kaydırıcı + okunur değer. */
export function Slider({
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

/** Bir renk kuyusu; boş değer "paletten al" anlamına gelir. */
export function ColorWell({ value, fallback, onChange }: { value: string; fallback: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input className="swatch" type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      <button className="btn btn-sm" type="button" onClick={() => onChange("")} aria-pressed={value === ""} title="Grafiğin paletinden al">
        {value === "" ? "Palet ✓" : "Palet"}
      </button>
    </div>
  );
}

/* ---------------- chart kind ---------------- */

/**
 * Tür seçici — sağ panelin başında.
 *
 * Izgara varsayılan olarak kapalı: kullanıcı türü bir kez seçiyor, sonra
 * ayarlarla uğraşıyor. 23 kartlık ızgara sürekli açık kalsa panelin üst
 * yarısını yiyor, altındaki ayarlar da göz hizasının dışında kalıyordu.
 */
export function KindPicker({ spec, onChange }: { spec: ChartSpec; onChange: (s: ChartSpec) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICONS[spec.kind];
  return (
    <section className="section border-b border-border px-3 py-2.5" data-section="tip">
      <div className="flex items-center gap-2">
        <Icon size={18} strokeWidth={1.6} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="grow truncate text-[12px] font-medium">{KIND_LABELS[spec.kind]}</span>
        <button className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Kapat" : "Değiştir"}
        </button>
      </div>
      {open && (
        <div className="mt-2.5">
          <KindGrid
            current={spec.kind}
            keepsDataOf={spec.kind}
            onPick={(k) => {
              if (k === spec.kind) return;
              onChange({ ...spec, kind: k, data: adaptDataForKind(spec.data, spec.kind, k) });
            }}
          />
        </div>
      )}
    </section>
  );
}

/* ---------------- options ---------------- */

export function OptionsPanel({ spec, onChange }: { spec: ChartSpec; onChange: (s: ChartSpec) => void }) {
  const o = spec.options;
  const set = (patch: Partial<ChartOptions>) => onChange({ ...spec, options: { ...o, ...patch } });
  const setFmt = (patch: Partial<ChartOptions["format"]>) => set({ format: { ...o.format, ...patch } });
  const cartesian = spec.kind === "line" || spec.kind === "area" || spec.kind === "bar" || spec.kind === "barH";
  const timeLike = spec.kind === "line" || spec.kind === "area";
  const bars = spec.kind === "bar" || spec.kind === "barH";
  const singleSeries = spec.data.columns.length === 2;
  /** Köşe yarıçapını okuyan türler. */
  const rounded = bars || spec.kind === "waterfall" || spec.kind === "marimekko" || spec.kind === "treemap";
  /** Değer etiketi okuyan türler. */
  const labelled =
    bars ||
    timeLike ||
    spec.kind === "ring" ||
    spec.kind === "heatmap" ||
    spec.kind === "waterfall" ||
    spec.kind === "pictogram";
  /** Sıralaması anlamlı olanlar: tek serili kartezyen + kategori/değer türleri. */
  const sortable = (bars && singleSeries) || spec.kind === "ring" || spec.kind === "funnel" || spec.kind === "pictogram";
  const hierarchy = dataShape(spec.kind) === "hierarchy";
  const xy = dataShape(spec.kind) === "xy";
  const relation = spec.kind === "chord" || spec.kind === "network" || spec.kind === "arc";
  // Göstergesi olmayan türler: takvim kendi ölçeğini, akış ve piktogram
  // etiketlerini grafiğin içinde taşır.
  const noLegend = spec.kind === "heatmap" || spec.kind === "sankey" || spec.kind === "pictogram";

  return (
    <div className="flex flex-col">
      <Section id="metin" title="Metin">
        <Field label="Başlık">
          <input className="inp w-44" value={spec.title} onChange={(e) => onChange({ ...spec, title: e.target.value })} />
        </Field>
        <Field label="Alt başlık">
          <input className="inp w-44" value={spec.subtitle} onChange={(e) => onChange({ ...spec, subtitle: e.target.value })} />
        </Field>
        <Field label="Dipnot / kaynak">
          <input className="inp w-44" value={spec.note} onChange={(e) => onChange({ ...spec, note: e.target.value })} />
        </Field>
        <Field label="Başlık boyutu">
          <Num value={o.titleSize} min={12} max={48} onChange={(v) => set({ titleSize: v ?? 22 })} />
        </Field>
      </Section>

      <Section id="kart" title="Kart">
        <Field label="Boyut (px)">
          <div className="flex items-center gap-1">
            <Num value={o.width} min={200} max={4000} step={10} onChange={(v) => set({ width: v ?? 960 })} width={68} />
            <span className="text-muted-foreground">×</span>
            <Num value={o.height} min={150} max={4000} step={10} onChange={(v) => set({ height: v ?? 540 })} width={68} />
          </div>
        </Field>
        <Field label="Hazır oranlar" stack>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["16:9", 960, 540],
                ["Yarım", 470, 540],
                ["Geniş", 1280, 480],
                ["Kare", 600, 600],
                ["4:3", 800, 600],
              ] as [string, number, number][]
            ).map(([l, w, h]) => (
              <button key={l} className="btn btn-sm" onClick={() => set({ width: w, height: h })}>
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Kenar boşluğu">
          <Num value={o.padding} min={0} max={200} onChange={(v) => set({ padding: v ?? 32 })} />
        </Field>
        <Field label="İç boşluk">
          <Num value={o.chartInset} min={0} max={80} onChange={(v) => set({ chartInset: v ?? 8 })} />
        </Field>
        <Field label="Animasyon" hint="Yalnız ekranda; PNG her zaman bitmiş hâli alır.">
          <Switch checked={o.animate} onChange={(v) => set({ animate: v })} />
        </Field>
        <Field
          label="Fare üstünde vurgu"
          hint="Bklit'in ipucu kutusu ve vurgulama davranışı. Kapalıyken kart sabit durur — süsleme yerleştirirken işi kolaylaştırır."
        >
          <Switch checked={o.hover} onChange={(v) => set({ hover: v })} />
        </Field>
      </Section>

      {!noLegend && (
        <Section id="gosterge" title="Gösterge (legend)">
          <Field label="Göster">
            <Switch checked={o.legend} onChange={(v) => set({ legend: v })} />
          </Field>
          <Field label="Konum">
            <Seg value={o.legendPosition} options={[["top", "Üst"], ["bottom", "Alt"], ["right", "Sağ"]]} onChange={(v) => set({ legendPosition: v })} />
          </Field>
          <Field label="Değerleri yaz" hint="Seri toplamı (halka: değer)">
            <Switch checked={o.legendValues} onChange={(v) => set({ legendValues: v })} />
          </Field>
        </Section>
      )}

      {cartesian && (
        <Section id="eksenler" title="Eksenler ve ızgara">
          <Field label="Izgara">
            <Switch checked={o.grid} onChange={(v) => set({ grid: v })} />
          </Field>
          {spec.kind !== "barH" && (
            <Field label="Dikey ızgara">
              <Switch checked={o.gridVertical} onChange={(v) => set({ gridVertical: v })} />
            </Field>
          )}
          <Field label={spec.kind === "barH" ? "Değer ekseni" : "Kategori ekseni (x)"}>
            <Switch checked={o.xAxis} onChange={(v) => set({ xAxis: v })} />
          </Field>
          {spec.kind !== "barH" && (
            <Field label="Değer ekseni (y)">
              <Switch checked={o.yAxis} onChange={(v) => set({ yAxis: v })} />
            </Field>
          )}
          <Field label="Değer adımı" hint="Izgara çizgisi / etiket sayısı">
            <Num value={o.yTicks} min={2} max={12} onChange={(v) => set({ yTicks: v ?? 5 })} />
          </Field>
          <Field label="Değer aralığı" hint="Boş = veriye göre otomatik. Alt sınır 0'ın altına inemez.">
            <div className="flex items-center gap-1">
              <Num value={o.yMin} allowEmpty width={62} onChange={(v) => set({ yMin: v })} />
              <span className="text-[11px] text-muted-foreground">–</span>
              <Num value={o.yMax} allowEmpty width={62} onChange={(v) => set({ yMax: v })} />
            </div>
          </Field>
          <Field label={spec.kind === "barH" ? "Değer ekseni adı" : "X ekseni adı"}>
            <input className="inp w-[132px]" value={o.xTitle} onChange={(e) => set({ xTitle: e.target.value })} />
          </Field>
          <Field label={spec.kind === "barH" ? "Kategori ekseni adı" : "Y ekseni adı"}>
            <input className="inp w-[132px]" value={o.yTitle} onChange={(e) => set({ yTitle: e.target.value })} />
          </Field>
          {spec.kind !== "barH" && (
            <Field label="Etiket açısı" hint="Oto: sığmayınca kendisi eğer" stack>
              <Seg
                value={String(o.xTickAngle) as "auto" | "0" | "45" | "90"}
                options={[
                  ["auto", "Oto"],
                  ["0", "0°"],
                  ["45", "45°"],
                  ["90", "90°"],
                ]}
                onChange={(v) => set({ xTickAngle: v === "auto" ? "auto" : (Number(v) as 0 | 45 | 90) })}
              />
            </Field>
          )}
          {timeLike && (
            <>
              <Field label="X ekseni türü">
                <Seg value={o.xMode} options={[["auto", "Oto"], ["category", "Kategori"], ["date", "Tarih"]]} onChange={(v) => set({ xMode: v })} />
              </Field>
              <Field label="Tarih biçimi">
                <select className="inp" value={o.dateGranularity} onChange={(e) => set({ dateGranularity: e.target.value as ChartOptions["dateGranularity"] })}>
                  <option value="auto">Otomatik</option>
                  <option value="day">Gün</option>
                  <option value="month">Ay</option>
                  <option value="quarter">Çeyrek</option>
                  <option value="year">Yıl</option>
                </select>
              </Field>
            </>
          )}
        </Section>
      )}

      {timeLike && (
        <Section id="tur" title={spec.kind === "area" ? "Alan" : "Çizgi"}>
          <Field label="Tahmin kesiği" hint="Bu satırdan sonrası kesikli çizilir. Boş = kapalı, 1 = tümü kesikli.">
            <Num value={o.forecastFrom} min={1} max={Math.max(1, spec.data.rows.length)} allowEmpty onChange={(v) => set({ forecastFrom: v })} />
          </Field>
          <Field label="Eğri">
            <Seg value={o.curve} options={[["linear", "Düz"], ["monotone", "Yumuşak"], ["step", "Basamak"], ["natural", "Doğal"]]} onChange={(v) => set({ curve: v })} />
          </Field>
          <Field label="Kalınlık">
            <Num value={o.strokeWidth} min={1} max={8} step={0.5} onChange={(v) => set({ strokeWidth: v ?? 2 })} />
          </Field>
          <Field label="Noktalar">
            <Switch checked={o.showMarkers} onChange={(v) => set({ showMarkers: v })} />
          </Field>
          {spec.kind === "area" && (
            <Field label="Dolgu gradyanı" hint="Kapalıyken dolgu düz renk">
              <Switch checked={o.areaGradient} onChange={(v) => set({ areaGradient: v })} />
            </Field>
          )}
          {spec.kind === "area" && (
            <Field label="Dolgu opaklığı">
              <Num value={o.areaOpacity} min={0.05} max={1} step={0.05} onChange={(v) => set({ areaOpacity: v ?? 0.25 })} />
            </Field>
          )}
        </Section>
      )}

      {bars && (
        <Section id="tur" title="Çubuklar">
          <Field label="Yığılı">
            <Switch checked={o.stacked} onChange={(v) => set({ stacked: v })} />
          </Field>
          <Field label="Çubuk kalınlığı" hint="Boş = otomatik">
            <Num value={o.barWidth} min={2} max={200} allowEmpty onChange={(v) => set({ barWidth: v })} />
          </Field>
          <Field label="Grup aralığı" hint="0 = bitişik, 0.9 = çok seyrek">
            <Num value={o.barGap} min={0} max={0.9} step={0.05} onChange={(v) => set({ barGap: v ?? 0.35 })} />
          </Field>
          {singleSeries && (
            <Field label="Renk" hint="Tek seride her kategori ayrı renk olabilir">
              <Seg
                value={o.colorBy}
                options={[
                  ["series", "Seri"],
                  ["category", "Kategori"],
                ]}
                onChange={(v) => set({ colorBy: v })}
              />
            </Field>
          )}
        </Section>
      )}

      {rounded && (
        <Section id="bicimlendirme" title="Biçim">
          <Field label="Köşe yarıçapı" hint="0 = keskin köşe">
            <Slider value={o.barRadius} min={0} max={24} step={1} onChange={(v) => set({ barRadius: v })} />
          </Field>
        </Section>
      )}

      {(sortable || bars) && (
        <Section id="vurgu" title="Sıralama ve vurgu">
          {sortable && (
            <Field label="Sırala" hint="Değere göre; tarih ekseninde uygulanmaz">
              <Seg
                value={o.sort}
                options={[
                  ["none", "Yok"],
                  ["desc", "Azalan"],
                  ["asc", "Artan"],
                ]}
                onChange={(v) => set({ sort: v })}
              />
            </Field>
          )}
          {bars && (
            <>
              <Field label="Vurgulananlar" hint="Sahnede bir çubuğa tıklayarak da seçilir">
                <span className="text-[11px] text-muted-foreground">
                  {o.highlight.length === 0 ? "hepsi tam" : `${o.highlight.length} kategori`}
                </span>
              </Field>
              {o.highlight.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pb-1">
                  {o.highlight.map((h) => (
                    <button
                      key={h}
                      className="chip"
                      title="Vurgudan çıkar"
                      onClick={() => set({ highlight: o.highlight.filter((x) => x !== h) })}
                    >
                      {h} <X size={11} />
                    </button>
                  ))}
                  <button className="btn btn-sm" onClick={() => set({ highlight: [] })}>
                    Temizle
                  </button>
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {spec.kind === "ring" && (
        <Section id="tur" title="Halka">
          <Field label="Mod">
            <Seg value={o.ringShare ? "share" : "target"} options={[["share", "Toplam payı"], ["target", "Hedefe göre"]]} onChange={(v) => set({ ringShare: v === "share" })} />
          </Field>
          <Field label="Halka kalınlığı">
            <Num value={o.ringStroke} min={4} max={60} onChange={(v) => set({ ringStroke: v ?? 16 })} />
          </Field>
          <Field label="Halka aralığı">
            <Num value={o.ringGap} min={0} max={30} onChange={(v) => set({ ringGap: v ?? 6 })} />
          </Field>
          <Field label="Merkez yazısı">
            <Switch checked={o.ringCenter} onChange={(v) => set({ ringCenter: v })} />
          </Field>
          <Field label="Merkez etiketi">
            <input className="inp w-32" value={o.ringCenterLabel} onChange={(e) => set({ ringCenterLabel: e.target.value })} />
          </Field>
        </Section>
      )}

      {spec.kind === "heatmap" && (
        <Section id="tur" title="Isı takvimi">
          <Field label="Hafta başı">
            <Seg value={String(o.heatmapWeekStart) as "0" | "1"} options={[["1", "Pazartesi"], ["0", "Pazar"]]} onChange={(v) => set({ heatmapWeekStart: v === "1" ? 1 : 0 })} />
          </Field>
          <Field label="Az / çok göstergesi">
            <Switch checked={o.heatmapLegend} onChange={(v) => set({ heatmapLegend: v })} />
          </Field>
        </Section>
      )}

      {spec.kind === "sankey" && (
        <Section id="tur" title="Akış">
          <Field label="Düğüm kalınlığı">
            <Num value={o.sankeyNodeWidth} min={4} max={60} onChange={(v) => set({ sankeyNodeWidth: v ?? 16 })} />
          </Field>
          <Field label="Düğüm aralığı">
            <Num value={o.sankeyNodePadding} min={4} max={120} onChange={(v) => set({ sankeyNodePadding: v ?? 24 })} />
          </Field>
          <Field label="Değer etiketleri">
            <Switch checked={o.sankeyValueLabels} onChange={(v) => set({ sankeyValueLabels: v })} />
          </Field>
          <Field label="Birim">
            <input className="inp w-28" placeholder="örn. kişi" value={o.sankeyUnit} onChange={(e) => set({ sankeyUnit: e.target.value })} />
          </Field>
        </Section>
      )}

      {hierarchy && (
        <Section id="tur" title="Hiyerarşi">
          <Field label="Etiketler">
            <Switch checked={o.hierarchyLabels} onChange={(v) => set({ hierarchyLabels: v })} />
          </Field>
          <Field label="Değerler">
            <Switch checked={o.hierarchyValues} onChange={(v) => set({ hierarchyValues: v })} />
          </Field>
          <Field label="Renk" hint="Ana gruba göre tonlama ya da düz renk">
            <Seg
              value={o.hierarchyColorDepth === 1 ? "flat" : "shade"}
              options={[["shade", "Tonlu"], ["flat", "Düz"]]}
              onChange={(v) => set({ hierarchyColorDepth: v === "flat" ? 1 : 0 })}
            />
          </Field>
          <Field label="Aralık">
            <Num value={o.hierarchyPad} min={0} max={20} onChange={(v) => set({ hierarchyPad: v ?? 3 })} />
          </Field>
          {spec.kind === "sunburst" && (
            <Field label="İç boşluk" hint="Dış yarıçapın yüzdesi">
              <Num value={o.sunburstInner} min={0} max={70} onChange={(v) => set({ sunburstInner: v ?? 32 })} />
            </Field>
          )}
        </Section>
      )}

      {xy && (
        <Section id="tur" title={spec.kind === "bubble" ? "Balonlar" : "Noktalar"}>
          <Field label="Simge">
            <select className="inp" value={o.pointGlyph} onChange={(e) => set({ pointGlyph: e.target.value as ChartOptions["pointGlyph"] })}>
              <option value="circle">Daire</option>
              <option value="square">Kare</option>
              <option value="diamond">Elmas</option>
              <option value="triangle">Üçgen</option>
              <option value="star">Yıldız</option>
              <option value="cross">Artı</option>
              <option value="wye">Çatal</option>
            </select>
          </Field>
          {spec.kind === "bubble" ? (
            <Field label="En büyük balon" hint="Yarıçap, piksel">
              <Num value={o.bubbleMax} min={8} max={120} onChange={(v) => set({ bubbleMax: v ?? 46 })} />
            </Field>
          ) : (
            <Field label="Nokta boyutu">
              <Num value={o.pointSize} min={2} max={30} onChange={(v) => set({ pointSize: v ?? 7 })} />
            </Field>
          )}
          <Field label="Opaklık">
            <Num value={o.pointOpacity} min={0.1} max={1} step={0.05} onChange={(v) => set({ pointOpacity: v ?? 0.85 })} />
          </Field>
          <Field label="Nokta etiketleri">
            <Switch checked={o.pointLabels} onChange={(v) => set({ pointLabels: v })} />
          </Field>
          <Field label="Eğilim çizgisi" hint="En küçük kareler + R²">
            <Switch checked={o.trendLine} onChange={(v) => set({ trendLine: v })} />
          </Field>
          <Field label="Çeyrek çizgileri">
            <Switch checked={o.quadrants} onChange={(v) => set({ quadrants: v })} />
          </Field>
          <Field label="X ekseni adı">
            <input className="inp w-32" value={o.xTitle} onChange={(e) => set({ xTitle: e.target.value })} />
          </Field>
          <Field label="Y ekseni adı">
            <input className="inp w-32" value={o.yTitle} onChange={(e) => set({ yTitle: e.target.value })} />
          </Field>
        </Section>
      )}

      {relation && (
        <Section id="tur" title="İlişki">
          <Field label="Düğüm adları">
            <Switch checked={o.nodeLabels} onChange={(v) => set({ nodeLabels: v })} />
          </Field>
          <Field label="Bağlantı opaklığı">
            <Num value={o.linkOpacity} min={0.1} max={1} step={0.05} onChange={(v) => set({ linkOpacity: v ?? 0.5 })} />
          </Field>
          {spec.kind === "chord" && (
            <>
              <Field label="Halka kalınlığı">
                <Num value={o.chordThickness} min={4} max={48} onChange={(v) => set({ chordThickness: v ?? 14 })} />
              </Field>
              <Field label="Dilim aralığı">
                <Num value={o.chordPad} min={0} max={0.2} step={0.01} onChange={(v) => set({ chordPad: v ?? 0.04 })} />
              </Field>
            </>
          )}
          {spec.kind === "network" && (
            <>
              <Field label="Düğüm boyutu">
                <Num value={o.networkNodeSize} min={3} max={30} onChange={(v) => set({ networkNodeSize: v ?? 9 })} />
              </Field>
              <Field label="İtme gücü" hint="Daha negatif = daha dağınık">
                <Num value={o.networkCharge} min={-1200} max={-20} step={20} onChange={(v) => set({ networkCharge: v ?? -260 })} />
              </Field>
            </>
          )}
          {spec.kind === "arc" && (
            <Field label="Yay yüksekliği">
              <Num value={o.arcHeight} min={0.2} max={1} step={0.05} onChange={(v) => set({ arcHeight: v ?? 0.62 })} />
            </Field>
          )}
        </Section>
      )}

      {spec.kind === "radar" && (
        <Section id="tur" title="Radar">
          <Field label="Izgara biçimi">
            <Seg
              value={o.radarStraight ? "poly" : "circle"}
              options={[["poly", "Çokgen"], ["circle", "Daire"]]}
              onChange={(v) => set({ radarStraight: v === "poly" })}
            />
          </Field>
          <Field label="Halka sayısı">
            <Num value={o.radarLevels} min={1} max={8} onChange={(v) => set({ radarLevels: v ?? 4 })} />
          </Field>
          <Field label="Dolgu opaklığı">
            <Num value={o.radarFill} min={0} max={1} step={0.02} onChange={(v) => set({ radarFill: v ?? 0.18 })} />
          </Field>
          <Field label="Çizgi kalınlığı">
            <Num value={o.strokeWidth} min={1} max={8} step={0.5} onChange={(v) => set({ strokeWidth: v ?? 2 })} />
          </Field>
          <Field label="Noktalar">
            <Switch checked={o.radarDots} onChange={(v) => set({ radarDots: v })} />
          </Field>
          <Field label="Üst sınır" hint="Boş = veriden">
            <Num value={o.yMax} allowEmpty onChange={(v) => set({ yMax: v })} />
          </Field>
        </Section>
      )}

      {spec.kind === "slope" && (
        <Section id="tur" title="Eğim">
          <Field label="Uç etiketleri">
            <Switch checked={o.slopeLabels} onChange={(v) => set({ slopeLabels: v })} />
          </Field>
          <Field label="Uçlarda değer">
            <Switch checked={o.slopeValues} onChange={(v) => set({ slopeValues: v })} />
          </Field>
          <Field label="Çizgi kalınlığı">
            <Num value={o.strokeWidth} min={1} max={8} step={0.5} onChange={(v) => set({ strokeWidth: v ?? 2 })} />
          </Field>
          <Field label="Nokta yarıçapı" hint="0 = nokta yok">
            <Num value={o.slopeDots} min={0} max={12} onChange={(v) => set({ slopeDots: v ?? 5 })} />
          </Field>
        </Section>
      )}

      {spec.kind === "gauge" && (
        <Section id="tur" title="Gösterge">
          <Field label="Yay açısı" hint="Derece; 180 yarım daire">
            <Num value={o.gaugeSweep} min={90} max={350} step={10} onChange={(v) => set({ gaugeSweep: v ?? 250 })} />
          </Field>
          <Field label="Kalınlık">
            <Num value={o.gaugeThickness} min={4} max={90} onChange={(v) => set({ gaugeThickness: v ?? 26 })} />
          </Field>
          <Field label="Skala aralığı">
            <div className="flex items-center gap-1">
              <Num value={o.gaugeMin} onChange={(v) => set({ gaugeMin: v ?? 0 })} width={64} />
              <span className="text-muted-foreground">→</span>
              <Num value={o.gaugeMax} onChange={(v) => set({ gaugeMax: v ?? 100 })} width={64} />
            </div>
          </Field>
          <Field label="Skala adımı">
            <Num value={o.gaugeTicks} min={1} max={12} onChange={(v) => set({ gaugeTicks: v ?? 5 })} />
          </Field>
          <Field label="Skalayı göster">
            <Switch checked={o.xAxis} onChange={(v) => set({ xAxis: v })} />
          </Field>
          <Field label="İbre">
            <Switch checked={o.gaugeNeedle} onChange={(v) => set({ gaugeNeedle: v })} />
          </Field>
        </Section>
      )}

      {spec.kind === "waterfall" && (
        <Section id="tur" title="Şelale">
          <Field label="Toplam sütunu">
            <Switch checked={o.waterfallTotal} onChange={(v) => set({ waterfallTotal: v })} />
          </Field>
          <Field label="Toplam etiketi">
            <input className="inp w-32" value={o.waterfallTotalLabel} onChange={(e) => set({ waterfallTotalLabel: e.target.value })} />
          </Field>
          <Field label="Bağlayıcı çizgiler">
            <Switch checked={o.waterfallConnectors} onChange={(v) => set({ waterfallConnectors: v })} />
          </Field>
          <Field label="Çubuk aralığı">
            <Num value={o.barGap} min={0} max={0.8} step={0.05} onChange={(v) => set({ barGap: v ?? 0.35 })} />
          </Field>
        </Section>
      )}

      {spec.kind === "funnel" && (
        <Section id="tur" title="Huni">
          <Field label="Biçim">
            <Seg
              value={o.funnelShape}
              options={[["funnel", "Huni"], ["pyramid", "Piramit"], ["bar", "Çubuk"]]}
              onChange={(v) => set({ funnelShape: v })}
            />
          </Field>
          <Field label="Aşama aralığı">
            <Num value={o.funnelGap} min={0} max={40} onChange={(v) => set({ funnelGap: v ?? 6 })} />
          </Field>
          <Field label="Dönüşüm yüzdesi">
            <Switch checked={o.funnelDropLabels} onChange={(v) => set({ funnelDropLabels: v })} />
          </Field>
        </Section>
      )}

      {spec.kind === "marimekko" && (
        <Section id="tur" title="Marimekko">
          <Field label="Pay etiketleri">
            <Switch checked={o.mekkoLabels} onChange={(v) => set({ mekkoLabels: v })} />
          </Field>
          <Field label="Sütun başlıkları">
            <Switch checked={o.xAxis} onChange={(v) => set({ xAxis: v })} />
          </Field>
          <Field label="Yüzde ekseni">
            <Switch checked={o.yAxis} onChange={(v) => set({ yAxis: v })} />
          </Field>
          <Field label="Sütun aralığı">
            <Num value={o.mekkoGap} min={0} max={24} onChange={(v) => set({ mekkoGap: v ?? 3 })} />
          </Field>
        </Section>
      )}

      {spec.kind === "pictogram" && (
        <Section id="tur" title="Piktogram">
          <Field label="Simge">
            <select className="inp w-32" value={o.pictoIcon} onChange={(e) => set({ pictoIcon: e.target.value })}>
              {PICTO_ICONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Simge başına birim">
            <Num value={o.pictoUnit} min={1} onChange={(v) => set({ pictoUnit: v ?? 10 })} />
          </Field>
          <Field label="Satır başına simge">
            <Num value={o.pictoPerRow} min={1} max={60} onChange={(v) => set({ pictoPerRow: v ?? 10 })} />
          </Field>
          <Field label="Simge aralığı">
            <Num value={o.pictoGap} min={0} max={20} onChange={(v) => set({ pictoGap: v ?? 4 })} />
          </Field>
        </Section>
      )}

      {spec.kind === "map" && (
        <Section id="tur" title="Harita">
          <Field label="Kapsam">
            <select className="inp w-36" value={o.mapScope} onChange={(e) => set({ mapScope: e.target.value as MapScope })}>
              {(Object.keys(SCOPE_LABELS) as MapScope[]).map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gösterim">
            <Seg
              value={o.mapMode}
              options={[["choropleth", "Boyalı"], ["bubble", "Kabarcık"]]}
              onChange={(v) => set({ mapMode: v })}
            />
          </Field>
          <Field label="İzdüşüm">
            <select className="inp w-36" value={o.mapProjection} onChange={(e) => set({ mapProjection: e.target.value as MapProjection })}>
              <option value="naturalEarth">Natural Earth</option>
              <option value="equalEarth">Equal Earth</option>
              <option value="mercator">Mercator</option>
              <option value="orthographic">Küre</option>
            </select>
          </Field>
          {o.mapMode === "bubble" && (
            <Field label="En büyük kabarcık">
              <Num value={o.mapBubbleMax} min={6} max={90} onChange={(v) => set({ mapBubbleMax: v ?? 34 })} />
            </Field>
          )}
          <Field label="Değerleri yaz">
            <Switch checked={o.mapLabels} onChange={(v) => set({ mapLabels: v })} />
          </Field>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Ülke sütununa Türkçe ad ("Almanya"), İngilizce ad ("Germany"), ISO kodu ("DE") ya da sayısal kod ("276")
            yazabilirsiniz. Eşleşmeyenler grafiğin altında listelenir.
          </p>
        </Section>
      )}

      {labelled && (
        <Section id="etiketler" title="Değer etiketleri">
          <Field
            label="Yaz"
            stack
            hint={
              spec.kind === "waterfall" || spec.kind === "pictogram"
                ? "Oto = bu türde açık"
                : "Oto = bu türde kapalı"
            }
          >
            <Seg
              value={o.valueLabels}
              options={
                bars || spec.kind === "waterfall"
                  ? [
                      ["auto", "Oto"],
                      ["none", "Yok"],
                      ["outside", "Dışta"],
                      ["inside", "İçte"],
                    ]
                  : [
                      ["auto", "Oto"],
                      ["none", "Yok"],
                      ["outside", "Göster"],
                    ]
              }
              onChange={(v) => set({ valueLabels: v })}
            />
          </Field>
          {timeLike && o.valueLabels !== "none" && (
            <Field label="Noktalar" hint="Kalabalık seride yalnız son nokta daha okunur">
              <Seg
                value={o.valueLabelPoints}
                options={[
                  ["all", "Hepsi"],
                  ["last", "Yalnız son"],
                ]}
                onChange={(v) => set({ valueLabelPoints: v })}
              />
            </Field>
          )}
          <Field label="Yazı boyutu">
            <Slider value={o.valueLabelSize} min={7} max={24} step={1} onChange={(v) => set({ valueLabelSize: v })} />
          </Field>
        </Section>
      )}

      {cartesian && (
        <Section id="referans" title="Referans çizgileri">
          <p className="pb-1 text-[11px] leading-snug text-muted-foreground">
            Hedef, eşik ya da ortalama. Dekor okundan farkı: bunlar veri uzayında durur, tablo değişince yerini korur.
          </p>
          <RefLineList lines={o.refLines} onChange={(refLines) => set({ refLines })} />
        </Section>
      )}

      <Section id="dekor" title="Dekor">
        <Field label="Doku">
          <select className="inp w-28" value={o.decorPattern} onChange={(e) => set({ decorPattern: e.target.value as ChartOptions["decorPattern"] })}>
            <option value="none">Yok</option>
            {(Object.keys(PATTERN_LABELS) as (keyof typeof PATTERN_LABELS)[]).map((k) => (
              <option key={k} value={k}>
                {PATTERN_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        {o.decorPattern !== "none" && (
          <Field label="Doku opaklığı">
            <Num value={o.decorPatternOpacity} min={0.05} max={1} step={0.05} onChange={(v) => set({ decorPatternOpacity: v ?? 0.5 })} />
          </Field>
        )}
        <Field label="Gradyan">
          <select className="inp w-28" value={o.decorGradient} onChange={(e) => set({ decorGradient: e.target.value as ChartOptions["decorGradient"] })}>
            <option value="none">Yok</option>
            {(Object.keys(GRADIENT_LABELS) as (keyof typeof GRADIENT_LABELS)[]).map((k) => (
              <option key={k} value={k}>
                {GRADIENT_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bloom" hint="Arkada yumuşak renk ışıması">
          <select className="inp w-28" value={o.decorBloom} onChange={(e) => set({ decorBloom: e.target.value as ChartOptions["decorBloom"] })}>
            <option value="none">Yok</option>
            <option value="topRight">Sağ üst</option>
            <option value="bottomLeft">Sol alt</option>
            <option value="center">Merkez halka</option>
            <option value="corners">Köşeler</option>
          </select>
        </Field>
        {o.decorBloom !== "none" && (
          <Field label="Bloom rengi" hint="Kaçıncı seri rengi">
            <Num value={o.decorBloomSeries + 1} min={1} max={8} onChange={(v) => set({ decorBloomSeries: (v ?? 1) - 1 })} />
          </Field>
        )}
        <Field label="Başlık vurgu çubuğu">
          <Switch checked={o.decorAccentBar} onChange={(v) => set({ decorAccentBar: v })} />
        </Field>
      </Section>

      <Section id="bicim" title="Sayı biçimi">
        <Field label="Yerel">
          <Seg value={o.format.locale} options={[["tr-TR", "1.250,5"], ["en-US", "1,250.5"]]} onChange={(v: Locale) => setFmt({ locale: v })} />
        </Field>
        <Field label="Ondalık">
          <Num value={o.format.decimals} min={0} max={6} onChange={(v) => setFmt({ decimals: v ?? 0 })} />
        </Field>
        <Field label="Ön ek / son ek">
          <div className="flex gap-1">
            <input className="inp w-16" placeholder="₺" value={o.format.prefix} onChange={(e) => setFmt({ prefix: e.target.value })} />
            <input className="inp w-16" placeholder="%" value={o.format.suffix} onChange={(e) => setFmt({ suffix: e.target.value })} />
          </div>
        </Field>
        <Field label="Kısalt" hint="1.250.000 → 1,3 Mn">
          <Switch checked={o.format.compact} onChange={(v) => setFmt({ compact: v })} />
        </Field>
      </Section>
    </div>
  );
}

/* ---------------- colours ---------------- */

export function ColorsPanel({
  spec,
  theme,
  seriesNames,
  palettes,
  onPalettes,
  onChange,
}: {
  spec: ChartSpec;
  theme: Theme;
  seriesNames: string[];
  palettes: Palette[];
  onPalettes: (list: Palette[]) => void;
  onChange: (s: ChartSpec) => void;
}) {
  const palette = getPalette(spec.paletteId, palettes);
  const editing = isCustom(spec.paletteId, palettes) ? palette : null;

  const savePalette = (next: Palette) => onPalettes(palettes.map((p) => (p.id === next.id ? next : p)));
  const addPalette = () => {
    // Seeded from whatever is selected, so a custom palette starts as a copy
    // you can nudge rather than eight empty swatches.
    const fresh = newPalette(palette, palettes.length + 1);
    onPalettes([...palettes, fresh]);
    onChange({ ...spec, paletteId: fresh.id, colors: [] });
  };
  const deletePalette = (id: string) => {
    onPalettes(palettes.filter((p) => p.id !== id));
    if (spec.paletteId === id) onChange({ ...spec, paletteId: "varsayilan", colors: [] });
  };
  const setColor = (i: number, hex: string | null) => {
    const colors = [...spec.colors];
    while (colors.length <= i) colors.push("");
    colors[i] = hex ?? "";
    while (colors.length && !colors[colors.length - 1]) colors.pop();
    onChange({ ...spec, colors });
  };

  return (
    <div className="flex flex-col">
      <Section id="palet" title="Palet">
        <div className="flex flex-col gap-1.5">
          {[...PALETTES, ...palettes].map((p) => (
            <button
              key={p.id}
              type="button"
              className="kind-btn"
              style={{ flexDirection: "row", justifyContent: "space-between", padding: "8px 10px" }}
              aria-pressed={p.id === spec.paletteId}
              title={p.note}
              onClick={() => onChange({ ...spec, paletteId: p.id, colors: [] })}
            >
              <span className="text-[12px] text-foreground">{p.name}</span>
              <span className="flex gap-1">
                {(theme === "dark" ? p.dark : p.light).slice(0, 10).map((c, i) => (
                  <span key={i} className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button className="btn btn-sm" type="button" onClick={addPalette} title="Seçili paletin kopyasından yeni bir palet aç">
            + Palet ekle
          </button>
          {editing && (
            <button className="btn btn-sm btn-danger" type="button" onClick={() => deletePalette(editing.id)}>
              Paleti sil
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-border p-2">
            <Field label="Ad">
              <input
                className="inp w-[150px]"
                value={editing.name}
                maxLength={60}
                onChange={(e) => savePalette({ ...editing, name: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5">
              {editing.light.map((c, i) => (
                <span key={i} className="relative inline-flex">
                  <input
                    className="swatch"
                    type="color"
                    value={c}
                    title={`${i + 1}. renk`}
                    onChange={(e) => {
                      const light = [...editing.light];
                      light[i] = e.target.value;
                      // One list serves both themes; a custom palette is a
                      // brand choice, not a light/dark pair to maintain.
                      savePalette({ ...editing, light, dark: light });
                    }}
                  />
                </span>
              ))}
              <button
                className="icon-btn"
                type="button"
                title="Renk ekle"
                onClick={() => {
                  const light = [...editing.light, editing.light[editing.light.length - 1] ?? "#2a78d6"];
                  savePalette({ ...editing, light, dark: light });
                }}
                disabled={editing.light.length >= 16}
              >
                +
              </button>
              <button
                className="icon-btn"
                type="button"
                title="Son rengi çıkar"
                onClick={() => {
                  const light = editing.light.slice(0, -1);
                  savePalette({ ...editing, light, dark: light });
                }}
                disabled={editing.light.length <= 1}
              >
                −
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sıra önemli: seriler bu sırayla boyanır. Süsleme de ilk rengi kullanır.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">{palette.note}</p>
        )}
      </Section>

      <Section id="seri" title="Seri renkleri">
        {seriesNames.length === 0 && <p className="text-[11px] text-muted-foreground">Veri girildiğinde seriler burada listelenir.</p>}
        {seriesNames.map((name, i) => {
          const resolved = seriesColor(i, spec.colors, palette, theme);
          const custom = Boolean(spec.colors[i]);
          return (
            <div key={i} className="field">
              <span className="truncate" title={name}>
                {name}
              </span>
              <span className="flex items-center gap-1.5">
                <input
                  className="inp w-[74px] font-mono text-[11px] uppercase"
                  value={resolved}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(i, v);
                  }}
                />
                <input className="swatch" type="color" value={resolved} onChange={(e) => setColor(i, e.target.value)} />
                {custom && (
                  <button className="btn btn-sm" title="Palete dön" onClick={() => setColor(i, null)}>
                    ↺
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {spec.colors.some(Boolean) && (
          <button className="btn btn-sm mt-2 self-start" onClick={() => onChange({ ...spec, colors: [] })}>
            Tüm özel renkleri sıfırla
          </button>
        )}
      </Section>
    </div>
  );
}

/* ---------------- export ---------------- */

export function ExportPanel({
  scale,
  background,
  width,
  height,
  busy,
  onScale,
  onBackground,
  onDownload,
  onCopy,
  onSvg,
  onSvgCopy,
  onAllPng,
  onAllSvg,
  onPptx,
  onPptxAll,
  onSaveJson,
  onLoadJson,
  chartCount,
  message,
}: {
  scale: 1 | 2 | 3 | 4;
  background: ExportBackground;
  width: number;
  height: number;
  busy: boolean;
  onScale: (s: 1 | 2 | 3 | 4) => void;
  onBackground: (b: ExportBackground) => void;
  onDownload: () => void;
  onCopy: () => void;
  onSvg: () => void;
  onSvgCopy: () => void;
  onAllPng: () => void;
  onAllSvg: () => void;
  onPptx: () => void;
  onPptxAll: () => void;
  onSaveJson: () => void;
  onLoadJson: () => void;
  chartCount: number;
  message: string | null;
}) {
  const many = chartCount > 1;
  return (
    <div className="flex flex-col">
      <Section id="png" title="PNG" collapsible={false}>
        <Field label="Çözünürlük">
          <Seg value={String(scale) as "1" | "2" | "3" | "4"} options={[["1", "1×"], ["2", "2×"], ["3", "3×"], ["4", "4×"]]} onChange={(v) => onScale(Number(v) as 1 | 2 | 3 | 4)} />
        </Field>
        <Field label="Arka plan">
          <Seg value={background} options={[["theme", "Tema"], ["transparent", "Şeffaf"]]} onChange={onBackground} />
        </Field>
        <p className="py-1 text-[11px] text-muted-foreground tabular-nums">
          Çıktı: {width * scale} × {height * scale} px
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button className="btn btn-primary" data-act="png" disabled={busy} onClick={onDownload}>
            {busy ? "Hazırlanıyor…" : "İndir"}
          </button>
          <button className="btn" data-act="png-copy" disabled={busy} onClick={onCopy}>
            Panoya kopyala
          </button>
          <button className="btn" data-act="png-zip" disabled={busy || !many} onClick={onAllPng} title="Her grafik bir dosya, hepsi tek zip">
            Tümü (zip)
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Panoya kopyalanan görüntü PowerPoint'e doğrudan Ctrl+V ile yapıştırılır. Şeffaf arka plan koyu slayt
          şablonlarında işe yarar.
        </p>
      </Section>

      <Section id="svg" title="SVG (vektör)" collapsible={false}>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-primary" data-act="svg" disabled={busy} onClick={onSvg}>
            İndir
          </button>
          <button className="btn" data-act="svg-copy" disabled={busy} onClick={onSvgCopy}>
            Panoya kopyala
          </button>
          <button className="btn" data-act="svg-zip" disabled={busy || !many} onClick={onAllSvg}>
            Tümü (zip)
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Kartın tamamı vektör: başlık, gösterge, eksen etiketleri, değer etiketleri ve süsleme dâhil. Illustrator,
          Inkscape ya da Figma'da metni ve rengi düzenleyebilirsiniz.
        </p>
      </Section>

      <Section id="pptx" title="PowerPoint" collapsible={false}>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-primary" data-act="pptx" disabled={busy} onClick={onPptx}>
            Slayt (.pptx)
          </button>
          <button className="btn" disabled={busy || !many} onClick={onPptxAll} title="Çalışma alanındaki her grafik bir slayt olur">
            Tümü ({chartCount} slayt)
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          16:9 geniş ekran sunu; grafik yukarıdaki çözünürlükte PNG olarak slayta ortalanır. Dosyayı açıp slaytları
          kendi sununuza sürükleyebilirsiniz.
        </p>
      </Section>

      <Section id="json" title="Çalışma alanı" collapsible={false}>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn" onClick={onSaveJson}>
            Kaydet (JSON)
          </button>
          <button className="btn" onClick={onLoadJson}>
            Yükle
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Bütün grafikler, veriler ve paletler tek dosyada. Başka bir makineye taşımak ya da yedeklemek için.
        </p>
      </Section>

      {message && (
        <div className="px-3 py-2 text-[11px] leading-snug text-muted-foreground">{message}</div>
      )}
    </div>
  );
}

/* ---------------- biçem panosu ---------------- */

/**
 * Stili kopyala / yapıştır.
 *
 * Dört grafikte aynı paleti, aynı kart ölçüsünü, aynı süslemeyi elle kurmak
 * bu aracın en çok tekrar ettirdiği işti. Pano oturumluk: iş dosyasına
 * yazılmıyor, çünkü kopyalanan şey işin kendisi değil bir jestin ortası.
 *
 * `Tümüne uygula` panoya hiç uğramıyor — aktif kartın biçemini doğrudan
 * ötekilere geçiriyor, yani "şunu şablon yap" tek düğme.
 */
export function BicemPanel({
  pano,
  kartSayisi,
  onKopyala,
  onYapistir,
  onHepsine,
}: {
  pano: Bicem | null;
  kartSayisi: number;
  onKopyala: () => void;
  onYapistir: () => void;
  onHepsine: () => void;
}) {
  return (
    <Section id="stil" title="Stil">
      <div className="flex flex-wrap gap-1">
        <button className="btn btn-sm" type="button" onClick={onKopyala} title="Bu kartın görünümünü panoya al (Ctrl+Alt+C)">
          Stili kopyala
        </button>
        <button
          className="btn btn-sm"
          type="button"
          disabled={!pano}
          onClick={onYapistir}
          title={pano ? `"${pano.kaynak}" kartının görünümünü uygula (Ctrl+Alt+V)` : "Önce bir kartın stilini kopyalayın"}
        >
          Yapıştır
        </button>
        <button
          className="btn btn-sm"
          type="button"
          disabled={kartSayisi < 2}
          onClick={onHepsine}
          title="Bu kartın görünümünü diğer bütün grafiklere geçir"
        >
          Tümüne uygula
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {pano ? (
          <>
            Panoda: <strong>{pano.kaynak}</strong>. Palet, kart ölçüsü, eksen ve gösterge ayarları, süsleme ve serbest
            yerleşim taşınır; veri, tür, başlık ve dipnot yerinde kalır.
          </>
        ) : (
          <>Palet, kart ölçüsü, eksen ve gösterge ayarları, süsleme ve serbest yerleşim taşınır; veri, tür ve yazdığınız metin yerinde kalır.</>
        )}
      </p>
    </Section>
  );
}
