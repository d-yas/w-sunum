/**
 * Sağ panel: "Sıra" ve "Öğe" bölümleri.
 *
 * Sahnedeki sürüklemenin listedeki karşılığı — aynı modele yazar, aynı geri al
 * adımını üretir. Liste görünen sırayı gösterir (tablonun sırasını değil):
 * "Büyükten küçüğe"deyken listede de en büyük üstte durur, ve bir satırı
 * sürüklemek o görüntüyü dondurup "Elle"ye geçirir.
 *
 * Satıra tıklamak sahnede o öğeyi seçer, satırın üstüne gelmek sahnede
 * çerçeveler; sahnede seçilen öğe de listede seçili görünür. Liste odaktayken
 * `↑`/`↓` gezer, `Alt+↑`/`Alt+↓` taşır (`Shift` ile uca).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Hand,
  Highlighter,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { ColorWell, Field, Section } from "@/components/Panels";
import type { UzerindeOge } from "@/components/SiraSahnesi";
import { sankeySutunlari } from "@/ext/sankey-fit";
import { toSankey } from "@/lib/adapters";
import { formatNumber } from "@/lib/format";
import { getPalette, seriesColor, type Palette } from "@/lib/palettes";
import { olculenSira } from "@/lib/sahne-olcu";
import { GRAFIK, type Secim } from "@/lib/selection";
import {
  MOD_ADLARI,
  bosluktanHedef,
  renkBoyutu,
  seriSifirla,
  siraBoyutlari,
  siraModu,
  tersCevir,
  type SiraBoyutBilgisi,
  type SiraBoyutu,
  type SiraOgesi,
} from "@/lib/sira";
import { adimla, ogeyiTasi, vurguDestekli, type OgeSecimi } from "@/lib/sira-eylem";
import type { ChartSpec, SortOrder, Theme } from "@/lib/spec";
import { useDragOrder } from "@/lib/use-drag-order";

const MOD_IKON: Record<SortOrder, typeof Sparkles> = {
  none: Sparkles,
  desc: ArrowDownWideNarrow,
  asc: ArrowUpNarrowWide,
  alpha: ArrowDownAZ,
  manual: Hand,
};

interface Props {
  spec: ChartSpec;
  theme: Theme;
  palettes: Palette[];
  secim: Secim;
  onSecim: (s: Secim) => void;
  /** Renk ve vurgu gibi sıradan değişiklikler. */
  onChange: (s: ChartSpec) => void;
  /** Sıra eylemleri — her biri ayrı geri al adımı, güncel durumdan hesaplanır. */
  onSira: (fn: (s: ChartSpec) => ChartSpec) => void;
  onUzerinde: (u: UzerindeOge | null) => void;
}

