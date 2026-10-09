/**
 * Sahnede sıralama — grafiğin öğesini doğrudan tutup sürüklemek.
 *
 * Figma'nın grup kuralı: dışarıdayken ilk tık grafiği seçer; grafik ya da bir
 * öğesi seçiliyken ("içeride") tık öğeyi seçer, sürüklemek onu taşır. Serbest
 * yerleşimde grafik seçiliyken sürüklemek kutuyu taşır — Figma'da da seçili
 * olan taşınır; öğeye inmek için çift tık.
 *
 * Bu katman `ChartCard`'ın **dışında** duruyor: kartın DOM'u dışa aktarılan
 * DOM, içine durum giremez. Öğeleri kendi `data-*` anahtarlarından bulur
 * (`src/lib/sahne-olcu.ts`), çerçeveleri ve hayalet etiketi ölçülen
 * kutulardan çizer.
 *
 * **Canlı yer açma.** Hedef değiştikçe sahnedeki karta geçici bir spec gider
 * (`onOnizleme`) — yalnız sıra alanları farklı. Animasyon ayarlarına
 * dokunulmuyor: `animate`'i değiştirmek çubuk, alan, sankey ve viz giriş
 * animasyonlarını baştan oynatıyordu. Hedef, sürüklemenin **başında** ölçülen
 * yuvalardan hesaplanıyor; yer açan komşular hesabı oynatmasın, hedef
 * titremesin. Ağaç haritası ve gösterge yayında yerleşim sıraya bağlı
 * (kareler yer değiştiriyor) — orada yer açma yok: altındaki öğe çerçevelenir,
 * bırakınca uygulanır.
 *
 * Bırakma tek geri al adımı: `onBirak` geçmişi işaretleyip güncel durumdan
 * hesaplıyor. Sürüklerken basılan bir tuş sürüklemeyi iptal eder — `Ctrl+Z`
 * yarım bir önizlemenin üstüne inmesin.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Highlighter,
  RotateCcw,
} from "lucide-react";

import { BaglamMenusu, type MenuEylem } from "@/components/BaglamMenusu";
import type { Arac } from "@/components/Toolbar";
import {
  arkaKutuUstte,
  ayriKutular,
  birlesim,
  noktadakiOge,
  ogeAcisi,
  ogeKutulari,
  olculenSira,
  sahneKarti,
  type Kutu,
  type OgeIsabeti,
} from "@/lib/sahne-olcu";
import { GRAFIK, icerideMi, type Secim } from "@/lib/selection";
import {
  bosluktanHedef,
  gostergeBoyutu,
  renkBoyutu,
  seriSifirla,
  siraBoyutlari,
  siraModu,
  tersCevir,
  type Geometri,
  type SiraBoyutu,
} from "@/lib/sira";
import { adimla, kardesler, ogeyiTasi, vurguDegistir, vurguDestekli, type OgeSecimi } from "@/lib/sira-eylem";
import type { ChartSpec } from "@/lib/spec";
import { ESIK } from "@/lib/use-drag-order";

export interface UzerindeOge {
  boyut: SiraBoyutu;
  anahtar: string;
  grup?: string;
}

interface Props {
  /** Kayıtlı spec — önizleme değil. */
  spec: ChartSpec;
  /** Sahnede şu an çizilen (önizleme ya da kayıtlı); çerçeveler onu izler. */
  cizilen: ChartSpec;
  scale: number;
  secim: Secim;
  onSecim: (s: Secim) => void;
  onChange: (s: ChartSpec) => void;
  /** Sürükleme bitti: tek geri al adımı, güncel durumdan hesaplanır. */
  onBirak: (fn: (s: ChartSpec) => ChartSpec) => void;
  onOnizleme: (s: ChartSpec | null) => void;
  arac: Arac;
  /** Sağ paneldeki listede üstüne gelinen öğe — sahnede çerçevelenir. */
  uzerinde: UzerindeOge | null;
}

/** Sürüklerken imlecin hangi ölçüyle hedefe çevrileceği; gösterge girdileri okuma sırasında. */
type Olcu = Geometri | "okuma";

