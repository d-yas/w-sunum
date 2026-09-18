/**
 * Sahnenin üstünde yüzen araç çubuğu.
 *
 * Buraya taşınan üç şey eskiden sağ panelin sekmeleriydi: galeri ("Süsle"),
 * palet ("Renkler") ve dışa aktarım. Sağ panel böylece yalnız seçili öğenin
 * özelliklerine ayrıldı — sekme değiştirmeden bir şey eklemek, rengi
 * değiştirmek ya da dışa aktarmak mümkün.
 *
 * Serbest yerleşim de burada: bir mod, bir panel bölümü değil. Eskiden
 * "Süsle" sekmesinin içindeydi ve orada olduğu bilinmiyordu.
 *
 * Açılır kutular aşağı açılıyor — çubuk sahnenin üst kenarında duruyor.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Hand, LayoutTemplate, MousePointer2, Palette, Plus, Spline, Type } from "lucide-react";

/**
 * Etkin araç. `metin` ve `cizgi` birer *jest*: sahneye basınca nesne doğurur
 * ve kendiliğinden `sec`'e döner — kalıcı bir kip değil.
 */
export type Arac = "sec" | "el" | "metin" | "cizgi";

/** Açılır kutusu olan düğmeler. */
type Kutu = "ekle" | "renk" | "disa";

export function Toolbar({
  arac,
  onArac,
  serbest,
  onSerbest,
  ekle,
  renk,
  disa,
}: {
  arac: Arac;
  onArac: (a: Arac) => void;
  serbest: boolean;
  onSerbest: (on: boolean) => void;
  ekle: ReactNode;
  renk: ReactNode;
  disa: ReactNode;
}) {
  const [acik, setAcik] = useState<Kutu | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAcik(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [acik]);

  const kutuDugme = (k: Kutu, etiket: string, ikon: ReactNode, icerik: ReactNode, genislik: number) => (
    <div className="relative">
      <button
        type="button"
        className="tool"
        data-tool={k}
        aria-expanded={acik === k}
        aria-pressed={acik === k}
        title={etiket}
        onClick={() => setAcik((v) => (v === k ? null : k))}
      >
        {ikon}
      </button>
      {acik === k && (
        <div className="tool-pop" data-pop={k} style={{ width: genislik }}>
          {icerik}
        </div>
      )}
    </div>
  );

  return (
    <div className="toolbar" ref={ref} role="toolbar" aria-label="Araçlar">
      <button type="button" className="tool" data-tool="sec" aria-pressed={arac === "sec"} title="Seç (V)" onClick={() => onArac("sec")}>
        <MousePointer2 size={15} />
      </button>
      <button type="button" className="tool" data-tool="el" aria-pressed={arac === "el"} title="Sahneyi kaydır (H)" onClick={() => onArac("el")}>
        <Hand size={15} />
      </button>
      <span className="tool-sep" />
      <button
        type="button"
        className="tool"
        data-tool="metin"
        aria-pressed={arac === "metin"}
        title="Metin kutusu (T) — karta tıklayın"
        onClick={() => onArac(arac === "metin" ? "sec" : "metin")}
      >
        <Type size={15} />
      </button>
      <button
        type="button"
        className="tool"
        data-tool="cizgi"
        aria-pressed={arac === "cizgi"}
        title="Bağlantı çizgisi (L) — kartta sürükleyin"
        onClick={() => onArac(arac === "cizgi" ? "sec" : "cizgi")}
      >
        <Spline size={15} />
      </button>
      <span className="tool-sep" />
      <button
        type="button"
        className="tool"
        data-tool="serbest"
        aria-pressed={serbest}
        title="Serbest yerleşim — başlık, grafik ve dipnotu elle taşı"
        onClick={() => onSerbest(!serbest)}
      >
        <LayoutTemplate size={15} />
      </button>
      <span className="tool-sep" />
      {kutuDugme("ekle", "Ekle", <Plus size={15} />, ekle, 330)}
      {kutuDugme("renk", "Renkler", <Palette size={15} />, renk, 330)}
      <span className="tool-sep" />
      {kutuDugme("disa", "Dışa aktar", <Download size={15} />, disa, 330)}
    </div>
  );
}