export function SiraPaneli({ spec, theme, palettes, secim, onSecim, onChange, onSira, onUzerinde }: Props) {
  // Sankey "Otomatik"te sıra d3'ün yerleşiminden geliyor; liste onu sahneden okur.
  const [olculen, setOlculen] = useState<string[] | undefined>();
  useEffect(() => {
    if (spec.kind !== "sankey" || spec.options.sort !== "none") {
      setOlculen(undefined);
      return;
    }
    const oku = () => setOlculen(olculenSira(spec));
    const kare = requestAnimationFrame(oku);
    const z = window.setTimeout(oku, 400);
    return () => {
      cancelAnimationFrame(kare);
      window.clearTimeout(z);
    };
  }, [spec]);

  const boyutlar = useMemo(() => siraBoyutlari(spec, olculen), [spec, olculen]);
  const palette = getPalette(spec.paletteId, palettes);
  const rb = renkBoyutu(spec);
  /** Öğenin rengi — yalnız rengi taşıyan boyutta; kimlik sırasından, öğeyle gider. */
  const renkOf = (boyut: SiraBoyutu, o: SiraOgesi) => (boyut === rb ? seriesColor(o.kimlik, spec.colors, palette, theme) : null);
  const fmt = (v: number | null) => (v == null ? "" : formatNumber(v, spec.options.format));

  const secOge = (b: SiraBoyutu, anahtar: string, grup: string | undefined, mod: "tek" | "ekle" | "aralik", liste: string[]) => {
    if (mod === "tek" || secim.tur !== "oge" || secim.boyut !== b || secim.grup !== grup) {
      onSecim({ tur: "oge", boyut: b, anahtarlar: [anahtar], grup });
      return;
    }
    if (mod === "ekle") {
      const var_ = secim.anahtarlar.includes(anahtar);
      const yeni = var_ ? secim.anahtarlar.filter((k) => k !== anahtar) : [...secim.anahtarlar, anahtar];
      onSecim(yeni.length > 0 ? { ...secim, anahtarlar: yeni } : GRAFIK);
      return;
    }
    const a = liste.indexOf(secim.anahtarlar[0]);
    const z = liste.indexOf(anahtar);
    onSecim({ ...secim, anahtarlar: liste.slice(Math.min(a, z), Math.max(a, z) + 1) });
  };

  const tasi = (s: OgeSecimi, hedef: number) => onSira((c) => ogeyiTasi(c, s, hedef, olculen));

  return (
    <>
      {secim.tur === "oge" && (
        <OgeBolumu spec={spec} secim={secim} boyutlar={boyutlar} olculen={olculen} renkOf={renkOf} fmt={fmt} palette={palette} theme={theme} onChange={onChange} onSira={onSira} />
      )}
      <Section id="sira" title="Sıra">
        {boyutlar.length === 0 && (
          <p className="sira-not">{spec.kind === "heatmap" ? "Isı takviminde sıra takvimden gelir." : "Haritada konum coğrafyadan gelir; sıralanacak öğe yok."}</p>
        )}
        {boyutlar.map((b) => (
          <BoyutPaneli
            key={b.boyut}
            spec={spec}
            bilgi={b}
            secim={secim}
            olculen={olculen}
            renkOf={renkOf}
            fmt={fmt}
            onChange={onChange}
            onSira={onSira}
            onSec={secOge}
            onTasi={tasi}
            onUzerinde={onUzerinde}
          />
        ))}
        {boyutlar.length > 0 && (
          <p className="sira-ipucu">
            Sahnede grafiği seçip öğeye tıklayın, sürükleyin. <kbd>←</kbd> <kbd>→</kbd> taşır, <kbd>Tab</kbd> sonrakine geçer, <kbd>Esc</kbd> üste çıkar.
          </p>
        )}
      </Section>
    </>
  );
}

/* ---------------- bir boyut: mod, ters çevir, liste ---------------- */

interface BoyutProps {
  spec: ChartSpec;
  bilgi: SiraBoyutBilgisi;
  secim: Secim;
  olculen?: string[];
  renkOf: (b: SiraBoyutu, o: SiraOgesi) => string | null;
  fmt: (v: number | null) => string;
  onChange: (s: ChartSpec) => void;
  onSira: (fn: (s: ChartSpec) => ChartSpec) => void;
  onSec: (b: SiraBoyutu, anahtar: string, grup: string | undefined, mod: "tek" | "ekle" | "aralik", liste: string[]) => void;
  onTasi: (s: OgeSecimi, hedef: number) => void;
  onUzerinde: (u: UzerindeOge | null) => void;
}