interface Yuva {
  anahtar: string;
  /** 1B ölçü: merkez x / y, açı ya da yarıçap. */
  s: number;
  kutu: Kutu;
}

interface Jest {
  x0: number;
  y0: number;
  /** Tıklanırsa seçilecek öğe — seçili grubun yaprağına iner. */
  isabet: OgeIsabeti;
  /** Sürüklenirse taşınacak öğe — seçili olan (Figma: sürükleme seçimi taşır, tık içeri iner). */
  suruk: OgeIsabeti;
  canli: boolean;
  /** Bu öğe sürüklenemiyor (sıra veriden geliyor ya da sahnede geometrisi yok). */
  surukYok?: boolean;
  secim?: OgeSecimi;
  olcu?: Olcu;
  liste?: string[];
  yuvalar?: Yuva[];
  merkez?: { x: number; y: number };
  ileri?: boolean;
  /** Taşınanların sürükleme başındaki yeri — aynı yere bırakmak hiçbir şey değiştirmesin. */
  ilkHedef?: number;
  hedef: number | null;
  olculen?: string[];
}

interface Cerceveler {
  secili: Kutu[];
  uzerinde: Kutu[];
  hedef: Kutu[];
}

const BOS: Cerceveler = { secili: [], uzerinde: [], hedef: [] };

/**
 * Sürüklemede taşınacak öğe. Grup seçiliyken yaprağa basıp sürüklemek grubu
 * taşır; yaprağı taşımak için önce yaprağa tıklayıp onu seçmek gerekir.
 */
function suruklenen(h: OgeIsabeti, s: Secim): OgeIsabeti {
  if (h.boyut !== "alt" || (s.tur === "oge" && s.boyut === "alt" && s.grup === h.grup)) return h;
  return { ...h, boyut: "oge", anahtar: h.grup!, grup: undefined };
}

/** Hiyerarşide yaprağa ancak grubu seçiliyken inilir — Figma'nın iç içe grupları gibi. */
function cozumle(h: OgeIsabeti | null, s: Secim): OgeIsabeti | null {
  if (!h || h.boyut !== "alt") return h;
  const grup = h.grup!;
  const icinde = s.tur === "oge" && ((s.boyut === "oge" && s.anahtarlar.includes(grup)) || (s.boyut === "alt" && s.grup === grup));
  return icinde ? h : { ...h, boyut: "oge", anahtar: grup, grup: undefined };
}

/** Sürüklerken grafiğe ulaşmaması gereken fare olayları. */
const KALKAN = ["pointermove", "pointerover", "pointerout", "mousemove", "mouseover", "mouseout"] as const;

function kalkan(e: Event) {
  e.stopPropagation();
}

/** Saat 12'den saat yönünde açı, [0, 2π). */
function aciOf(dx: number, dy: number): number {
  const a = Math.atan2(dx, -dy);
  return a < 0 ? a + Math.PI * 2 : a;
}

/** Sürüklemeden sonra gelen `click`'i yutar — sahnenin tıkla-seçi az önceki seçimi ezmesin. */
function clickiYut() {
  const yut = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    window.clearTimeout(zamanlayici);
  };
  window.addEventListener("click", yut, { capture: true, once: true });
  const zamanlayici = window.setTimeout(() => window.removeEventListener("click", yut, { capture: true }), 300);
}

