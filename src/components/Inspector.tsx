/**
 * Sağ panel: her zaman "şu an ne seçili" ise onun özellikleri.
 *
 * Sekme yok. Eskiden dört sabit sekme vardı ve bir ayarın hangisinde olduğunu
 * hatırlamak gerekiyordu; şimdi karttaki parçaya tıklamak onun ayarlarını
 * getiriyor, hiçbir şey seçili değilken de slaytın kendi ayarları duruyor.
 *
 * Paneller yeniden yazılmadı: `OptionsPanel` ve `DecorPanel` olduğu gibi
 * çiziliyor, hangi bölümlerinin görüneceğini `SectionScope` söylüyor.
 */
import { DecorPanel } from "@/components/DecorPanel";
import { BicemPanel, KindPicker, OptionsPanel, SectionScope } from "@/components/Panels";
import { SiraPaneli } from "@/components/SiraPaneli";
import type { UzerindeOge } from "@/components/SiraSahnesi";
import { nesneAdi } from "@/decor/katmanlar";
import type { Bicem } from "@/lib/bicem";
import type { Palette } from "@/lib/palettes";
import { gorunenBolumler, sahneSecimi, sahnedenSecim, secimAdi, type Secim } from "@/lib/selection";
import { gorunenSira } from "@/lib/sira";
import type { ChartKind, ChartSpec, Theme } from "@/lib/spec";

export function Inspector({
  secim,
  spec,
  theme,
  palettes,
  previews,
  onPreviewHover,
  onSecim,
  onChange,
  onSira,
  onUzerinde,
  bicem,
}: {
  secim: Secim;
  spec: ChartSpec;
  theme: Theme;
  palettes: Palette[];
  previews?: Partial<Record<ChartKind, string>>;
  onPreviewHover?: (kind: ChartKind | null) => void;
  onSecim: (s: Secim) => void;
  onChange: (s: ChartSpec) => void;
  /** Sıra eylemleri: her biri ayrı bir geri al adımı (bkz. `App` `siraBirak`). */
  onSira: (fn: (s: ChartSpec) => ChartSpec) => void;
  /** Sıra listesinde üstüne gelinen öğe — sahnede çerçevelenir. */
  onUzerinde: (u: UzerindeOge | null) => void;
  bicem: {
    pano: Bicem | null;
    kartSayisi: number;
    onKopyala: () => void;
    onYapistir: () => void;
    onHepsine: () => void;
  };
}) {
  const bolumler = gorunenBolumler(secim);
  const nesne = secim.tur === "nesne" && secim.ids.length === 1 ? spec.decor.nesneler.find((n) => n.id === secim.ids[0]) : null;
  // Öğe seçiliyken başlıkta anahtar değil görünen ad (`ad#2` → `ad`).
  const ogeAdi =
    secim.tur === "oge" && secim.anahtarlar.length === 1
      ? gorunenSira(spec, secim.boyut).find((x) => x.anahtar === secim.anahtarlar[0])?.ad
      : undefined;
  const ad = secimAdi(secim, nesne ? nesneAdi(nesne) : ogeAdi);

  return (
    <>
      <div className="inspector-head shrink-0" data-secim={secim.tur === "parca" ? secim.part : secim.tur}>
        <span className="panel-label">Seçili</span>
        <span className="inspector-name">{ad}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionScope show={bolumler}>
          <BicemPanel {...bicem} />
          {secim.tur === "parca" && secim.part === "chart" && (
            <KindPicker spec={spec} previews={previews} onPreviewHover={onPreviewHover} onChange={onChange} />
          )}
          <SiraPaneli spec={spec} theme={theme} palettes={palettes} secim={secim} onSecim={onSecim} onChange={onChange} onSira={onSira} onUzerinde={onUzerinde} />
          <OptionsPanel spec={spec} theme={theme} onChange={onChange} />
          <DecorPanel
            spec={spec}
            theme={theme}
            palettes={palettes}
            selectedIds={sahneSecimi(secim)}
            onSelect={(ids) => onSecim(sahnedenSecim(ids))}
            onChange={onChange}
          />
        </SectionScope>
      </div>
    </>
  );
}