function BoyutPaneli({ spec, bilgi, secim, olculen, renkOf, fmt, onChange, onSira, onSec, onTasi, onUzerinde }: BoyutProps) {
  const o = spec.options;
  const b = bilgi.boyut;

  /** Liste parçaları: yapraklar grup grup, sankey düğümleri sütun sütun, diğerleri tek parça. */
  const parcalar = useMemo((): { baslik: string | null; grup?: string; ogeler: SiraOgesi[] }[] => {
    if (b === "alt") {
      const gruplar: string[] = [];
      for (const y of bilgi.ogeler) if (!gruplar.includes(y.grup!)) gruplar.push(y.grup!);
      return gruplar.map((g) => ({ baslik: g, grup: g, ogeler: bilgi.ogeler.filter((y) => y.grup === g) }));
    }
    if (spec.kind === "sankey" && b === "oge") {
      const sutun = sankeySutunlari(toSankey(spec).data);
      const sutunlar = [...new Set(bilgi.ogeler.map((d) => sutun.get(d.anahtar) ?? 0))].sort((x, y) => x - y);
      return sutunlar.map((s) => ({ baslik: `${s + 1}. sütun`, ogeler: bilgi.ogeler.filter((d) => (sutun.get(d.anahtar) ?? 0) === s) }));
    }
    return [{ baslik: null, ogeler: bilgi.ogeler }];
  }, [b, bilgi.ogeler, spec]);

  const secili = secim.tur === "oge" && secim.boyut === b ? secim.anahtarlar : [];
  const vurgu = b === "oge" && vurguDestekli(spec) ? o.highlight : null;

  return (
    <div className="sira-boyut" data-boyut={b}>
      <div className="sira-baslik">
        <span className="sira-baslik-ad">{bilgi.baslik}</span>
        {bilgi.modlar.length > 0 && !bilgi.kapali && (
          <div className="seg sira-mod" role="radiogroup" aria-label="Sıralama">
            {bilgi.modlar.map((m) => {
              const I = MOD_IKON[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={o.sort === m}
                  aria-pressed={o.sort === m}
                  data-mod={m}
                  title={MOD_ADLARI[m]}
                  onClick={() => onSira((c) => siraModu(c, m, olculen))}
                >
                  <I size={13} />
                </button>
              );
            })}
          </div>
        )}
        {!bilgi.kapali && (
          <button
            type="button"
            className="icon-btn"
            data-act="ters"
            title="Ters çevir"
            onClick={() => {
              const grup = secim.tur === "oge" && secim.boyut === "alt" ? secim.grup : parcalar[0]?.grup;
              onSira((c) => tersCevir(c, b, { olculen, grup }));
            }}
          >
            <ArrowUpDown size={13} />
          </button>
        )}
        {b === "seri" && o.sira.seri.length > 0 && (
          <button type="button" className="icon-btn" data-act="tablo-sirasi" title="Tablodaki sütun sırasına dön" onClick={() => onSira(seriSifirla)}>
            <RotateCcw size={13} />
          </button>
        )}
      </div>
      {bilgi.modlar.length > 0 && !bilgi.kapali && <div className="sira-mod-ad">{MOD_ADLARI[o.sort]}</div>}
      {bilgi.not && <p className="sira-not">{bilgi.not}</p>}
      {!bilgi.kapali &&
        parcalar.map((p) => (
          <div key={p.baslik ?? "_"}>
            {p.baslik && <div className="sira-parca">{p.baslik}</div>}
            <SiraListesi
              boyut={b}
              grup={p.grup}
              ogeler={p.ogeler}
              secili={secim.tur === "oge" && secim.boyut === b && secim.grup === p.grup ? secili : []}
              vurgu={vurgu}
              renkOf={renkOf}
              fmt={fmt}
              onSec={(k, mod) => onSec(b, k, p.grup, mod, p.ogeler.map((x) => x.anahtar))}
              onTasi={(anahtarlar, hedef) => onTasi({ boyut: b, anahtarlar, grup: p.grup }, hedef)}
              onAdim={(anahtarlar, yon, uca) => onSira((c) => adimla(c, { boyut: b, anahtarlar, grup: p.grup }, yon, uca, olculen))}
              onVurgu={(k) =>
                onChange({
                  ...spec,
                  options: { ...o, highlight: o.highlight.includes(k) ? o.highlight.filter((x) => x !== k) : [...o.highlight, k] },
                })
              }
              onUzerinde={(k) => onUzerinde(k == null ? null : { boyut: b, anahtar: k, grup: p.grup })}
            />
          </div>
        ))}
    </div>
  );
}

/* ---------------- liste ---------------- */

interface ListeProps {
  boyut: SiraBoyutu;
  grup?: string;
  ogeler: SiraOgesi[];
  secili: string[];
  vurgu: string[] | null;
  renkOf: (b: SiraBoyutu, o: SiraOgesi) => string | null;
  fmt: (v: number | null) => string;
  onSec: (anahtar: string, mod: "tek" | "ekle" | "aralik") => void;
  onTasi: (anahtarlar: string[], hedef: number) => void;
  onAdim: (anahtarlar: string[], yon: -1 | 1, uca: boolean) => void;
  onVurgu: (anahtar: string) => void;
  onUzerinde: (anahtar: string | null) => void;
}

