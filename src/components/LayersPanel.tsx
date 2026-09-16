/**
 * Katmanlar — kartın içindeki her şeyin tek listesi.
 *
 * Figma'nın katman paneliyle aynı sözleşme: liste slaytla aynı sırada okunur
 * (en üstteki en önde), satır sürüklenerek taşınır, çift tık adı değiştirir,
 * göz ve kilit satırın üstüne gelince çıkar ama **kapalıysa** hep görünür —
 * kapalı bir katmanın kapalı olduğu, fareyi üstüne götürmeden anlaşılmalı.
 *
 * Panelin bildiği tek veri yapısı `katmanAgaci()`'nın döndürdüğü satır dizisi.
 * Süslemenin iki yığınlı deposu, grupların etiket oluşu, katmanın `arka`/`on`
 * alanında durması — hiçbiri buraya sızmıyor; bkz. `src/decor/katmanlar.ts`.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowUpRight,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownRight,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Frame,
  Grid2x2,
  Group as GroupIcon,
  Highlighter,
  Lock,
  LockOpen,
  MessageCircle,
  Pilcrow,
  Search,
  Shapes,
  Star,
  Sun,
  Trash,
  Type,
  Ungroup,
  X,
} from "lucide-react";

import { katmanAgaci, katmanTasi, tasinabilir, type KatmanSatir } from "@/decor/katmanlar";
import { grubuCoz, grupla, restackEnd, type DecorItem, type DecorState, type SlotKey } from "@/decor/model";
import { getAsset, newItem } from "@/decor/registry";
import { useDragOrder } from "@/lib/use-drag-order";
import type { ChartSpec } from "@/lib/spec";
import type { DecorFamily } from "@/decor/types";

/* ---------------- satır ikonları ---------------- */

const AILE_IKON: Record<DecorFamily, typeof Shapes> = {
  metin: Type,
  doku: Grid2x2,
  isik: Sun,
  cerceve: Frame,
  sekil: Shapes,
  ok: ArrowUpRight,
  ikon: Star,
  isaret: Highlighter,
  balon: MessageCircle,
};

const PARCA_IKON: Record<SlotKey, typeof Shapes> = {
  baslik: Type,
  grafik: ChartColumn,
  dipnot: Pilcrow,
};

function SatirIkon({ satir }: { satir: KatmanSatir }) {
  if (satir.tur === "parca") {
    const I = PARCA_IKON[satir.key];
    return <I size={13} />;
  }
  if (satir.tur === "grup") {
    const I = satir.kapali ? Folder : FolderOpen;
    return <I size={13} />;
  }
  const aile = getAsset(satir.tur === "nesne" ? satir.item.asset : satir.veri.asset)?.family;
  const I = aile ? AILE_IKON[aile] : Shapes;
  return <I size={13} />;
}

/* ---------------- bağlam menüsü ---------------- */

interface MenuEylem {
  ad: string;
  kisayol?: string;
  ikon?: typeof Shapes;
  tehlike?: boolean;
  calistir: () => void;
}

function BaglamMenusu({ x, y, eylemler, onKapat }: { x: number; y: number; eylemler: MenuEylem[]; onKapat: () => void }) {
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
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    // `capture`: menünün kendi tıklaması önce eylemi çalıştırsın diye eylem
    // düğmeleri olayı durduruyor.
    window.addEventListener("pointerdown", kapat);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", kapat);
    return () => {
      window.removeEventListener("pointerdown", kapat);
      window.removeEventListener("keydown", esc);
      window.removeEventListener("resize", kapat);
    };
  }, [onKapat]);

  return (
    <div ref={ref} className="katman-menu" style={{ left: yer.x, top: yer.y }} onPointerDown={(e) => e.stopPropagation()} role="menu">
      {eylemler.map((a, i) => (
        <button
          key={`${a.ad}${i}`}
          type="button"
          role="menuitem"
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
      ))}
    </div>
  );
}

/* ---------------- panel ---------------- */

