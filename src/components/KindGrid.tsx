/**
 * Tür ızgarası — 23 grafik türü, `KIND_GROUPS` başlıkları altında.
 *
 * İki yerde birden kullanılıyor: sağ panelin "Tür" bölümünde mevcut türü
 * değiştirmek için, şeridin sonundaki "+ Yeni grafik" kutusunda yeni grafik
 * eklemek için. Aynı ızgara olması kasıtlı — kullanıcı türleri tek bir yerde
 * öğreniyor.
 *
 * Bir düğmenin üstünde durmak o türün **örnek çizimini** gösteriyor: 23 ikon
 * "hangisi neye benziyor" sorusunu cevaplamıyordu, resim cevaplıyor. Resimler
 * dışarıdan geliyor (bkz. `useKindPreviews`), çünkü onları üreten dışa aktarım
 * hattı uygulamanın tepesinde duruyor ve kutu her açıldığında yeniden
 * üretilmeleri gerekmiyor.
 *
 * Örnek çizim ızgaranın **içinde**, sabit bir bölmede duruyor. İlk sürümde
 * ızgaranın yanına, sahnenin üstüne yüzen bir kutu olarak çiziliyordu ve orada
 * kartın üstünde asılı kalmış ikinci bir slayt gibi görünüyordu. Bölme hep
 * yerinde: hiçbir türün üstünde değilken seçili türü (ya da ilk türü) gösterip
 * yüksekliğini koruyor, böylece kutu imleç gezdikçe zıplamıyor.
 */
import { useEffect, useState } from "react";

import { KIND_ICONS } from "@/lib/chart-icons";
import { KIND_GROUPS, KIND_LABELS, dataShape, type ChartKind } from "@/lib/spec";

/** Izgaradaki ilk tür — hiçbir şeyin üstünde değilken bölmeyi dolduran. */
const ILK = KIND_GROUPS[0].kinds[0];

export function KindGrid({
  current,
  onPick,
  keepsDataOf,
  wide = false,
  previews,
  onHover,
}: {
  /** Basılı görünecek tür; yeni grafik eklerken yok. */
  current?: ChartKind;
  onPick: (kind: ChartKind) => void;
  /** Bu türle aynı tabloyu kullanan türler "veri korunur" ipucu alır. */
  keepsDataOf?: ChartKind;
  /** Grupları iki sütuna akıtır — geniş açılır kutuda 23 tür kaydırmasız sığsın diye. */
  wide?: boolean;
  /** Tür → örnek resim (object URL). Eksik olan tür ikonuyla bekler. */
  previews?: Partial<Record<ChartKind, string>>;
  /** Üstünde durulan tür; üreticiye "önce bunu hazırla" demek için. */
  onHover?: (kind: ChartKind | null) => void;
}) {
  const [vurgu, setVurgu] = useState<ChartKind | null>(null);

  // Izgaranın açılması üreticiye "artık lazım" demek. Resimler uygulamanın
  // açılışında değil, tür seçici ilk kez göründüğünde hazırlanıyor.
  useEffect(() => {
    onHover?.(null);
    // Yalnız ilk çizimde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uzerinde = (kind: ChartKind) => {
    setVurgu(kind);
    onHover?.(kind);
  };

  const birak = () => {
    setVurgu(null);
    onHover?.(null);
  };

  const gosterilen = vurgu ?? current ?? ILK;
  const Icon = KIND_ICONS[gosterilen];
  const resim = previews?.[gosterilen];

  return (
    <div className="kind-picker" onPointerLeave={birak}>
      <div className="kind-preview" data-wide={wide ? "" : undefined}>
        <div className="kind-preview-kart">
          {resim ? (
            <img src={resim} alt="" />
          ) : (
            <div className="kind-preview-bos">
              <Icon size={24} strokeWidth={1.4} aria-hidden />
              <span>Örnek hazırlanıyor…</span>
            </div>
          )}
        </div>
        <span className="kind-preview-ad">{KIND_LABELS[gosterilen]}</span>
      </div>

      <div className={wide ? "kind-groups" : "flex flex-col gap-2.5"}>
        {KIND_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="panel-label mb-1">{group.title}</div>
            <div className="kind-grid">
              {group.kinds.map((k) => {
                const GIcon = KIND_ICONS[k];
                const keeps = keepsDataOf != null && dataShape(k) === dataShape(keepsDataOf);
                return (
                  <button
                    key={k}
                    type="button"
                    className="kind-btn"
                    data-kind={k}
                    aria-pressed={current === k}
                    title={keeps && k !== keepsDataOf ? `${KIND_LABELS[k]} — aynı tabloyu kullanır, veri korunur` : KIND_LABELS[k]}
                    onPointerEnter={() => uzerinde(k)}
                    onFocus={() => uzerinde(k)}
                    onBlur={birak}
                    onClick={() => onPick(k)}
                  >
                    <GIcon size={20} strokeWidth={1.6} aria-hidden />
                    {KIND_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
