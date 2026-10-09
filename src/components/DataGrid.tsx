/**
 * Veri tablosu — Excel kası olan biri için.
 *
 * Kullanıcı yolculukları (her biri `scripts/veri-check.mjs`'te bir senaryo):
 *
 *  1. **Excel'den ilk tablo** — Excel'de aralığı kopyala, tabloya tıkla,
 *     `Ctrl+V`. Tablonun tamamı ilk hücreye geldiyse yerine konur; başlıklar
 *     yıl olsa bile (`Ürün | 2023 | 2024`) tanınır. Tahmin yanlışsa bildirim
 *     çubuğu tek tıkla çevirir.
 *  2. **Tek sütunu güncelle** — yeni dönemin sayılarını bir hücreye ya da
 *     sütuna yapıştır; fazlası satır ekler, eksikse alttaki eski satırları
 *     silmek bildirimde tek tık.
 *  3. **Yeni seri** — sütunu seç (başlığa tıkla) ve adıyla birlikte yapıştır.
 *  4. **Geri kopyala** — aralığı, sütunu ya da tamamını Excel'e (sekmeli
 *     metin) ve PowerPoint'e (HTML tablo) kopyala.
 *  5. **Hızlı düzelt** — tıkla-yaz, `Enter`/`Tab` ilerler, `Esc` vazgeçer,
 *     `F2`/çift tık içinde düzenler, `Del` temizler.
 *  6. **Satırları düzenle** — sağ tık, satır numarasından sürükle, `Alt+↑/↓`.
 *  7. **Sütunları düzenle** — sağ tık, seçili başlığı sürükle, `Alt+←/→`,
 *     sütuna göre sırala.
 *  8. **Kes-taşı**, 9. **hatalı hücreyi yakala** (sayı sütununda sayı
 *     olmayan kırmızı), 10. **doldur** (`Ctrl+D`, tek değeri seçime
 *     yapıştırmak), 11. **seçimi ölç** (durum çubuğunda toplam/ortalama).
 *
 * Hücreler düz metin; düzenleme yalnız tek hücrede açılan bir giriş kutusu.
 * Eskiden her hücre bir `<input>`'tu: oklar imleci yazının içinde
 * gezdiriyordu, çok hücreli seçim, aralık kopyalama ve `Del` ile temizleme
 * mümkün değildi, ve kopyalamanın tek yolu CSV indirmekti.
 *
 * Yazmak `onChange`'ten geçer (ardışık tuşlar tek geri al adımında
 * birleşir), yapıştırma, silme, taşıma gibi ayrık işlemler `onAdim`'den
 * (her biri ayrı adım). İşlemlerin kendisi `src/lib/tablo.ts`'te, seçimin
 * matematiği `src/lib/grid-selection.ts`'te — ikisi de saf ve birim testli.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";

import {
  ArrowDown,
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpAZ,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ClipboardList,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  Heading,
  ListX,
  MoreHorizontal,
  Pencil,
  Rows3,
  Scissors,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { BaglamMenusu, type MenuEylem } from "@/components/BaglamMenusu";
import { formatNumber, type NumberFormatSpec } from "@/lib/format";
import {
  aralik,
  araliktan,
  blokSonu,
  genislet,
  genisletTo,
  hepsi,
  hepsiMi,
  hucreSayisi,
  icinde,
  odakla,
  satirSecimi,
  sigdir,
  sutunSecimi,
  tasi,
  tekMi,
  tekSecim,
  type Boyut,
  type GridSecim,
} from "@/lib/grid-selection";
import { parseDelimited, toCsv } from "@/lib/parse";
import { columnRoles, columnTypes, sampleData, type ChartKind, type ColumnType, type TableData } from "@/lib/spec";
import { downloadText } from "@/lib/storage";
import {
  araligiAl,
  araligiTemizle,
  asagiDoldur,
  baslikMi,
  basligiSatiraIndir,
  bosSatirlariSil,
  devrik,
  doldur,
  hataliHucreler,
  htmlTablo,
  hucreOku,
  hucreYaz,
  ilkSatiriBaslikYap,
  rolleri,
  satirEkle,
  satirlariCogalt,
  satirlariKaydir,
  satirlariSil,
  satirlariTasi,
  secimOzeti,
  sutunEkle,
  sutunlariKaydir,
  sutunlariSil,
  sutunlariTasi,
  tabloSirala,
  tabloyuTemizle,
  tsv,
  yapistir,
} from "@/lib/tablo";
import { ESIK } from "@/lib/use-drag-order";

interface Props {
  kind: ChartKind;
  data: TableData;
  /** Yazarken — ardışık tuşlar tek geri al adımında birleşebilir. */
  onChange: (data: TableData) => void;
  /** Yapıştırma, silme, taşıma gibi ayrık işlemler — her biri ayrı geri al adımı. */
  onAdim?: (data: TableData) => void;
  /** Sayıları okumak (yerel) ve durum çubuğundaki toplamı yazmak için. */
  format: NumberFormatSpec;
}

interface Duzen {
  r: number;
  c: number;
  /** Düzenlemeden önceki değer — `Esc` buna döner. */
  ilk: string;
  /** `giris`: yazmaya başlayarak açıldı, oklar hücreden çıkar. `duzen`: F2/çift tık, oklar yazının içinde. */
  mod: "giris" | "duzen";
}

interface Bildirim {
  id: number;
  mesaj: string;
  eylemler?: { ad: string; calistir: () => void }[];
  /** Eylemler yalnız tablo hâlâ bu nesneyken geçerli — arada başka bir değişiklik olduysa düşer. */
  icin?: TableData;
}

type MenuTuru = "hucre" | "satir" | "sutun" | "arac";

const OKLAR: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

const TIP_ETIKET: Record<ColumnType, string> = { metin: "Aa", sayi: "#", tarih: "Tarih" };

const aralikDizisi = (a: number, z: number) => Array.from({ length: z - a + 1 }, (_, i) => a + i);

