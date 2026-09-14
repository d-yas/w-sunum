import type { ReactNode } from "react";

import { PALETTES, getPalette, seriesColor } from "@/lib/palettes";
import type { Locale } from "@/lib/format";
import {
  KIND_LABELS,
  adaptDataForKind,
  type ChartKind,
  type ChartOptions,
  type ChartSpec,
  type ExportBackground,
  type Theme,
} from "@/lib/spec";

/* ---------------- primitives ---------------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field" title={hint}>
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

function Num({
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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5 border-b border-border px-3 py-3 last:border-b-0">
      <div className="panel-label mb-1">{title}</div>
      {children}
    </section>
  );
}

/* ---------------- chart kind ---------------- */

const KIND_ORDER: ChartKind[] = ["bar", "barH", "line", "area", "ring", "heatmap", "sankey"];

function KindIcon({ kind }: { kind: ChartKind }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "bar":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
        </svg>
      );
    case "barH":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M4 5h10M4 11h16M4 17h7M4 2v20" />
        </svg>
      );
    case "line":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M3 17l5-6 4 3 6-8 3 4" />
        </svg>
      );
    case "area":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M3 17l5-6 4 3 6-8 3 4v10H3z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <circle cx="12" cy="12" r="8" strokeOpacity={0.3} />
          <path d="M12 4a8 8 0 0 1 8 8" strokeWidth={2.2} />
        </svg>
      );
    case "heatmap":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          {[0, 1, 2, 3].flatMap((x) =>
            [0, 1, 2].map((y) => (
              <rect key={`${x}${y}`} x={3 + x * 4.8} y={5 + y * 4.8} width="3.6" height="3.6" rx="0.8" fill="currentColor" fillOpacity={((x + y) % 4) * 0.25 + 0.15} stroke="none" />
            ))
          )}
        </svg>
      );
    case "sankey":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M3 6h4c4 0 5 4 9 4h5M3 18h4c4 0 5-4 9-4h5" />
        </svg>
      );
  }
}

export function KindPicker({ spec, onChange }: { spec: ChartSpec; onChange: (s: ChartSpec) => void }) {
  return (
    <div className="kind-grid">
      {KIND_ORDER.map((k) => (
        <button
          key={k}
          type="button"
          className="kind-btn"
          aria-pressed={spec.kind === k}
          onClick={() => {
            if (k === spec.kind) return;
            onChange({ ...spec, kind: k, data: adaptDataForKind(spec.data, spec.kind, k) });
          }}
        >
          <KindIcon kind={k} />
          {KIND_LABELS[k]}
        </button>
      ))}
    </div>
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

  return (
    <div className="flex flex-col">
      <Section title="Metin">
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

      <Section title="Kart">
        <Field label="Boyut (px)">
          <div className="flex items-center gap-1">
            <Num value={o.width} min={200} max={4000} step={10} onChange={(v) => set({ width: v ?? 960 })} width={68} />
            <span className="text-muted-foreground">×</span>
            <Num value={o.height} min={150} max={4000} step={10} onChange={(v) => set({ height: v ?? 540 })} width={68} />
          </div>
        </Field>
        <Field label="Hazır oranlar">
          <div className="flex flex-wrap justify-end gap-1">
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

      {spec.kind !== "heatmap" && spec.kind !== "sankey" && (
        <Section title="Gösterge (legend)">
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
        <Section title="Eksenler ve ızgara">
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
        <Section title={spec.kind === "area" ? "Alan" : "Çizgi"}>
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
            <Field label="Dolgu opaklığı">
              <Num value={o.areaOpacity} min={0.05} max={1} step={0.05} onChange={(v) => set({ areaOpacity: v ?? 0.25 })} />
            </Field>
          )}
        </Section>
      )}

      {bars && (
        <Section title="Çubuklar">
          <Field label="Yığılı">
            <Switch checked={o.stacked} onChange={(v) => set({ stacked: v })} />
          </Field>
          <Field label="Çubuk kalınlığı" hint="Boş = otomatik">
            <Num value={o.barWidth} min={2} max={200} allowEmpty onChange={(v) => set({ barWidth: v })} />
          </Field>
          <Field label="Grup aralığı" hint="0 = bitişik, 0.9 = çok seyrek">
            <Num value={o.barGap} min={0} max={0.9} step={0.05} onChange={(v) => set({ barGap: v ?? 0.35 })} />
          </Field>
        </Section>
      )}

      {spec.kind === "ring" && (
        <Section title="Halka">
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
        <Section title="Isı takvimi">
          <Field label="Hafta başı">
            <Seg value={String(o.heatmapWeekStart) as "0" | "1"} options={[["1", "Pazartesi"], ["0", "Pazar"]]} onChange={(v) => set({ heatmapWeekStart: v === "1" ? 1 : 0 })} />
          </Field>
          <Field label="Az / çok göstergesi">
            <Switch checked={o.heatmapLegend} onChange={(v) => set({ heatmapLegend: v })} />
          </Field>
        </Section>
      )}

      {spec.kind === "sankey" && (
        <Section title="Akış">
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

      <Section title="Sayı biçimi">
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
  onChange,
}: {
  spec: ChartSpec;
  theme: Theme;
  seriesNames: string[];
  onChange: (s: ChartSpec) => void;
}) {
  const palette = getPalette(spec.paletteId);
  const setColor = (i: number, hex: string | null) => {
    const colors = [...spec.colors];
    while (colors.length <= i) colors.push("");
    colors[i] = hex ?? "";
    while (colors.length && !colors[colors.length - 1]) colors.pop();
    onChange({ ...spec, colors });
  };

  return (
    <div className="flex flex-col">
      <Section title="Palet">
        <div className="flex flex-col gap-1.5">
          {PALETTES.map((p) => (
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
                {(theme === "dark" ? p.dark : p.light).map((c, i) => (
                  <span key={i} className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{palette.note}</p>
      </Section>

      <Section title="Seri renkleri">
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
  onPptx,
  onPptxAll,
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
  onPptx: () => void;
  onPptxAll: () => void;
  chartCount: number;
  message: string | null;
}) {
  return (
    <div className="flex flex-col">
      <Section title="PNG">
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
          <button className="btn btn-primary" disabled={busy} onClick={onDownload}>
            {busy ? "Hazırlanıyor…" : "PNG indir"}
          </button>
          <button className="btn" disabled={busy} onClick={onCopy}>
            Panoya kopyala
          </button>
          <button className="btn" disabled={busy} onClick={onSvg}>
            SVG indir
          </button>
        </div>
        {message && <p className="mt-2 text-[11px] text-muted-foreground">{message}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Panoya kopyalanan görüntü PowerPoint'e doğrudan Ctrl+V ile yapıştırılır. Şeffaf arka plan koyu slayt
          şablonlarında işe yarar; tema arka planı kartın rengini korur.
        </p>
      </Section>
      <Section title="PowerPoint">
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-primary" disabled={busy} onClick={onPptx}>
            Slayt olarak indir (.pptx)
          </button>
          <button className="btn" disabled={busy || chartCount < 2} onClick={onPptxAll} title="Çalışma alanındaki her grafik bir slayt olur">
            Tüm grafikler ({chartCount} slayt)
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          16:9 geniş ekran sunu; grafik yukarıdaki çözünürlükte PNG olarak slayta ortalanır, slayt arka planı kartın
          rengini alır. İndirilen dosyayı açıp slaytları kendi sununuza sürükleyebilirsiniz.
        </p>
      </Section>
    </div>
  );
}
