/**
 * Tür ızgarası — 23 grafik türü, `KIND_GROUPS` başlıkları altında.
 *
 * İki yerde birden kullanılıyor: sağ panelin "Tür" bölümünde mevcut türü
 * değiştirmek için, sol paneldeki "+ Yeni grafik" açılır kutusunda yeni grafik
 * eklemek için. Aynı ızgara olması kasıtlı — kullanıcı türleri tek bir yerde
 * öğreniyor.
 */
import { KIND_ICONS } from "@/lib/chart-icons";
import { KIND_GROUPS, KIND_LABELS, dataShape, type ChartKind } from "@/lib/spec";

export function KindGrid({
  current,
  onPick,
  keepsDataOf,
}: {
  /** Basılı görünecek tür; yeni grafik eklerken yok. */
  current?: ChartKind;
  onPick: (kind: ChartKind) => void;
  /** Bu türle aynı tabloyu kullanan türler "veri korunur" ipucu alır. */
  keepsDataOf?: ChartKind;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {KIND_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="panel-label mb-1">{group.title}</div>
          <div className="kind-grid">
            {group.kinds.map((k) => {
              const Icon = KIND_ICONS[k];
              const keeps = keepsDataOf != null && dataShape(k) === dataShape(keepsDataOf);
              return (
                <button
                  key={k}
                  type="button"
                  className="kind-btn"
                  data-kind={k}
                  aria-pressed={current === k}
                  title={keeps && k !== keepsDataOf ? `${KIND_LABELS[k]} — aynı tabloyu kullanır, veri korunur` : KIND_LABELS[k]}
                  onClick={() => onPick(k)}
                >
                  <Icon size={20} strokeWidth={1.6} aria-hidden />
                  {KIND_LABELS[k]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