export function SiraSahnesi({ spec, cizilen, scale, secim, onSecim, onChange, onBirak, onOnizleme, arac, uzerinde }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const jest = useRef<Jest | null>(null);
  const [hover, setHover] = useState<OgeIsabeti | null>(null);
  const [hedefAnahtar, setHedefAnahtar] = useState<string | null>(null);
  const [hayalet, setHayalet] = useState<{ x: number; y: number; ad: string; renk: string | null } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; s: OgeSecimi } | null>(null);
  const [cerceveler, setCerceveler] = useState<Cerceveler>(BOS);

  // Native dinleyiciler bir kez kuruluyor; güncel değerleri buradan okuyorlar.
  const guncel = useRef({ spec, secim, arac, onSecim, onChange, onBirak, onOnizleme });
  guncel.current = { spec, secim, arac, onSecim, onChange, onBirak, onOnizleme };

  const inspectOf = () => hostRef.current?.parentElement ?? null;

  /** İçerideyken basış sıralamaya mı gidiyor — serbest yerleşimde grafik seçiliyse kutu taşınır. */
  const sahiplen = (s: Secim, sp: ChartSpec) => s.tur === "oge" || (icerideMi(s) && !sp.yerlesim.serbest);

  /* ---------------- sürükleme ---------------- */

  const surukBaslat = useCallback((j: Jest): boolean => {
    const { spec: sp, secim: s, onSecim: secimYap } = guncel.current;
    const kart = sahneKarti();
    if (!kart) return false;
    const h = j.suruk;
    const olculen = olculenSira(sp);
    const bilgi = siraBoyutlari(sp, olculen).find((b) => b.boyut === h.boyut);
    const olcu: Olcu | null = h.gosterge ? "okuma" : (bilgi?.geometri ?? null);
    if (!bilgi || bilgi.kapali || !olcu) return false;

    // Seçili değilse yalnız o taşınır; çoklu seçimin parçasıysa hepsi.
    // Sankey'de blok yok: düğümler farklı sütunlarda olabilir.
    const ayniBoyut = s.tur === "oge" && s.boyut === h.boyut && s.grup === h.grup && s.anahtarlar.includes(h.anahtar);
    const anahtarlar = ayniBoyut && !(sp.kind === "sankey" && h.boyut === "oge") ? s.anahtarlar : [h.anahtar];
    const liste = kardesler(sp, h.boyut, h.anahtar, h.grup, olculen);
    const tasinan = anahtarlar.filter((k) => liste.includes(k));
    if (tasinan.length === 0) return false;

    const sec = { gosterge: h.gosterge, grup: h.grup };
    const kutular = ogeKutulari(kart, h.boyut, sec);
    const hepsi = birlesim(liste.map((k) => kutular.get(k)).filter((k): k is Kutu => !!k));
    if (!hepsi) return false;
    const merkez = { x: (hepsi.l + hepsi.r) / 2, y: (hepsi.t + hepsi.b) / 2 };
    const yuvalar: Yuva[] = [];
    for (const k of liste) {
      const kutu = kutular.get(k);
      if (!kutu) continue;
      let s1: number;
      if (olcu === "x" || olcu === "okuma" || olcu === "2b") s1 = (kutu.l + kutu.r) / 2;
      else if (olcu === "y") s1 = (kutu.t + kutu.b) / 2;
      else if (olcu === "aci") s1 = ogeAcisi(kart, h.boyut, k, sec) ?? aciOf((kutu.l + kutu.r) / 2 - merkez.x, (kutu.t + kutu.b) / 2 - merkez.y);
      else s1 = Math.max(kutu.r - kutu.l, kutu.b - kutu.t) / 2;
      yuvalar.push({ anahtar: k, s: s1, kutu });
    }
    if (yuvalar.length < 2) return false;
    if (olcu === "yaricap") {
      // Kutudan okunan yarıçap halkanın dış kenarı; imleç halkanın ortasını
      // geçince yer değişsin diye yarım aralık içeri çekiliyor.
      const dis = yuvalar.map((u) => u.s).sort((x, y) => x - y);
      const aralik = (dis[dis.length - 1] - dis[0]) / Math.max(1, dis.length - 1);
      for (const u of yuvalar) u.s -= aralik / 2;
    }
    const ilk = liste.indexOf(tasinan[0]);

    j.secim = { boyut: h.boyut, anahtarlar: tasinan, grup: h.grup };
    j.olcu = olcu;
    j.liste = liste;
    j.yuvalar = yuvalar;
    j.merkez = merkez;
    j.ileri = olcu === "aci" || yuvalar[yuvalar.length - 1].s >= yuvalar[0].s;
    j.ilkHedef = bosluktanHedef(liste, tasinan, ilk);
    j.olculen = olculen;
    j.canli = true;

    if (!ayniBoyut) secimYap({ tur: "oge", boyut: h.boyut, anahtarlar: tasinan, grup: h.grup });

    // Grafiğin kendi fare durumunu temizle: hover indeksle tutuluyor, yer
    // değişince yanlış öğe parlardı. Sürükleme boyunca fare olayları sahne
    // sarmalayıcısında durduruluyor (`kalkan`), grafiğe ulaşmıyor. Kartı
    // `pointer-events: none` ile kör etmek olmazdı: ağaç haritası hedefini
    // isabet testiyle buluyor.
    const inspect = inspectOf();
    if (inspect) {
      inspect.dataset.siralaniyor = "";
      for (const tur of ["pointerout", "mouseout"]) {
        h.el.dispatchEvent(new MouseEvent(tur, { bubbles: true, relatedTarget: inspect }));
      }
      for (const tur of KALKAN) inspect.addEventListener(tur, kalkan, true);
    }
    const renkler = renkBoyutu(sp) === h.boyut ? kimlikRengi(kart, h, tasinan[0]) : null;
    setHayalet({
      x: j.x0,
      y: j.y0,
      ad: tasinan.length > 1 ? `${tasinan.length} öğe` : (siraBoyutlari(sp, olculen).find((b) => b.boyut === h.boyut)?.ogeler.find((o) => o.anahtar === tasinan[0])?.ad ?? tasinan[0]),
      renk: renkler,
    });
    return true;
  }, []);

  /** İmlecin yerinden hedef: kardeş listesinden taşınanlar çıkınca kalanların kaçıncısı. */
  const hedefBul = useCallback((j: Jest, x: number, y: number): number | null => {
    const tasinan = new Set(j.secim!.anahtarlar);
    const yuvalar = j.yuvalar!.filter((u) => !tasinan.has(u.anahtar));
    switch (j.olcu) {
      case "2b": {
        const kart = sahneKarti();
        const h = kart ? cozumle(noktadakiOge(x, y, kart), guncel.current.secim) : null;
        if (!h || h.boyut !== j.secim!.boyut || h.grup !== j.secim!.grup || tasinan.has(h.anahtar)) return j.hedef;
        const kalan = j.liste!.filter((k) => !tasinan.has(k));
        const ki = kalan.indexOf(h.anahtar);
        if (ki < 0) return j.hedef;
        // Altındaki öğenin yerini al: sonrasındaysa onun arkasına, öncesindeyse önüne.
        return j.liste!.indexOf(h.anahtar) > j.liste!.indexOf(j.secim!.anahtarlar[0]) ? ki + 1 : ki;
      }
      case "okuma":
        // Gösterge satır satır akıyor: üst satırdakiler ve aynı satırda solda kalanlar önce.
        return yuvalar.filter((u) => u.kutu.b < y || (u.kutu.t <= y && y <= u.kutu.b && (u.kutu.l + u.kutu.r) / 2 < x)).length;
      default: {
        const m = j.merkez!;
        const p =
          j.olcu === "x" ? x : j.olcu === "y" ? y : j.olcu === "aci" ? aciOf(x - m.x, y - m.y) : Math.hypot(x - m.x, y - m.y);
        return yuvalar.filter((u) => (j.ileri ? u.s < p : u.s > p)).length;
      }
    }
  }, []);

  const hesapla = (s: ChartSpec, j: Jest, hedef: number) => ogeyiTasi(s, j.secim!, hedef, j.olculen);

  const bitir = useCallback(() => {
    jest.current = null;
    const inspect = inspectOf();
    if (inspect) {
      delete inspect.dataset.siralaniyor;
      for (const tur of KALKAN) inspect.removeEventListener(tur, kalkan, true);
    }
    setHayalet(null);
    setHedefAnahtar(null);
    guncel.current.onOnizleme(null);
  }, []);

  useEffect(() => {
    const inspect = inspectOf();
    if (!inspect) return;

    const tikla = (h: OgeIsabeti, e: PointerEvent) => {
      const { spec: sp, secim: s, onSecim: secimYap, onChange: degistir } = guncel.current;
      if (e.altKey && h.boyut === "oge" && !h.gosterge && vurguDestekli(sp)) {
        degistir(vurguDegistir(sp, h.anahtar, e.shiftKey));
        return;
      }
      if ((e.shiftKey || e.ctrlKey || e.metaKey) && s.tur === "oge" && s.boyut === h.boyut && s.grup === h.grup) {
        const var_ = s.anahtarlar.includes(h.anahtar);
        const yeni = var_ ? s.anahtarlar.filter((k) => k !== h.anahtar) : [...s.anahtarlar, h.anahtar];
        secimYap(yeni.length > 0 ? { ...s, anahtarlar: yeni } : GRAFIK);
        return;
      }
      secimYap({ tur: "oge", boyut: h.boyut, anahtarlar: [h.anahtar], grup: h.grup });
    };

    const birak = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onIptal, true);
      window.removeEventListener("keydown", onTus, true);
    };

    const onMove = (e: PointerEvent) => {
      const j = jest.current;
      if (!j) return;
      if (!j.canli) {
        if (j.surukYok || Math.hypot(e.clientX - j.x0, e.clientY - j.y0) < ESIK) return;
        if (!surukBaslat(j)) {
          j.surukYok = true;
          return;
        }
      }
      setHayalet((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
      const hedef = hedefBul(j, e.clientX, e.clientY);
      if (hedef === j.hedef) return;
      j.hedef = hedef;
      const degismedi = hedef == null || hedef === j.ilkHedef;
      if (j.olcu === "2b") {
        // Yerleşim sıraya bağlı: önizleme yok, altındaki öğe çerçevelenir.
        const kalan = j.liste!.filter((k) => !j.secim!.anahtarlar.includes(k));
        setHedefAnahtar(degismedi || hedef == null ? null : (kalan[Math.min(kalan.length - 1, hedef - (hedef > j.ilkHedef! ? 1 : 0))] ?? null));
        return;
      }
      guncel.current.onOnizleme(degismedi ? null : hesapla(guncel.current.spec, j, hedef!));
    };

    const onUp = (e: PointerEvent) => {
      const j = jest.current;
      birak();
      if (!j) return;
      clickiYut();
      if (!j.canli) {
        bitir();
        if (!j.surukYok) tikla(j.isabet, e);
        return;
      }
      const hedef = j.hedef;
      const sec = j.secim!;
      bitir();
      if (hedef != null && hedef !== j.ilkHedef) guncel.current.onBirak((s) => hesapla(s, j, hedef));
      guncel.current.onSecim({ tur: "oge", boyut: sec.boyut, anahtarlar: sec.anahtarlar, grup: sec.grup });
    };

    const onIptal = () => {
      birak();
      if (jest.current) clickiYut();
      bitir();
    };

    const onTus = (e: KeyboardEvent) => {
      // Yalnız değiştirici tuşlar tıklamanın parçası (Shift+tık, Alt+tık).
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onIptal();
    };

    const onDown = (e: PointerEvent) => {
      const { spec: sp, secim: s, arac: a } = guncel.current;
      if (a !== "sec" || e.button !== 0 || jest.current) return;
      const kart = sahneKarti();
      if (!sahiplen(s, sp)) {
        // Dışarıdayken ilk tık grafiği seçer — arkadaki bir süsleme isabet
        // testinde üstte kalsa bile: görselde üstte olan grafiğin öğesi.
        if (!icerideMi(s) && kart && arkaKutuUstte(e.clientX, e.clientY) && noktadakiOge(e.clientX, e.clientY, kart)) {
          e.preventDefault();
          e.stopPropagation();
          clickiYut();
          guncel.current.onSecim(GRAFIK);
        }
        return;
      }
      const h = kart ? cozumle(noktadakiOge(e.clientX, e.clientY, kart), s) : null;
      if (!h) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu(null);
      jest.current = { x0: e.clientX, y0: e.clientY, isabet: h, suruk: suruklenen(h, s), canli: false, hedef: null };
      // Pencerede, yakalama evresinde: sahnedeki kalkan olayı grafiğe
      // ulaşmadan durduruyor, belgeye kabarcıklanmıyor.
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onIptal, true);
      window.addEventListener("keydown", onTus, true);
    };

    /** Serbest yerleşimde tıklama grafik kutusuna gidiyor; öğeye inmenin yolu çift tık. */
    const onCift = (e: MouseEvent) => {
      const { spec: sp, secim: s, arac: a, onSecim: secimYap } = guncel.current;
      if (a !== "sec" || !sp.yerlesim.serbest || s.tur === "oge") return;
      const kart = sahneKarti();
      const h = kart ? cozumle(noktadakiOge(e.clientX, e.clientY, kart), s) : null;
      if (!h) return;
      e.preventDefault();
      secimYap({ tur: "oge", boyut: h.boyut, anahtarlar: [h.anahtar], grup: h.grup });
    };

    const onMenu = (e: MouseEvent) => {
      const { secim: s, arac: a, onSecim: secimYap } = guncel.current;
      if (a !== "sec" || !icerideMi(s)) return;
      const kart = sahneKarti();
      const ham = kart ? cozumle(noktadakiOge(e.clientX, e.clientY, kart), s) : null;
      if (!ham) return;
      e.preventDefault();
      e.stopPropagation();
      // Sürükleme gibi: seçili grubun içine sağ tık grubu hedefler, yaprağa inmez.
      const h = suruklenen(ham, s);
      const secili = s.tur === "oge" && s.boyut === h.boyut && s.grup === h.grup && s.anahtarlar.includes(h.anahtar);
      const os: OgeSecimi = secili ? { boyut: s.boyut, anahtarlar: s.anahtarlar, grup: s.grup } : { boyut: h.boyut, anahtarlar: [h.anahtar], grup: h.grup };
      if (!secili) secimYap({ tur: "oge", ...os });
      setMenu({ x: e.clientX, y: e.clientY, s: os });
    };

    let kare = 0;
    const onUstunde = (e: PointerEvent) => {
      if (jest.current || kare) return;
      const x = e.clientX;
      const y = e.clientY;
      kare = requestAnimationFrame(() => {
        kare = 0;
        const { spec: sp, secim: s, arac: a } = guncel.current;
        const kart = sahneKarti();
        const h = a === "sec" && sahiplen(s, sp) && kart ? cozumle(noktadakiOge(x, y, kart), s) : null;
        setHover((onceki) =>
          onceki?.anahtar === h?.anahtar && onceki?.boyut === h?.boyut && onceki?.gosterge === h?.gosterge ? onceki : h
        );
      });
    };
    const onAyrildi = () => setHover(null);

    inspect.addEventListener("pointerdown", onDown, true);
    inspect.addEventListener("dblclick", onCift);
    inspect.addEventListener("contextmenu", onMenu, true);
    inspect.addEventListener("pointermove", onUstunde);
    inspect.addEventListener("pointerleave", onAyrildi);
    return () => {
      birak();
      if (kare) cancelAnimationFrame(kare);
      inspect.removeEventListener("pointerdown", onDown, true);
      inspect.removeEventListener("dblclick", onCift);
      inspect.removeEventListener("contextmenu", onMenu, true);
      inspect.removeEventListener("pointermove", onUstunde);
      inspect.removeEventListener("pointerleave", onAyrildi);
    };
  }, [bitir, hedefBul, surukBaslat]);

  // Başka bir grafiğe geçmek ya da aracı değiştirmek yarım sürüklemeyi bırakır.
  useEffect(() => {
    if (jest.current?.canli) bitir();
    setMenu(null);
  }, [spec.id, arac, bitir]);

  /* ---------------- çerçeveler ---------------- */

  const olc = useCallback(() => {
    const inspect = inspectOf();
    const kart = sahneKarti();
    if (!inspect || !kart) return setCerceveler(BOS);
    const ir = inspect.getBoundingClientRect();
    const sp = cizilen;
    const bilgiler = siraBoyutlari(sp);
    const gBoyut = gostergeBoyutu(sp);
    const kutular = (boyut: SiraBoyutu, anahtarlar: string[], grup?: string): Kutu[] => {
      const geometri = bilgiler.find((b) => b.boyut === boyut)?.geometri ?? null;
      const out: Kutu[] = [];
      for (const k of anahtarlar) {
        // Dağınık öğelerde (dağılım noktaları, ağ düğümleri) birleşim kutusu
        // grafiğin yarısını kaplardı: her parça kendi çerçevesini alır.
        if (geometri == null) out.push(...ayriKutular(kart, boyut, k, { grup }));
        else {
          const b = ogeKutulari(kart, boyut, { grup }).get(k);
          if (b) out.push(b);
        }
        if (gBoyut === boyut) {
          const g = ogeKutulari(kart, boyut, { gosterge: true }).get(k);
          if (g) out.push(g);
        }
      }
      return out.map((k) => ({ l: k.l - ir.left, t: k.t - ir.top, r: k.r - ir.left, b: k.b - ir.top }));
    };
    const s = secim.tur === "oge" ? kutular(secim.boyut, secim.anahtarlar, secim.grup) : [];
    const u = hover ?? (uzerinde ? { ...uzerinde, gosterge: false } : null);
    const uz = u && !(secim.tur === "oge" && secim.boyut === u.boyut && secim.anahtarlar.includes(u.anahtar)) ? kutular(u.boyut, [u.anahtar], u.grup) : [];
    const hd = hedefAnahtar && secim.tur === "oge" ? kutular(secim.boyut, [hedefAnahtar], secim.grup) : [];
    setCerceveler({ secili: s, uzerinde: uz, hedef: hd });
  }, [cizilen, secim, hover, uzerinde, hedefAnahtar]);

  useLayoutEffect(() => {
    olc();
    // Giriş ve yer değiştirme animasyonları bitince bir daha ölç.
    const z = [150, 600, 1300].map((ms) => window.setTimeout(olc, ms));
    return () => z.forEach((t) => window.clearTimeout(t));
  }, [olc, scale]);

  useEffect(() => {
    const inspect = inspectOf();
    if (!inspect) return;
    const ro = new ResizeObserver(() => olc());
    ro.observe(inspect);
    return () => ro.disconnect();
  }, [olc]);

  // İçerideyken öğeler tutulabilir görünsün (CSS imleci).
  useEffect(() => {
    const inspect = inspectOf();
    if (!inspect) return;
    if (arac === "sec" && sahiplen(secim, spec)) inspect.dataset.ogeler = "";
    else delete inspect.dataset.ogeler;
  }, [arac, secim, spec]);

  /* ---------------- sağ tık menüsü ---------------- */

  const menuEylemleri = (s: OgeSecimi): MenuEylem[] => {
    const olculen = olculenSira(spec);
    const bilgi = siraBoyutlari(spec, olculen).find((b) => b.boyut === s.boyut);
    const list: MenuEylem[] = [];
    if (bilgi && !bilgi.kapali) {
      const tasi = (yon: -1 | 1, uca: boolean) => () => onBirak((c) => adimla(c, s, yon, uca, olculen));
      list.push(
        { ad: "Başa taşı", kisayol: "Shift+←", ikon: ChevronsLeft, calistir: tasi(-1, true) },
        { ad: "Bir öne", kisayol: "←", ikon: ChevronLeft, calistir: tasi(-1, false) },
        { ad: "Bir arkaya", kisayol: "→", ikon: ChevronRight, calistir: tasi(1, false) },
        { ad: "Sona taşı", kisayol: "Shift+→", ikon: ChevronsRight, calistir: tasi(1, true) }
      );
      if (s.boyut === "oge") {
        list.push(
          { ad: "Büyükten küçüğe", ikon: ArrowDownWideNarrow, ayracOnce: true, calistir: () => onBirak((c) => siraModu(c, "desc")) },
          { ad: "Küçükten büyüğe", ikon: ArrowUpNarrowWide, calistir: () => onBirak((c) => siraModu(c, "asc")) },
          { ad: "A→Z", ikon: ArrowDownAZ, calistir: () => onBirak((c) => siraModu(c, "alpha")) },
          { ad: "Ters çevir", ikon: ArrowUpDown, calistir: () => onBirak((c) => tersCevir(c, "oge", { olculen })) },
          { ad: "Otomatik sıraya dön", ikon: RotateCcw, devreDisi: spec.options.sort === "none", calistir: () => onBirak((c) => siraModu(c, "none")) }
        );
      } else {
        list.push({ ad: "Ters çevir", ikon: ArrowUpDown, ayracOnce: true, calistir: () => onBirak((c) => tersCevir(c, s.boyut, { grup: s.grup })) });
        if (s.boyut === "seri") list.push({ ad: "Tablo sırasına dön", ikon: RotateCcw, calistir: () => onBirak(seriSifirla) });
      }
    }
    if (s.boyut === "oge" && vurguDestekli(spec)) {
      const h = spec.options.highlight;
      const vurgulu = s.anahtarlar.every((k) => h.includes(k));
      list.push({
        ad: vurgulu ? "Vurguyu kaldır" : "Vurgula",
        kisayol: "Alt+tık",
        ikon: Highlighter,
        ayracOnce: true,
        calistir: () =>
          onChange({
            ...spec,
            options: { ...spec.options, highlight: vurgulu ? h.filter((x) => !s.anahtarlar.includes(x)) : [...new Set([...h, ...s.anahtarlar])] },
          }),
      });
    }
    return list;
  };

  const ir = inspectOf()?.getBoundingClientRect();
  const cerceve = (k: Kutu, i: number, tur: keyof Cerceveler) => (
    <div
      key={`${tur}${i}`}
      className="sira-cerceve"
      data-tur={tur}
      style={{ left: k.l - 3, top: k.t - 3, width: k.r - k.l + 6, height: k.b - k.t + 6 }}
    />
  );

  return (
    <div ref={hostRef} className="sira-katmani" aria-hidden>
      {cerceveler.uzerinde.map((k, i) => cerceve(k, i, "uzerinde"))}
      {cerceveler.hedef.map((k, i) => cerceve(k, i, "hedef"))}
      {cerceveler.secili.map((k, i) => cerceve(k, i, "secili"))}
      {hayalet && ir && (
        <div className="sira-hayalet" style={{ left: hayalet.x - ir.left + 14, top: hayalet.y - ir.top + 14 }}>
          {hayalet.renk && <span className="sira-hayalet-renk" style={{ background: hayalet.renk }} />}
          {hayalet.ad}
        </div>
      )}
      {menu && <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri(menu.s)} onKapat={() => setMenu(null)} />}
    </div>
  );
}