function SiraListesi({ boyut, ogeler, secili, vurgu, renkOf, fmt, onSec, onTasi, onAdim, onVurgu, onUzerinde }: ListeProps) {
  const liste = ogeler.map((x) => x.anahtar);
  const drag = useDragOrder(ogeler.length, (from, to) => {
    const k = liste[from];
    // Seçili bir bloğun parçası sürüklendiyse blok birlikte gider.
    const blok = secili.includes(k) && secili.length > 1 ? liste.filter((x) => secili.includes(x)) : [k];
    if (blok.length === 1) return onTasi(blok, to);
    const bosluk = to >= from ? to + 1 : to;
    onTasi(blok, bosluktanHedef(liste, blok, bosluk));
  });
  const kutuRef = useRef<HTMLDivElement | null>(null);

  // Sahnede seçilen öğe listede görünür alana gelsin.
  useEffect(() => {
    if (secili.length === 0 || drag.dragging != null) return;
    kutuRef.current?.querySelector<HTMLElement>(`[data-anahtar="${CSS.escape(secili[0])}"]`)?.scrollIntoView({ block: "nearest" });
  }, [secili, drag.dragging]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const yon: -1 | 1 = e.key === "ArrowUp" || e.key === "Home" ? -1 : 1;
    if (e.altKey && secili.length > 0) {
      onAdim(secili, yon, e.shiftKey || e.key === "Home" || e.key === "End");
      return;
    }
    const simdi = secili.length > 0 ? liste.indexOf(secili[0]) : -1;
    const i = e.key === "Home" ? 0 : e.key === "End" ? liste.length - 1 : Math.max(0, Math.min(liste.length - 1, simdi + yon));
    if (liste[i]) onSec(liste[i], "tek");
  };

  return (
    <div
      ref={(el) => {
        kutuRef.current = el;
        drag.listRef.current = el;
      }}
      className="sira-liste"
      role="listbox"
      aria-multiselectable
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseLeave={() => onUzerinde(null)}
    >
      {ogeler.map((x, i) => {
        const p = drag.rowProps(i) as { style?: React.CSSProperties } & Record<string, unknown>;
        const renk = renkOf(boyut, x);
        const vurgulu = vurgu?.includes(x.anahtar) ?? false;
        return (
          <div
            key={x.anahtar}
            {...p}
            className="sira-satir"
            role="option"
            aria-selected={secili.includes(x.anahtar)}
            data-anahtar={x.anahtar}
            title={x.ad}
            onClick={(e) => onSec(x.anahtar, e.shiftKey ? "aralik" : e.ctrlKey || e.metaKey ? "ekle" : "tek")}
            onMouseEnter={() => onUzerinde(x.anahtar)}
          >
            <GripVertical size={12} className="sira-tutamak" aria-hidden />
            {renk ? <span className="sira-renk" style={{ background: renk }} /> : <span className="sira-sira">{i + 1}</span>}
            <span className="sira-ad">{x.ad}</span>
            {x.deger != null && boyut !== "seri" && <span className="sira-deger">{fmt(x.deger)}</span>}
            {vurgu && (
              <button
                type="button"
                className="icon-btn sira-vurgu"
                data-acik={vurgulu ? "" : undefined}
                aria-pressed={vurgulu}
                title={vurgulu ? "Vurguyu kaldır" : "Vurgula (sahnede Alt+tık)"}
                onClick={(e) => {
                  e.stopPropagation();
                  onVurgu(x.anahtar);
                }}
              >
                <Highlighter size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- seçili öğe ---------------- */

function OgeBolumu({
  spec,
  secim,
  boyutlar,
  olculen,
  renkOf,
  fmt,
  palette,
  theme,
  onChange,
  onSira,
}: {
  spec: ChartSpec;
  secim: Extract<Secim, { tur: "oge" }>;
  boyutlar: SiraBoyutBilgisi[];
  olculen?: string[];
  renkOf: (b: SiraBoyutu, o: SiraOgesi) => string | null;
  fmt: (v: number | null) => string;
  palette: Palette;
  theme: Theme;
  onChange: (s: ChartSpec) => void;
  onSira: (fn: (s: ChartSpec) => ChartSpec) => void;
}) {
  const bilgi = boyutlar.find((b) => b.boyut === secim.boyut);
  const kardes = (bilgi?.ogeler ?? []).filter((x) => secim.boyut !== "alt" || x.grup === secim.grup);
  const tek = secim.anahtarlar.length === 1 ? kardes.find((x) => x.anahtar === secim.anahtarlar[0]) : undefined;
  const yer = tek ? kardes.indexOf(tek) + 1 : 0;
  const s: OgeSecimi = { boyut: secim.boyut, anahtarlar: secim.anahtarlar, grup: secim.grup };
  const adim = (yon: -1 | 1, uca: boolean) => onSira((c) => adimla(c, s, yon, uca, olculen));
  const kapali = !bilgi || bilgi.kapali;
  const renk = tek ? renkOf(secim.boyut, tek) : null;

  return (
    <Section id="oge" title={secim.anahtarlar.length > 1 ? `${secim.anahtarlar.length} öğe` : "Öğe"} collapsible={false}>
      {tek && (
        <>
          <Field label="Ad" hint="Adı veri tablosundan değiştirin">
            <span className="sira-oge-ad">{tek.ad}</span>
          </Field>
          {tek.deger != null && secim.boyut !== "seri" && (
            <Field label="Değer">
              <span className="sira-oge-deger">{fmt(tek.deger)}</span>
            </Field>
          )}
          {renk && (
            <Field label="Renk" hint="Öğeyle birlikte gider; yeri değişse de rengi aynı kalır">
              <ColorWell
                value={spec.colors[tek.kimlik] ?? ""}
                fallback={seriesColor(tek.kimlik, [], palette, theme)}
                onChange={(v) => {
                  const colors = [...spec.colors];
                  while (colors.length <= tek.kimlik) colors.push("");
                  colors[tek.kimlik] = v;
                  onChange({ ...spec, colors });
                }}
              />
            </Field>
          )}
        </>
      )}
      {!kapali && (
        <Field label="Sıra" hint="← → bir adım, Shift ile uca">
          <div className="flex items-center gap-1">
            {tek && <span className="sira-oge-yer">{`${yer} / ${kardes.length}`}</span>}
            <button type="button" className="icon-btn" data-act="basa" title="Başa taşı (Shift+←)" onClick={() => adim(-1, true)}>
              <ChevronsLeft size={14} />
            </button>
            <button type="button" className="icon-btn" data-act="geri" title="Bir öne (←)" onClick={() => adim(-1, false)}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" className="icon-btn" data-act="ileri" title="Bir arkaya (→)" onClick={() => adim(1, false)}>
              <ChevronRight size={14} />
            </button>
            <button type="button" className="icon-btn" data-act="sona" title="Sona taşı (Shift+→)" onClick={() => adim(1, true)}>
              <ChevronsRight size={14} />
            </button>
          </div>
        </Field>
      )}
      {secim.boyut === "oge" && vurguDestekli(spec) && (
        <Field label="Vurgu" hint="Vurgulananlar tam opak, gerisi soluk">
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={secim.anahtarlar.every((k) => spec.options.highlight.includes(k))}
            onClick={() => {
              const h = spec.options.highlight;
              const hepsi = secim.anahtarlar.every((k) => h.includes(k));
              onChange({
                ...spec,
                options: { ...spec.options, highlight: hepsi ? h.filter((x) => !secim.anahtarlar.includes(x)) : [...new Set([...h, ...secim.anahtarlar])] },
              });
            }}
          >
            {secim.anahtarlar.every((k) => spec.options.highlight.includes(k)) ? "Vurgulu ✓" : "Vurgula"}
          </button>
        </Field>
      )}
    </Section>
  );
}