export function DataGrid({ kind, data, onChange, onAdim, format }: Props) {
  const roles = columnRoles(kind);
  const roller = useMemo(() => rolleri(kind), [kind]);
  const tipler = useMemo(() => columnTypes(kind, data.columns.length), [kind, data.columns.length]);
  const loc = format.locale;
  const b: Boyut = { satir: Math.max(1, data.rows.length), sutun: Math.max(1, data.columns.length) };
  const adim = onAdim ?? onChange;

  const [hamSecim, setSecim] = useState<GridSecim>(() => tekSecim(0, 0));
  const sec = sigdir(hamSecim, b);
  const a = aralik(sec, b);
  const [duzen, setDuzen] = useState<Duzen | null>(null);
  const [bildirim, setBildirim] = useState<Bildirim | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; tur: MenuTuru } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  /** Sürüklerken bırakılacak yer: satırlar ya da sütunlar arasındaki boşluk. */
  const [cizgi, setCizgi] = useState<{ tur: "satir" | "sutun"; bosluk: number } | null>(null);
  const kapRef = useRef<HTMLDivElement>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);
  /** Fare basılıyken hangi başlıkta sürükleyerek seçiliyor. */
  const secerken = useRef<"hucre" | "satir" | "sutun" | null>(null);
  /** Kullanıcı tabloda bir yer seçti mi — "+ Satır" seçimin altına mı, sona mı eklesin. */
  const kullanildi = useRef(false);

  const hatali = useMemo(() => hataliHucreler(data, kind, loc), [data, kind, loc]);
  const ozet = useMemo(() => secimOzeti(data, a, loc), [data, a.r0, a.r1, a.c0, a.c1, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  const secimiYap = (s: GridSecim) => {
    kullanildi.current = true;
    setSecim(s);
  };
  const kabaOdak = () => kapRef.current?.focus({ preventScroll: true });

  const bildir = useCallback((mesaj: string, eylemler?: Bildirim["eylemler"], icin?: TableData) => {
    setBildirim({ id: Date.now() + Math.random(), mesaj, eylemler, icin });
  }, []);
  useEffect(() => {
    if (!bildirim) return;
    const z = window.setTimeout(() => setBildirim((x) => (x?.id === bildirim.id ? null : x)), bildirim.eylemler?.length ? 12000 : 5000);
    return () => window.clearTimeout(z);
  }, [bildirim]);

  // Fare bırakılınca sürükleyerek seçim biter — tablonun dışında bırakılsa da.
  useEffect(() => {
    const bitti = () => (secerken.current = null);
    window.addEventListener("mouseup", bitti);
    return () => window.removeEventListener("mouseup", bitti);
  }, []);

  // Odak hücresi görünür alanda kalsın (klavyeyle gezerken, yapıştırınca).
  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;
    const el = kap.querySelector<HTMLElement>(`[data-r="${sec.focus.r}"][data-c="${sec.focus.c}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sec.focus.r, sec.focus.c]);

  const rolAdi = (c: number) => (c < roles.fixed.length ? roles.fixed[c] : `${roles.seriesLabel ?? "Sütun"} ${c - roles.fixed.length + 1}`);
  const sutunAdi = (c: number) => (data.columns[c] ?? "").trim() || rolAdi(c);

  /* ---------------- düzenleme ---------------- */

  const duzenBaslat = (r: number, c: number, mod: Duzen["mod"], ilkHarf?: string) => {
    setMenu(null);
    setDuzen({ r, c, ilk: hucreOku(data, r, c), mod });
    if (ilkHarf != null) onChange(hucreYaz(data, r, c, ilkHarf));
  };

  /** Odağı (r, c)'den taşır; `ekle`: son satırdan aşağı inmek yeni satır açar. */
  const hareket = (r: number, c: number, dr: number, dc: number, ekle: boolean) => {
    let nr = r + dr;
    let nc = c + dc;
    if (dc !== 0 && r >= 0) {
      // Tab satır sonunda bir alt satırın başına geçer.
      if (nc >= b.sutun) {
        nc = 0;
        nr = r + 1;
      } else if (nc < 0) {
        nc = b.sutun - 1;
        nr = Math.max(0, r - 1);
      }
    }
    if (nr >= b.satir) {
      if (!ekle) nr = b.satir - 1;
      else adim(satirEkle(data, b.satir, 1));
    }
    secimiYap(odakla(nr, nc, { satir: Math.max(b.satir, nr + 1), sutun: b.sutun }));
  };

  const duzenBitir = (yon: [number, number] | null, iptal = false) => {
    if (!duzen) return;
    const { r, c, ilk } = duzen;
    if (iptal) onChange(hucreYaz(data, r, c, ilk));
    setDuzen(null);
    if (yon) hareket(r, c, yon[0], yon[1], yon[0] > 0 && r === b.satir - 1);
    kabaOdak();
  };

  const girisTusu = (e: KeyboardEvent<HTMLInputElement>) => {
    const dur = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "Enter") {
      dur();
      return duzenBitir([e.shiftKey ? -1 : 1, 0]);
    }
    if (e.key === "Tab") {
      dur();
      return duzenBitir([0, e.shiftKey ? -1 : 1]);
    }
    if (e.key === "Escape") {
      dur();
      return duzenBitir(null, true);
    }
    if (duzen?.mod === "giris" && OKLAR[e.key] && !e.shiftKey) {
      dur();
      return duzenBitir(OKLAR[e.key]);
    }
  };

  /* ---------------- pano ---------------- */

  const panoyaYaz = async (m: string[][], baslik: boolean): Promise<boolean> => {
    const duz = tsv(m);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([duz], { type: "text/plain" }),
          "text/html": new Blob([htmlTablo(m, baslik)], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch {
      try {
        await navigator.clipboard.writeText(duz);
        return true;
      } catch {
        return false;
      }
    }
  };

  /**
   * Yapıştırmanın kuralları — kullanıcının nereyi seçtiğine göre:
   * tek değer + çok hücre → doldur; tüm tablo seçili ya da tablonun tamamı
   * (başlığıyla) ilk hücreye → yerine koy; sütun seçili → başlığından
   * itibaren; aksi hâlde seçimin sol üstünden itibaren üzerine yaz.
   */
  const yapistirMetin = (metin: string, hedefHucre?: { r: number; c: number }, taban: TableData = data) => {
    const m = parseDelimited(metin);
    if (m.length === 0) return;
    const genislik = Math.max(...m.map((r) => r.length));
    if (!hedefHucre && m.length === 1 && genislik === 1 && !tekMi(sec)) {
      const yeni = doldur(taban, a, m[0][0]);
      adim(yeni);
      bildir(`${hucreSayisi(sec, b)} hücre "${m[0][0]}" ile dolduruldu`);
      return;
    }
    const hedef = hedefHucre ?? { r: sec.mod === "sutun" ? -1 : a.r0, c: a.c0 };
    const tumTablo = !hedefHucre && (hepsiMi(sec, b) || (hedef.r <= 0 && hedef.c === 0 && sec.mod !== "sutun" && baslikMi(m, loc)));
    const uygula = (baslik: boolean | "oto") => yapistir(taban, m, hedef, roller, { tumTablo, baslik, locale: loc });
    const sonuc = uygula("oto");
    const sonucuSec = (s: typeof sonuc) =>
      secimiYap(araliktan(s.aralik, { satir: Math.max(1, s.tablo.rows.length), sutun: Math.max(1, s.tablo.columns.length) }));
    adim(sonuc.tablo);
    sonucuSec(sonuc);

    const parcalar = [
      tumTablo
        ? `Tablo yerine kondu: ${sonuc.tablo.rows.length} satır, ${sonuc.tablo.columns.length} sütun`
        : `${m.length}×${genislik} hücre yapıştırıldı`,
    ];
    if (!tumTablo && sonuc.eklenenSatir > 0) parcalar.push(`${sonuc.eklenenSatir} satır eklendi`);
    if (!tumTablo && sonuc.eklenenSutun > 0) parcalar.push(`${sonuc.eklenenSutun} seri eklendi`);
    if (sonuc.sigmayan > 0) parcalar.push(`${sonuc.sigmayan} sütun bu grafiğe sığmadı`);
    if (sonuc.baslik != null && m.length > 1) parcalar.push(sonuc.baslik ? "ilk satır başlık" : "ilk satır veri");
    const eylemler: NonNullable<Bildirim["eylemler"]> = [];
    if (sonuc.baslik != null && m.length > 1) {
      eylemler.push({
        ad: sonuc.baslik ? "İlk satır veriydi" : "İlk satır başlıktı",
        calistir: () => {
          const ters = uygula(!sonuc.baslik);
          adim(ters.tablo);
          sonucuSec(ters);
          bildir(ters.baslik ? "İlk satır başlık yapıldı" : "İlk satır veriye indi");
        },
      });
    }
    if (!tumTablo && sonuc.kalan > 0) {
      const kalan = sonuc.kalan;
      eylemler.push({
        ad: `Alttaki ${kalan} eski satırı sil`,
        calistir: () => {
          const ilk = sonuc.aralik.r1 + 1;
          adim(satirlariSil(sonuc.tablo, aralikDizisi(ilk, ilk + kalan - 1)));
          bildir(`${kalan} eski satır silindi`);
        },
      });
    }
    bildir(parcalar.join(" · "), eylemler, sonuc.tablo);
  };

  const kopyalaOlay = (e: ClipboardEvent<HTMLDivElement>, kes: boolean) => {
    if (duzen) return; // giriş kutusundaki yazının kendi kopyası
    e.preventDefault();
    const m = araligiAl(data, a);
    e.clipboardData.setData("text/plain", tsv(m));
    e.clipboardData.setData("text/html", htmlTablo(m, a.baslik));
    const n = hucreSayisi(sec, b);
    if (kes) {
      adim(araligiTemizle(data, a));
      bildir(`${n} hücre kesildi — hedefi seçip Ctrl+V`);
    } else bildir(`${n} hücre kopyalandı${a.baslik ? " (sütun adlarıyla)" : ""}`);
  };

  const yapistirOlay = (e: ClipboardEvent<HTMLDivElement>) => {
    const metin = e.clipboardData.getData("text/plain");
    if (duzen) {
      // Tek değer yazının içine; bir blok ise hücreden itibaren tabloya.
      if (!/[\t\n]/.test(metin.replace(/[\r\n]+$/, ""))) return;
      e.preventDefault();
      const { r, c, ilk } = duzen;
      setDuzen(null);
      kabaOdak();
      yapistirMetin(metin, { r, c }, hucreYaz(data, r, c, ilk));
      return;
    }
    e.preventDefault();
    yapistirMetin(metin);
  };

  const panodanYapistir = async (alta = false) => {
    try {
      const metin = await navigator.clipboard.readText();
      if (!metin.trim()) return bildir("Pano boş");
      kabaOdak();
      if (alta) yapistirMetin(metin, { r: data.rows.length, c: 0 });
      else yapistirMetin(metin);
    } catch {
      setPasteOpen(true);
      bildir("Tarayıcı panoyu okumaya izin vermedi — metni kutuya yapıştırın (Ctrl+V)");
    }
  };

  /* ---------------- işlemler ---------------- */

  const seciliSatirlar = () => aralikDizisi(a.r0, a.r1);
  const seciliSutunlar = () => aralikDizisi(a.c0, a.c1);
  const seriSecili = roller.seriEklenir && a.c0 >= roller.sabit;

  const temizle = () => {
    adim(araligiTemizle(data, a));
  };

  const satirlariEkle = (yer: "ust" | "alt") => {
    const n = sec.mod === "satir" ? a.r1 - a.r0 + 1 : 1;
    const at = yer === "ust" ? a.r0 : a.r1 + 1;
    adim(satirEkle(data, at, n));
    secimiYap(satirSecimi(at, { satir: b.satir + n, sutun: b.sutun }, at + n - 1));
  };

  const satirlariSilEylem = () => {
    const sil = seciliSatirlar();
    adim(satirlariSil(data, sil));
    secimiYap(odakla(Math.min(a.r0, Math.max(0, b.satir - sil.length - 1)), sec.mod === "satir" ? 0 : a.c0, b));
    bildir(`${sil.length} satır silindi`, undefined);
  };

  const satirlariCogaltEylem = () => {
    const { tablo, yeni } = satirlariCogalt(data, seciliSatirlar());
    if (yeni.length === 0) return;
    adim(tablo);
    secimiYap(satirSecimi(yeni[0], { satir: tablo.rows.length, sutun: b.sutun }, yeni[yeni.length - 1]));
  };

  const satirlariKaydirEylem = (yon: -1 | 1) => {
    const { tablo, yeni } = satirlariKaydir(data, seciliSatirlar(), yon);
    if (tablo === data || yeni.length === 0) return;
    adim(tablo);
    secimiYap(
      sec.mod === "satir"
        ? satirSecimi(yeni[0], b, yeni[yeni.length - 1])
        : araliktan({ r0: yeni[0], r1: yeni[yeni.length - 1], c0: a.c0, c1: a.c1 }, b)
    );
  };

  const sutunEkleEylem = (yer: "sol" | "sag") => {
    if (!roller.seriEklenir) return;
    const at = yer === "sol" ? Math.max(roller.sabit, a.c0) : Math.max(roller.sabit, a.c1 + 1);
    adim(sutunEkle(data, at, roller));
    secimiYap(sutunSecimi(at, { satir: b.satir, sutun: b.sutun + 1 }));
  };

  const sutunlariSilEylem = () => {
    const sil = seciliSutunlar().filter((c) => c >= roller.sabit);
    const yeni = sutunlariSil(data, sil, roller);
    if (yeni === data) return bildir("Bu sütun silinemez: grafiğin en az bir serisi kalmalı, sabit sütunlar silinmez");
    adim(yeni);
    secimiYap(sutunSecimi(Math.max(roller.sabit, a.c0 - 1), { satir: b.satir, sutun: yeni.columns.length }));
  };

  const sutunlariKaydirEylem = (yon: -1 | 1) => {
    const { tablo, yeni } = sutunlariKaydir(data, seciliSutunlar(), yon, roller);
    if (tablo === data || yeni.length === 0) return;
    adim(tablo);
    secimiYap(sutunSecimi(yeni[0], b, yeni[yeni.length - 1]));
  };

  const siralaEylem = (yon: 1 | -1) => {
    const c = sec.focus.c;
    adim(tabloSirala(data, c, yon, loc));
    bildir(`Tablo "${sutunAdi(c)}" sütununa göre ${yon > 0 ? "artan" : "azalan"} sıralandı — grafikteki sıra ayrı (sağ panel → Sıra)`);
  };

  const asagiDoldurEylem = () => adim(asagiDoldur(data, a));

  const kopyalaEylem = async (kes: boolean) => {
    const m = araligiAl(data, a);
    const ok = await panoyaYaz(m, a.baslik);
    if (!ok) return bildir("Tarayıcı panoya yazmaya izin vermedi — Ctrl+C kullanın");
    if (kes) adim(araligiTemizle(data, a));
    bildir(`${hucreSayisi(sec, b)} hücre ${kes ? "kesildi" : "kopyalandı"}`);
  };

  const tabloyuKopyala = async () => {
    const m = araligiAl(data, { r0: 0, r1: data.rows.length - 1, c0: 0, c1: data.columns.length - 1, baslik: true });
    const ok = await panoyaYaz(m, true);
    bildir(ok ? `Tablo panoya kopyalandı (${data.rows.length} satır, sütun adlarıyla) — Excel'e ya da PowerPoint'e yapıştırın` : "Tarayıcı panoya yazmaya izin vermedi");
  };

  const satirEkleArac = () => {
    const at = kullanildi.current ? a.r1 + 1 : data.rows.length;
    adim(satirEkle(data, at, 1));
    secimiYap(odakla(at, 0, { satir: b.satir + 1, sutun: b.sutun }));
    kabaOdak();
  };

  const seriEkleArac = () => {
    const at = kullanildi.current && seriSecili ? a.c1 + 1 : data.columns.length;
    adim(sutunEkle(data, at, roller));
    secimiYap(sutunSecimi(at, { satir: b.satir, sutun: b.sutun + 1 }));
    kabaOdak();
    bildir("Yeni seri eklendi — adını yazmak için yazmaya başlayın, değerleri sütuna yapıştırın");
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj?.columns) && Array.isArray(obj?.rows)) {
          adim({ columns: obj.columns.map(String), rows: obj.rows.map((r: unknown[]) => r.map(String)) });
          return;
        }
        if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === "object") {
          const cols = Object.keys(obj[0]);
          adim({ columns: cols, rows: obj.map((o: Record<string, unknown>) => cols.map((k) => String(o[k] ?? ""))) });
          return;
        }
      } catch {
        /* düz metne düş */
      }
    }
    const s = yapistir(data, parseDelimited(text), { r: 0, c: 0 }, roller, { tumTablo: true, baslik: "oto", locale: loc });
    adim(s.tablo);
    bildir(`${file.name} yüklendi: ${s.tablo.rows.length} satır`);
  };

  /** `Alt`+ok: satırları yukarı/aşağı, seri sütunlarını sola/sağa taşır. */
  const tasimaKisayolu = (dr: number, dc: number) => {
    if (dr !== 0 && sec.mod !== "sutun") satirlariKaydirEylem(dr < 0 ? -1 : 1);
    else if (dc !== 0 && (sec.mod === "sutun" || seriSecili)) sutunlariKaydirEylem(dc < 0 ? -1 : 1);
  };

  /* ---------------- klavye ---------------- */

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (duzen || e.target !== kapRef.current) return; // giriş kutusu kendi tuşlarını işliyor
    const ctrl = e.ctrlKey || e.metaKey;
    const dur = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const ok = OKLAR[e.key];
    if (ok) {
      dur();
      setMenu(null);
      const [dr, dc] = ok;
      if (e.altKey) return tasimaKisayolu(dr, dc);
      if (ctrl) {
        const h = blokSonu(data.rows, Math.max(0, sec.focus.r), sec.focus.c, dr, dc, b);
        return secimiYap(e.shiftKey ? genisletTo(sec, h.r, h.c, b) : odakla(h.r, h.c, b));
      }
      return secimiYap(e.shiftKey ? genislet(sec, dr, dc, b) : tasi(sec, dr, dc, b));
    }
    switch (e.key) {
      case "Tab": {
        dur();
        const sonHucre = sec.focus.r === b.satir - 1 && sec.focus.c === b.sutun - 1;
        return hareket(sec.focus.r, sec.focus.c, 0, e.shiftKey ? -1 : 1, !e.shiftKey && sonHucre);
      }
      case "Enter":
        dur();
        return hareket(sec.focus.r, sec.focus.c, e.shiftKey ? -1 : 1, 0, false);
      case "Home":
        dur();
        return secimiYap(ctrl ? odakla(0, 0, b) : odakla(sec.focus.r, 0, b));
      case "End":
        dur();
        return secimiYap(ctrl ? odakla(b.satir - 1, b.sutun - 1, b) : odakla(sec.focus.r, b.sutun - 1, b));
      case "PageDown":
      case "PageUp": {
        dur();
        const d = e.key === "PageDown" ? 10 : -10;
        return secimiYap(e.shiftKey ? genislet(sec, d, 0, b) : tasi(sec, d, 0, b));
      }
      case "F2":
        dur();
        return duzenBaslat(sec.focus.r, sec.focus.c, "duzen");
      case "Delete":
      case "Backspace":
        dur();
        return temizle();
      case "Escape":
        // Çok hücreli seçim tek hücreye iner; tek hücredeyken Esc üste gider
        // (tam ekran veri panelini kapatır, sahnedeki seçimi bir üste taşır).
        if (menu) {
          dur();
          return setMenu(null);
        }
        if (!tekMi(sec)) {
          dur();
          return secimiYap(odakla(sec.focus.r, sec.focus.c, b));
        }
        return;
    }
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "a") {
        dur();
        return secimiYap(hepsi(b));
      }
      if (k === "d") {
        dur();
        return asagiDoldurEylem();
      }
      return; // Ctrl+C/X/V kopyala/kes/yapıştır olayları; Ctrl+Z/Y uygulamanın geri alması
    }
    if (!ctrl && !e.altKey && e.key.length === 1) {
      dur();
      duzenBaslat(sec.focus.r, sec.focus.c, "giris", e.key);
    }
  };

  /* ---------------- fare ---------------- */

  const duzeniKapat = (r?: number, c?: number) => {
    if (duzen && (duzen.r !== r || duzen.c !== c)) setDuzen(null);
  };

  const hucreBasis = (e: ReactMouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    if (duzen?.r === r && duzen.c === c) return; // düzenlenen kutunun içinde imleç
    duzeniKapat(r, c);
    e.preventDefault();
    kabaOdak();
    setMenu(null);
    secerken.current = "hucre";
    secimiYap(e.shiftKey ? genisletTo(sec, r, c, b) : odakla(r, c, b));
  };

  /**
   * Satır numarası ya da sütun başlığından sürüklemek. Basılan satır (sütun)
   * zaten seçiliyse blok taşınır — Google E-Tablolar'daki gibi; değilse önce
   * seçilir ve sürüklemek seçimi genişletir.
   */
  const surukle = (e: ReactMouseEvent, tur: "satir" | "sutun", blok: number[], tiklanan: number) => {
    const kap = kapRef.current;
    if (!kap || blok.length === 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const yuvalar =
      tur === "satir"
        ? [...kap.querySelectorAll<HTMLElement>("tbody tr[data-satir]")].map((el) => {
            const r = el.getBoundingClientRect();
            return (r.top + r.bottom) / 2;
          })
        : [...kap.querySelectorAll<HTMLElement>("thead th[data-c]")].map((el) => {
            const r = el.getBoundingClientRect();
            return (r.left + r.right) / 2;
          });
    let canli = false;
    let bosluk: number | null = null;
    const tasiFare = (ev: MouseEvent) => {
      if (!canli && Math.hypot(ev.clientX - x0, ev.clientY - y0) < ESIK) return;
      canli = true;
      document.body.classList.add("suruklerken");
      const p = tur === "satir" ? ev.clientY : ev.clientX;
      let g = yuvalar.filter((m) => m < p).length;
      if (tur === "sutun") g = Math.max(roller.sabit, g);
      bosluk = g;
      setCizgi({ tur, bosluk: g });
    };
    const birak = () => {
      window.removeEventListener("mousemove", tasiFare);
      window.removeEventListener("mouseup", birak);
      document.body.classList.remove("suruklerken");
      setCizgi(null);
      if (!canli) {
        secimiYap(tur === "satir" ? satirSecimi(tiklanan, b) : sutunSecimi(tiklanan, b));
        return;
      }
      if (bosluk == null || (bosluk >= blok[0] && bosluk <= blok[blok.length - 1] + 1)) return;
      if (tur === "satir") {
        const { tablo, yeni } = satirlariTasi(data, blok, bosluk);
        adim(tablo);
        secimiYap(satirSecimi(yeni[0], b, yeni[yeni.length - 1]));
        bildir(`${blok.length} satır taşındı`);
      } else {
        const { tablo, yeni } = sutunlariTasi(data, blok, bosluk, roller);
        if (yeni.length === 0) return;
        adim(tablo);
        secimiYap(sutunSecimi(yeni[0], b, yeni[yeni.length - 1]));
      }
    };
    window.addEventListener("mousemove", tasiFare);
    window.addEventListener("mouseup", birak);
  };

  const satirBasis = (e: ReactMouseEvent, r: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    duzeniKapat();
    kabaOdak();
    setMenu(null);
    const seciliMi = sec.mod === "satir" && r >= a.r0 && r <= a.r1;
    if (seciliMi && !e.shiftKey) return surukle(e, "satir", seciliSatirlar(), r);
    secerken.current = "satir";
    secimiYap(e.shiftKey && sec.mod === "satir" ? genisletTo(sec, r, 0, b) : satirSecimi(r, b));
  };

  const sutunBasis = (e: ReactMouseEvent, c: number) => {
    if (e.button !== 0) return;
    if (duzen?.r === -1 && duzen.c === c) return;
    e.preventDefault();
    duzeniKapat();
    kabaOdak();
    setMenu(null);
    const seciliMi = sec.mod === "sutun" && c >= a.c0 && c <= a.c1;
    const tasinir = roller.seriEklenir && c >= roller.sabit;
    if (seciliMi && !e.shiftKey && tasinir) return surukle(e, "sutun", seciliSutunlar().filter((x) => x >= roller.sabit), c);
    secerken.current = "sutun";
    secimiYap(e.shiftKey && sec.mod === "sutun" ? genisletTo(sec, -1, c, b) : sutunSecimi(c, b));
  };

  const menuAc = (e: ReactMouseEvent, tur: MenuTuru, yeniSecim: GridSecim | null) => {
    e.preventDefault();
    duzeniKapat();
    if (yeniSecim) secimiYap(yeniSecim);
    kabaOdak();
    setMenu({ x: e.clientX, y: e.clientY, tur });
  };

  /* ---------------- menüler ---------------- */

  const menuEylemleri = (tur: MenuTuru): MenuEylem[] => {
    const kesKopyala: MenuEylem[] = [
      { ad: "Kes", kisayol: "Ctrl+X", ikon: Scissors, calistir: () => void kopyalaEylem(true) },
      { ad: "Kopyala", kisayol: "Ctrl+C", ikon: Copy, calistir: () => void kopyalaEylem(false) },
      { ad: "Yapıştır", kisayol: "Ctrl+V", ikon: ClipboardPaste, calistir: () => void panodanYapistir() },
      { ad: "Temizle", kisayol: "Del", ikon: Eraser, calistir: temizle },
    ];
    const satirIslem: MenuEylem[] = [
      { ad: "Üstüne satır ekle", ikon: BetweenHorizontalStart, ayracOnce: true, calistir: () => satirlariEkle("ust") },
      { ad: "Altına satır ekle", ikon: BetweenHorizontalEnd, calistir: () => satirlariEkle("alt") },
      { ad: "Satırı çoğalt", ikon: CopyPlus, calistir: satirlariCogaltEylem },
      { ad: "Yukarı taşı", kisayol: "Alt+↑", ikon: ArrowUp, devreDisi: a.r0 === 0, calistir: () => satirlariKaydirEylem(-1) },
      { ad: "Aşağı taşı", kisayol: "Alt+↓", ikon: ArrowDown, devreDisi: a.r1 >= b.satir - 1, calistir: () => satirlariKaydirEylem(1) },
      { ad: a.r1 > a.r0 ? `${a.r1 - a.r0 + 1} satırı sil` : "Satırı sil", ikon: Trash2, tehlike: true, calistir: satirlariSilEylem },
    ];
    const seriIslem: MenuEylem[] = roller.seriEklenir
      ? [
          { ad: "Soluna seri ekle", ikon: BetweenVerticalStart, ayracOnce: true, devreDisi: a.c0 < roller.sabit, calistir: () => sutunEkleEylem("sol") },
          { ad: "Sağına seri ekle", ikon: BetweenVerticalEnd, calistir: () => sutunEkleEylem("sag") },
        ]
      : [];
    switch (tur) {
      case "hucre":
        return [...kesKopyala, { ad: "Aşağı doldur", kisayol: "Ctrl+D", ikon: ArrowDownToLine, calistir: asagiDoldurEylem }, ...satirIslem, ...seriIslem];
      case "satir":
        return [...satirIslem.map((x, i) => (i === 0 ? { ...x, ayracOnce: false } : x)), { ...kesKopyala[0], ayracOnce: true }, ...kesKopyala.slice(1)];
      case "sutun":
        return [
          { ad: "Yeniden adlandır", kisayol: "F2", ikon: Pencil, calistir: () => duzenBaslat(-1, sec.focus.c, "duzen") },
          ...kesKopyala.slice(1).map((x, i) => (i === 0 ? { ...x, ayracOnce: true } : x)),
          { ad: "Küçükten büyüğe sırala", ikon: ArrowDownAZ, ayracOnce: true, calistir: () => siralaEylem(1) },
          { ad: "Büyükten küçüğe sırala", ikon: ArrowUpAZ, calistir: () => siralaEylem(-1) },
          ...(seriSecili
            ? [
                ...seriIslem,
                { ad: "Sola taşı", kisayol: "Alt+←", ikon: ArrowLeft, devreDisi: a.c0 <= roller.sabit, calistir: () => sutunlariKaydirEylem(-1) },
                { ad: "Sağa taşı", kisayol: "Alt+→", ikon: ArrowRight, devreDisi: a.c1 >= b.sutun - 1, calistir: () => sutunlariKaydirEylem(1) },
                { ad: a.c1 > a.c0 ? `${a.c1 - a.c0 + 1} seriyi sil` : "Seriyi sil", ikon: Trash2, tehlike: true, calistir: sutunlariSilEylem },
              ]
            : seriIslem.slice(1).map((x) => ({ ...x, ayracOnce: true }))),
        ];
      case "arac":
        return [
          { ad: "CSV / JSON yükle…", ikon: Upload, calistir: () => dosyaRef.current?.click() },
          { ad: "CSV indir", ikon: Download, calistir: () => downloadText("veri.csv", toCsv(data.columns, data.rows), "text/csv") },
          { ad: "Metin yapıştır…", ikon: ClipboardList, calistir: () => setPasteOpen(true) },
          { ad: "Panodakini alta ekle", ikon: Rows3, calistir: () => void panodanYapistir(true) },
          { ad: "İlk satırı başlık yap", ikon: Heading, ayracOnce: true, calistir: () => adim(ilkSatiriBaslikYap(data)) },
          { ad: "Başlığı ilk satıra indir", ikon: ArrowDown, calistir: () => adim(basligiSatiraIndir(data, roller)) },
          ...(roller.seriEklenir
            ? [{ ad: "Satır ↔ sütun çevir", ikon: ArrowLeftRight, calistir: () => (adim(devrik(data, roller)), bildir("Tablo devrildi: satırlar seri, seriler satır oldu")) }]
            : []),
          { ad: "Boş satırları sil", ikon: ListX, ayracOnce: true, calistir: () => adim(bosSatirlariSil(data)) },
          { ad: "Tabloyu temizle", ikon: Eraser, tehlike: true, calistir: () => adim(tabloyuTemizle(data)) },
          { ad: "Örnek veriyi yükle", ikon: X, tehlike: true, calistir: () => adim(sampleData(kind)) },
        ];
    }
  };

  /* ---------------- durum çubuğu ---------------- */

  const secimEtiketi = (() => {
    if (sec.mod === "sutun") return hepsiMi(sec, b) ? "Tüm tablo" : a.c0 === a.c1 ? `"${sutunAdi(a.c0)}" sütunu` : `${a.c1 - a.c0 + 1} sütun`;
    if (sec.mod === "satir") return a.r0 === a.r1 ? `${a.r0 + 1}. satır` : `${a.r0 + 1}–${a.r1 + 1}. satırlar`;
    if (tekMi(sec)) return `${sutunAdi(sec.focus.c)} · ${sec.focus.r + 1}. satır`;
    return `${a.r1 - a.r0 + 1}×${a.c1 - a.c0 + 1} hücre`;
  })();
  const ondalikli = { ...format, decimals: Math.max(format.decimals, 1), compact: false };
  const ilkHata = () => {
    const [r, c] = [...hatali][0].split(":").map(Number);
    secimiYap(odakla(r, c, b));
    kabaOdak();
  };
  const hataTuru = [...hatali].some((k) => tipler[Number(k.split(":")[1])] === "tarih") ? "tarih ya da sayı değil" : "sayı değil";

  /* ---------------- çizim ---------------- */

  const duzenlenen = (r: number, c: number) => duzen != null && duzen.r === r && duzen.c === c;
  const giris = (r: number, c: number) => (
    <HucreGiris
      deger={hucreOku(data, r, c)}
      sag={r >= 0 && tipler[c] === "sayi"}
      onDeger={(v) => onChange(hucreYaz(data, r, c, v))}
      onTus={girisTusu}
      onBlur={() => setDuzen(null)}
    />
  );
  const sonSatir = data.rows.length - 1;
  const sonSutun = data.columns.length - 1;
  const satirCizgisi = (r: number) =>
    cizgi?.tur !== "satir" ? undefined : cizgi.bosluk === r ? "once" : cizgi.bosluk === sonSatir + 1 && r === sonSatir ? "sonra" : undefined;
  const sutunCizgisi = (c: number) =>
    cizgi?.tur !== "sutun" ? undefined : cizgi.bosluk === c ? "once" : cizgi.bosluk === sonSutun + 1 && c === sonSutun ? "sonra" : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-sm" data-act="satir-ekle" title="Seçimin altına satır ekle (sağ tık: üstüne, çoğalt, taşı)" onClick={satirEkleArac}>
          + Satır
        </button>
        {roller.seriEklenir && (
          <button className="btn btn-sm" data-act="seri-ekle" title="Seçimin sağına yeni seri sütunu" onClick={seriEkleArac}>
            + Seri
          </button>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <button className="btn btn-sm" data-act="tablo-kopyala" title="Tabloyu sütun adlarıyla panoya kopyala — Excel'e ya da PowerPoint'e yapıştırılır" onClick={() => void tabloyuKopyala()}>
          <Copy size={12} />
          <span className="arac-yazi">Kopyala</span>
        </button>
        <button className="btn btn-sm" data-act="panodan-yapistir" title="Panodakini seçili hücreye yapıştır (tabloda Ctrl+V)" onClick={() => void panodanYapistir()}>
          <ClipboardPaste size={12} />
          <span className="arac-yazi">Yapıştır</span>
        </button>
        <button
          className="icon-btn"
          data-act="veri-menu"
          aria-label="Diğer veri işlemleri"
          title="Diğer: yükle, indir, başlık satırı, devrik, temizle"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.left, y: r.bottom + 4, tur: "arac" });
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        <input
          ref={dosyaRef}
          type="file"
          accept=".csv,.tsv,.txt,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {bildirim && (
        <div className="veri-bildirim" role="status" data-bildirim>
          <span className="grow">{bildirim.mesaj}</span>
          {bildirim.icin === data &&
            bildirim.eylemler?.map((x) => (
              <button key={x.ad} type="button" className="btn btn-sm" onClick={x.calistir}>
                {x.ad}
              </button>
            ))}
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => setBildirim(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {pasteOpen && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted p-2">
          <textarea
            className="inp font-mono text-[11px]"
            rows={6}
            autoFocus
            placeholder={"Excel'den kopyalayıp buraya yapıştırın.\nİlk satır başlık olabilir; sütunlar sekme, ; veya , ile ayrılır."}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              className="btn btn-sm btn-primary"
              disabled={!pasteText.trim()}
              onClick={() => {
                const s = yapistir(data, parseDelimited(pasteText), { r: 0, c: 0 }, roller, { tumTablo: true, baslik: "oto", locale: loc });
                adim(s.tablo);
                bildir(`Tablo yerine kondu: ${s.tablo.rows.length} satır`);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Tabloyu değiştir
            </button>
            <button
              className="btn btn-sm"
              disabled={!pasteText.trim()}
              onClick={() => {
                yapistirMetin(pasteText);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Seçili hücreye
            </button>
            <button
              className="btn btn-sm"
              disabled={!pasteText.trim()}
              onClick={() => {
                yapistirMetin(pasteText, { r: data.rows.length, c: 0 });
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Alta ekle
            </button>
            <button className="btn btn-sm" onClick={() => setPasteOpen(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      <div
        ref={kapRef}
        className="grid-wrap veri-izgara min-h-0 flex-1"
        tabIndex={0}
        role="grid"
        aria-label="Veri tablosu"
        aria-rowcount={data.rows.length + 1}
        aria-colcount={data.columns.length}
        data-duzen={duzen ? "" : undefined}
        onKeyDown={onKeyDown}
        onCopy={(e) => kopyalaOlay(e, false)}
        onCut={(e) => kopyalaOlay(e, true)}
        onPaste={yapistirOlay}
      >
        <table className="grid-table">
          <thead>
            <tr>
              <th
                className="kose"
                title="Tümünü seç (Ctrl+A)"
                aria-selected={hepsiMi(sec, b)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  duzeniKapat();
                  kabaOdak();
                  secimiYap(hepsi(b));
                }}
              />
              {data.columns.map((ad, c) => {
                const seriMi = roller.seriEklenir && c >= roller.sabit;
                return (
                  <th
                    key={c}
                    data-r={-1}
                    data-c={c}
                    data-tip={tipler[c]}
                    data-seri={seriMi || undefined}
                    data-cizgi={sutunCizgisi(c)}
                    aria-selected={icinde(sec, -1, c, b)}
                    data-odak={sec.mod === "sutun" && sec.focus.c === c ? "" : undefined}
                    title={`${rolAdi(c)} · tıkla: sütunu seç${seriMi ? ", seçiliyken sürükle: taşı" : ""} · çift tık: adını değiştir · sağ tık: işlemler`}
                    onMouseDown={(e) => sutunBasis(e, c)}
                    onMouseEnter={() => secerken.current === "sutun" && setSecim((s) => genisletTo(sigdir(s, b), -1, c, b))}
                    onDoubleClick={() => duzenBaslat(-1, c, "duzen")}
                    onContextMenu={(e) =>
                      menuAc(e, "sutun", sec.mod === "sutun" && c >= a.c0 && c <= a.c1 ? null : sutunSecimi(c, b))
                    }
                  >
                    {duzenlenen(-1, c) ? (
                      giris(-1, c)
                    ) : (
                      <span className="sutun-baslik">
                        <span className={ad.trim() ? "hucre-yazi" : "hucre-yazi yer-tutucu"}>{ad.trim() || rolAdi(c)}</span>
                        <span className="tip-isaret" aria-hidden>
                          {TIP_ETIKET[tipler[c]]}
                        </span>
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r} data-satir={r} data-cizgi={satirCizgisi(r)}>
                <td
                  className="rownum"
                  aria-selected={sec.mod === "satir" && r >= a.r0 && r <= a.r1}
                  title="Tıkla: satırı seç · seçiliyken sürükle: taşı · sağ tık: işlemler"
                  onMouseDown={(e) => satirBasis(e, r)}
                  onMouseEnter={() => secerken.current === "satir" && setSecim((s) => genisletTo(sigdir(s, b), r, 0, b))}
                  onContextMenu={(e) => menuAc(e, "satir", sec.mod === "satir" && r >= a.r0 && r <= a.r1 ? null : satirSecimi(r, b))}
                >
                  {r + 1}
                </td>
                {data.columns.map((_, c) => {
                  const v = row[c] ?? "";
                  const hata = hatali.has(`${r}:${c}`);
                  return (
                    <td
                      key={c}
                      data-r={r}
                      data-c={c}
                      className={tipler[c] === "sayi" ? "num" : undefined}
                      aria-selected={icinde(sec, r, c, b)}
                      data-odak={sec.mod !== "sutun" && sec.focus.r === r && sec.focus.c === c ? "" : undefined}
                      data-hatali={hata || undefined}
                      data-cizgi={sutunCizgisi(c)}
                      title={hata ? (tipler[c] === "tarih" ? "Tarih okunamadı" : "Sayı okunamadı") : v.length > 16 ? v : undefined}
                      onMouseDown={(e) => hucreBasis(e, r, c)}
                      onMouseEnter={() => secerken.current === "hucre" && setSecim((s) => genisletTo(sigdir(s, b), r, c, b))}
                      onDoubleClick={() => duzenBaslat(r, c, "duzen")}
                      onContextMenu={(e) => menuAc(e, "hucre", icinde(sec, r, c, b) ? null : odakla(r, c, b))}
                    >
                      {duzenlenen(r, c) ? giris(r, c) : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="veri-durum" aria-live="polite">
        <span className="truncate" data-secim-etiketi>
          {secimEtiketi}
        </span>
        {ozet.sayi >= 2 && (
          <span className="tabular-nums" data-secim-ozeti>
            Toplam {formatNumber(ozet.toplam, format)} · Ort. {formatNumber(ozet.ortalama ?? 0, ondalikli)}
          </span>
        )}
        {hatali.size > 0 && (
          <button type="button" className="veri-hata" data-hata-sayisi={hatali.size} onClick={ilkHata} title="İlk hatalı hücreye git">
            {hatali.size} hücre {hataTuru}
          </button>
        )}
        <span className={hatali.size > 0 ? "shrink-0 tabular-nums" : "ml-auto shrink-0 tabular-nums"} data-boyut-ozeti>
          {data.rows.length} satır · {data.columns.length} sütun
        </span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {kind === "heatmap"
          ? "Tarih: 2025-03-14, 14.03.2025 veya 14/03/2025. Aynı güne düşen satırlar toplanır."
          : kind === "sankey"
            ? "Her satır bir akış: Kaynak → Hedef, Değer. Düğümler adlarından türetilir."
            : kind === "ring"
              ? "Hedef boşsa halka toplam içindeki payı gösterir; doluysa hedefe göre ilerlemeyi."
              : "İlk sütun kategori ya da tarih (Oca 2025, 2025-01, Ç1 2025…). Sayılar 1.250,5 veya 1,250.5 biçiminde olabilir."}{" "}
        Excel gibi: tıkla-yaz, Ctrl+C / Ctrl+V, sağ tık, satır numarasından sürükle.
      </p>

      {menu && <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri(menu.tur)} onKapat={() => setMenu(null)} />}
    </div>
  );
}

/** Tek hücrede açılan giriş kutusu. Açılınca imleç yazının sonunda — yazmaya devam etmek için. */
function HucreGiris({
  deger,
  sag,
  onDeger,
  onTus,
  onBlur,
}: {
  deger: string;
  sag: boolean;
  onDeger: (v: string) => void;
  onTus: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }, []);
  return (
    <input
      ref={ref}
      className="hucre-giris"
      value={deger}
      spellCheck={false}
      style={{ textAlign: sag ? "right" : "left" }}
      onChange={(e) => onDeger(e.target.value)}
      onKeyDown={onTus}
      onBlur={onBlur}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
