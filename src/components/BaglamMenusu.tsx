/**
 * Sağ tık menüsü — katman listesi ve sahnedeki grafik öğeleri ortak kullanır.
 *
 * İmlecin altında açılır ama pencereden taşmaz; dışarı basmak, `Esc` ya da
 * pencereyi yeniden boyutlandırmak kapatır. `Esc` yakalama evresinde dinlenip
 * `preventDefault` ediliyor: uygulamanın kendi `Esc`'i (seçimi bir üste
 * taşımak) menüyü kapatan tuşla birlikte çalışmasın.
 */
import { useEffect, useRef, useState } from "react";

import type { LucideIcon } from "lucide-react";

export interface MenuEylem {
  ad: string;
  kisayol?: string;
  ikon?: LucideIcon;
  tehlike?: boolean;
  /** Önüne ince bir ayraç çizilir — menüdeki grupları ayırmak için. */
  ayracOnce?: boolean;
  devreDisi?: boolean;
  calistir: () => void;
}

export function BaglamMenusu({ x, y, eylemler, onKapat }: { x: number; y: number; eylemler: MenuEylem[]; onKapat: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [yer, setYer] = useState({ x, y });

  // Menü imlecin altında açılır ama pencereden taşmaz; ölçüyü çizildikten
  // sonra alıyoruz çünkü yüksekliği eylem sayısına göre değişiyor.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setYer({
      x: Math.min(x, window.innerWidth - r.width - 8),
      y: Math.min(y, window.innerHeight - r.height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const kapat = () => onKapat();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onKapat();
    };
    // `capture`: menünün kendi tıklaması önce eylemi çalıştırsın diye eylem
    // düğmeleri olayı durduruyor.
    window.addEventListener("pointerdown", kapat);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("resize", kapat);
    return () => {
      window.removeEventListener("pointerdown", kapat);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("resize", kapat);
    };
  }, [onKapat]);

  return (
    <div ref={ref} className="katman-menu" style={{ left: yer.x, top: yer.y }} onPointerDown={(e) => e.stopPropagation()} role="menu">
      {eylemler.map((a, i) => (
        <div key={`${a.ad}${i}`} style={{ display: "contents" }}>
          {a.ayracOnce && i > 0 && <div className="katman-menu-ayrac" role="separator" />}
          <button
            type="button"
            role="menuitem"
            disabled={a.devreDisi}
            className={a.tehlike ? "katman-menu-oge danger" : "katman-menu-oge"}
            onClick={() => {
              a.calistir();
              onKapat();
            }}
          >
            {a.ikon ? <a.ikon size={12} /> : <span style={{ width: 12 }} />}
            <span className="grow">{a.ad}</span>
            {a.kisayol && <kbd>{a.kisayol}</kbd>}
          </button>
        </div>
      ))}
    </div>
  );
}
