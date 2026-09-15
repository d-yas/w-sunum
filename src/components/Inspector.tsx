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
import { KindPicker, OptionsPanel, SectionScope } from "@/components/Panels";
import { getAsset } from "@/decor/registry";
import type { Palette } from "@/lib/palettes";
import { gorunenBolumler, sahneSecimi, sahnedenSecim, secimAdi, type Secim } from "@/lib/selection";
import type { ChartSpec, Theme } from "@/lib/spec";

export function Inspector({
  secim,
  spec,
  theme,
  palettes,
  onSecim,
  onChange,
}: {
  secim: Secim;
  spec: ChartSpec;
  theme: Theme;
  palettes: Palette[];
  onSecim: (s: Secim) => void;
  onChange: (s: ChartSpec) => void;
}) {
  const bolumler = gorunenBolumler(secim);
  const nesne = secim.tur === "nesne" ? spec.decor.nesneler.find((n) => n.id === secim.id) : null;
  const ad = secimAdi(secim, nesne ? (getAsset(nesne.asset)?.label ?? "Süsleme") : undefined);

  return (
    <>
      <div className="inspector-head shrink-0" data-secim={secim.tur === "parca" ? secim.part : secim.tur}>
        <span className="panel-label">Seçili</span>
        <span className="inspector-name">{ad}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionScope show={bolumler}>
          {secim.tur === "parca" && secim.part === "chart" && <KindPicker spec={spec} onChange={onChange} />}
          <OptionsPanel spec={spec} onChange={onChange} />
          <DecorPanel
            spec={spec}
            theme={theme}
            palettes={palettes}
            selectedId={sahneSecimi(secim)}
            onSelect={(id) => onSecim(sahnedenSecim(id))}
            onChange={onChange}
          />
        </SectionScope>
      </div>
    </>
  );
}