/**
 * Hayalet etiketin rengi: öğenin sahnede boyandığı ilk somut dolgu. Pist gibi
 * tema değişkeniyle boyanan parçalar (`var(--…)`) öğenin rengi değil, atlanır.
 */
function kimlikRengi(kart: Element, h: OgeIsabeti, anahtar: string): string | null {
  const secici = h.gosterge
    ? `[data-part="legend"] [data-anahtar]`
    : h.boyut === "alt"
      ? "[data-alt]"
      : h.boyut === "seri"
        ? "[data-seri]"
        : "[data-oge], [data-category]";
  for (const el of kart.querySelectorAll<SVGElement | HTMLElement>(secici)) {
    const d = el.dataset;
    const k = h.gosterge ? d.anahtar : h.boyut === "alt" ? d.alt : h.boyut === "seri" ? d.seri : (d.oge ?? d.category);
    if (k !== anahtar) continue;
    for (const p of [el, ...el.querySelectorAll("[fill], [color]")]) {
      const renk = p.getAttribute("fill") ?? p.getAttribute("color");
      if (renk && renk !== "none" && !renk.startsWith("url(") && !renk.startsWith("var(")) return renk;
    }
    // Gösterge işareti HTML: rengi arka planında.
    const isaret = el.querySelector<HTMLElement>("[style*='background']");
    if (isaret?.style.backgroundColor) return isaret.style.backgroundColor;
  }
  return null;
}