export function LayersPanel({
  spec,
  selectedIds,
  onSelect,
  onChange,
}: {
  spec: ChartSpec;
  /** `slot:<parca>`, `zemin:<yuva>` ya da nesne kimlikleri. */
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (s: ChartSpec) => void;
}) {
  const [kapali, setKapali] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [filtre, setFiltre] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; satir: number } | null>(null);
  /** Shift+tık aralığının başlangıcı — Figma'da da son *düz* tıklama. */
  const capa = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const decor = spec.decor;
  const setDecor = (d: DecorState) => onChange({ ...spec, decor: d });

  const k = useMemo(
    () => katmanAgaci(decor, spec.yerlesim.gizli, kapali, filtre),
    [decor, spec.yerlesim.gizli, kapali, filtre]
  );
  const satirlar = k.satirlar;

  /* ---- seçim ---- */

  const satirSecimi = (s: KatmanSatir): string[] => {
    if (s.tur === "nesne") return [s.item.id];
    if (s.tur === "grup") return s.uyeler.map((u) => u.id);
    if (s.tur === "parca") return [`slot:${s.key}`];
    return [`zemin:${s.slot}`];
  };

  const secili = (s: KatmanSatir): boolean => {
    const ids = satirSecimi(s);
    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  };

  const tikla = (i: number, e: React.MouseEvent) => {
    const s = satirlar[i];
    const ids = satirSecimi(s);
    if (e.shiftKey && capa.current) {
      // Aralık seçimi yalnız nesneler arasında anlamlı: kart parçası ile zemin
      // yuvası aynı seçimde duramaz, sağ panel ikisini birden gösteremez.
      const a = satirlar.findIndex((r) => r.id === capa.current);
      if (a >= 0) {
        const [bas, son] = a < i ? [a, i] : [i, a];
        const aralik = satirlar.slice(bas, son + 1).flatMap((r) => (r.tur === "nesne" || r.tur === "grup" ? satirSecimi(r) : []));
        if (aralik.length) return onSelect([...new Set(aralik)]);
      }
    }
    capa.current = s.id;
    if ((e.ctrlKey || e.metaKey) && (s.tur === "nesne" || s.tur === "grup")) {
      const hepsiSecili = ids.every((id) => selectedIds.includes(id));
      const temiz = selectedIds.filter((id) => !id.startsWith("slot:") && !id.startsWith("zemin:"));
      return onSelect(hepsiSecili ? temiz.filter((id) => !ids.includes(id)) : [...new Set([...temiz, ...ids])]);
    }
    onSelect(ids);
  };

  // Sahnede seçilen satır listede de görünsün — 40 nesnelik bir kartta seçili
  // satır çoğu zaman kaydırmanın dışında kalıyor.
  useEffect(() => {
    const id = selectedIds[0];
    if (!id) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-satir-sec="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIds]);

  /* ---- nesne düzenleme ---- */

  const setItems = (next: DecorItem[]) => setDecor({ ...decor, nesneler: next });
  const yamala = (ids: string[], p: Partial<DecorItem>) =>
    setItems(decor.nesneler.map((n) => (ids.includes(n.id) ? { ...n, ...p } : n)));

  const gozDegistir = (s: KatmanSatir) => {
    if (s.tur === "nesne") return yamala([s.item.id], { gizli: !s.item.gizli });
    if (s.tur === "grup") return yamala(s.uyeler.map((u) => u.id), { gizli: !s.gizli });
    if (s.tur === "parca") {
      const gizli = s.gizli ? spec.yerlesim.gizli.filter((g) => g !== s.key) : [...spec.yerlesim.gizli, s.key];
      return onChange({ ...spec, yerlesim: { ...spec.yerlesim, gizli } });
    }
    setDecor({ ...decor, zemin: { ...decor.zemin, [s.slot]: { ...s.veri, gizli: !s.veri.gizli } } });
  };

  const kilitDegistir = (s: KatmanSatir) => {
    if (s.tur === "nesne") return yamala([s.item.id], { kilit: !s.item.kilit });
    if (s.tur === "grup") return yamala(s.uyeler.map((u) => u.id), { kilit: !s.kilit });
  };

  const sil = (s: KatmanSatir) => {
    if (s.tur === "nesne" || s.tur === "grup") {
      const ids = satirSecimi(s);
      setItems(decor.nesneler.filter((n) => !ids.includes(n.id)));
      onSelect([]);
      return;
    }
    if (s.tur === "zemin") {
      setDecor({ ...decor, zemin: { ...decor.zemin, [s.slot]: null } });
      onSelect([]);
    }
  };

  const adlandir = (s: KatmanSatir, ad: string) => {
    if (s.tur === "nesne") yamala([s.item.id], { ad: ad.slice(0, 80) });
    else if (s.tur === "grup") setDecor({ ...decor, gruplar: { ...decor.gruplar, [s.grup]: { ad: ad.slice(0, 80) } } });
    setDuzenlenen(null);
  };

  const katla = (grup: string) =>
    setKapali((s) => {
      const n = new Set(s);
      if (n.has(grup)) n.delete(grup);
      else n.add(grup);
      return n;
    });

  /* ---- sürükleyerek sıralama ---- */

  // `useDragOrder` hedefi nihai indis olarak veriyor; `katmanTasi` ise boşluk
  // indisi bekliyor. Dönüşüm tek satır, ve `to === from` zaten çağrılmıyor.
  const drag = useDragOrder(satirlar.length, (from, to) => setDecor(katmanTasi(decor, k, from, to >= from ? to + 1 : to)));

  /* ---- bağlam menüsü ---- */

  const menuEylemleri = (i: number): MenuEylem[] => {
    const s = satirlar[i];
    const ids = satirSecimi(s);
    const coklu = decor.nesneler.filter((n) => selectedIds.includes(n.id));
    const list: MenuEylem[] = [];

    if (s.tur === "nesne" || s.tur === "grup") {
      list.push({ ad: "Yeniden adlandır", kisayol: "F2", calistir: () => setDuzenlenen(s.id) });
    }
    if (s.tur === "nesne") {
      list.push({
        ad: "Çoğalt",
        kisayol: "Ctrl+D",
        ikon: Copy,
        calistir: () => {
          const taze = newItem(s.item.asset, spec.options.width, spec.options.height);
          if (!taze) return;
          const kopya: DecorItem = { ...s.item, id: taze.id, x: s.item.x + 16, y: s.item.y + 16, grup: "" };
          setItems([...decor.nesneler, kopya]);
          onSelect([kopya.id]);
        },
      });
    }
    if (coklu.length > 1) {
      list.push({
        ad: "Grupla",
        kisayol: "Ctrl+G",
        ikon: GroupIcon,
        calistir: () => setDecor(grupla(decor, coklu.map((n) => n.id))),
      });
    }
    if (s.tur === "grup") {
      list.push({ ad: "Grubu çöz", kisayol: "Ctrl+Shift+G", ikon: Ungroup, calistir: () => setDecor(grubuCoz(decor, ids)) });
    }
    if (s.tur === "nesne" && s.item.grup) {
      list.push({ ad: "Gruptan çıkar", ikon: Ungroup, calistir: () => yamala([s.item.id], { grup: "" }) });
    }
    if (s.tur === "nesne" || s.tur === "grup") {
      // Katlanarak: her adım bir öncekinin sonucunu alıyor, yoksa çok üyeli bir
      // grupta yalnız son üye taşınırdı.
      const uca = (end: "on" | "arka") => () => setItems(ids.reduce((acc, id) => restackEnd(acc, id, end), decor.nesneler));
      list.push({ ad: "En öne getir", kisayol: "Shift+]", calistir: uca("on") });
      list.push({ ad: "En arkaya gönder", kisayol: "Shift+[", calistir: uca("arka") });
    }
    list.push({
      ad: gizliMi(s) ? "Göster" : "Gizle",
      ikon: gizliMi(s) ? Eye : EyeOff,
      calistir: () => gozDegistir(s),
    });
    if (s.tur === "nesne" || s.tur === "grup") {
      list.push({ ad: kilitliMi(s) ? "Kilidi aç" : "Kilitle", ikon: kilitliMi(s) ? LockOpen : Lock, calistir: () => kilitDegistir(s) });
      list.push({ ad: "Sil", kisayol: "Del", ikon: Trash, tehlike: true, calistir: () => sil(s) });
    }
    if (s.tur === "zemin") {
      // Zemin yuvası tanımı gereği kartın arkasında: yığında yeri yok, o
      // yüzden satırı da sürüklenmiyor. "Öne almak" demek aslında onu bir
      // nesneye çevirmek demek — kart boyunda bir kutu veriliyor ki görüntü
      // birebir aynı kalsın, sonra istenirse taşınıp küçültülsün.
      list.push({
        ad: "Nesneye dönüştür",
        ikon: CornerDownRight,
        calistir: () => {
          const taze = newItem(s.veri.asset, spec.options.width, spec.options.height);
          if (!taze) return;
          const item: DecorItem = {
            ...taze,
            ...s.veri,
            id: taze.id,
            ad: "",
            x: 0,
            y: 0,
            w: spec.options.width,
            h: spec.options.height,
            aci: 0,
            aynala: false,
            katman: "on",
            kilit: false,
            grup: "",
          };
          setDecor({ ...decor, zemin: { ...decor.zemin, [s.slot]: null }, nesneler: [...decor.nesneler, item] });
          onSelect([item.id]);
        },
      });
      list.push({ ad: "Kaldır", ikon: Trash, tehlike: true, calistir: () => sil(s) });
    }
    return list;
  };

  /* ---- klavye ---- */

  const listeTusu = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const i = satirlar.findIndex((s) => secili(s));
    const s = i >= 0 ? satirlar[i] : null;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const j = Math.max(0, Math.min(satirlar.length - 1, (i < 0 ? -1 : i) + (e.key === "ArrowDown" ? 1 : -1)));
      const hedef = satirlar[j];
      if (hedef) {
        capa.current = hedef.id;
        onSelect(satirSecimi(hedef));
      }
      return;
    }
    if (!s) return;
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && s.tur === "grup") {
      e.preventDefault();
      if (s.kapali === (e.key === "ArrowRight")) katla(s.grup);
      return;
    }
    if ((e.key === "F2" || e.key === "Enter") && (s.tur === "nesne" || s.tur === "grup")) {
      e.preventDefault();
      setDuzenlenen(s.id);
    }
  };

  /* ---- çizim ---- */

  const nesneSayisi = decor.nesneler.length;

  return (
    <div className="katmanlar flex min-h-0 flex-1 flex-col">
      <div className="katman-arama shrink-0">
        <Search size={12} />
        <input
          value={filtre}
          placeholder={`Katmanlarda ara (${nesneSayisi})`}
          onChange={(e) => setFiltre(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setFiltre("")}
        />
        {filtre && (
          <button className="icon-btn" type="button" title="Aramayı temizle" onClick={() => setFiltre("")}>
            <X size={12} />
          </button>
        )}
      </div>

      <div
        className="katman-liste min-h-0 flex-1 overflow-auto"
        ref={(el) => {
          listRef.current = el;
          drag.listRef.current = el;
        }}
        role="listbox"
        aria-multiselectable
        tabIndex={0}
        onKeyDown={listeTusu}
      >
        {satirlar.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">{filtre ? "Eşleşen katman yok." : "Bu kartta katman yok."}</p>
        ) : (
          satirlar.map((s, i) => {
            const sec = secili(s);
            const gizli = gizliMi(s);
            const kilitli = kilitliMi(s);
            const tasinir = tasinabilir(s);
            // Sürükleme de bir `style` veriyor (yer açan kayma). İkisi tek
            // nesnede birleşiyor: ayrı ayrı yazılınca sonraki öncekini siliyor
            // ve satırların girintisi kayboluyordu.
            const { style: dragStyle, ...dragProps } = drag.rowProps(i, !tasinir) as {
              style?: React.CSSProperties;
            } & Record<string, unknown>;
            return (
              <div
                key={s.id}
                className="katman-satir"
                role="option"
                aria-selected={sec}
                data-satir-id={s.id}
                data-satir-sec={satirSecimi(s)[0]}
                data-tur={s.tur}
                data-gizli={gizli ? "" : undefined}
                data-kilit={kilitli ? "" : undefined}
                style={{ paddingLeft: 6 + s.derinlik * 14, ...dragStyle }}
                onClick={(e) => tikla(i, e)}
                onDoubleClick={() => (s.tur === "nesne" || s.tur === "grup") && setDuzenlenen(s.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!sec) tikla(i, e);
                  setMenu({ x: e.clientX, y: e.clientY, satir: i });
                }}
                {...dragProps}
              >
                <span className="katman-ok">
                  {s.tur === "grup" ? (
                    <button
                      className="icon-btn"
                      type="button"
                      title={s.kapali ? "Grubu aç" : "Grubu kapat"}
                      onClick={(e) => (e.stopPropagation(), katla(s.grup))}
                    >
                      {s.kapali ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>
                  ) : null}
                </span>
                <span className="katman-ikon">
                  <SatirIkon satir={s} />
                </span>
                {duzenlenen === s.id ? (
                  <input
                    className="katman-ad-giris grow"
                    autoFocus
                    defaultValue={s.ad}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => adlandir(s, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") adlandir(s, (e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setDuzenlenen(null);
                    }}
                  />
                ) : (
                  <span className="katman-ad grow" title={s.ad}>
                    {s.ad}
                  </span>
                )}
                <span className="katman-acts">
                  {(s.tur === "nesne" || s.tur === "grup") && (
                    <button
                      className="icon-btn"
                      type="button"
                      data-acik={kilitli ? "" : undefined}
                      title={kilitli ? "Kilidi aç" : "Kilitle"}
                      onClick={(e) => (e.stopPropagation(), kilitDegistir(s))}
                    >
                      {kilitli ? <Lock size={12} /> : <LockOpen size={12} />}
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    type="button"
                    data-acik={gizli ? "" : undefined}
                    title={gizli ? "Göster" : "Gizle"}
                    onClick={(e) => (e.stopPropagation(), gozDegistir(s))}
                  >
                    {gizli ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="katman-ipucu shrink-0">
        Üstteki en önde; kart parçalarının altı arka katman. Çift tık ad değiştirir, sağ tık menüyü açar.
      </p>

      {menu && <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri(menu.satir)} onKapat={() => setMenu(null)} />}
    </div>
  );
}

function gizliMi(s: KatmanSatir): boolean {
  if (s.tur === "nesne") return s.item.gizli;
  if (s.tur === "zemin") return s.veri.gizli;
  return s.gizli;
}

function kilitliMi(s: KatmanSatir): boolean {
  if (s.tur === "nesne") return s.item.kilit;
  if (s.tur === "grup") return s.kilit;
  return false;
}
