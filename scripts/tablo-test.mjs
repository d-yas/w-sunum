/**
 * `src/lib/tablo.ts` ve `src/lib/grid-selection.ts` birim testleri — tarayıcısız.
 * `sira-test.mjs` gibi Vite'ın `ssrLoadModule`'üyle yükleniyor (takma adlar ve
 * uzantısız importlar uygulamanın derlemesi gibi çözülsün).
 */
import { createServer } from "vite";
import { fileURLToPath, URL } from "node:url";

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
});

let hata = 0;
const eq = (a, b, m) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) hata++;
  console.log(ok ? "ok  " : "FAIL", m, ok ? "" : `→ beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);
};

try {
  const T = await server.ssrLoadModule("/src/lib/tablo.ts");
  const G = await server.ssrLoadModule("/src/lib/grid-selection.ts");
  const { parseDelimited } = await server.ssrLoadModule("/src/lib/parse.ts");

  const kartezyen = T.rolleri("bar");
  const halka = T.rolleri("ring");
  const t0 = () => ({ columns: ["Çeyrek", "A", "B"], rows: [["Ç1", "1", "2"], ["Ç2", "3", "4"], ["Ç3", "5", "6"]] });

  /* --- başlık tahmini --- */
  eq(T.baslikMi(parseDelimited("Ürün\t2023\t2024\nX\t120\t140\nY\t90\t95")), true, "yıl başlıkları tanınıyor (eski kural yanılıyordu)");
  eq(T.baslikMi(parseDelimited("Ürün\tSatış\nX\t120")), true, "metin başlık");
  eq(T.baslikMi(parseDelimited("X\t120\nY\t90")), false, "başlıksız veri");
  eq(T.baslikMi(parseDelimited("Kaynak;Hedef;Değer\nA;B;5")), true, "akış tablosu");
  eq(T.ilkSatirVeriMi(parseDelimited("10\n20\n30")), true, "başlığa yapıştırılan sayılar veri");
  eq(T.ilkSatirVeriMi(parseDelimited("2026\n7\n8")), false, "yıl adı + değerler: ilk satır başlık");

  /* --- Y1: Excel'den ilk tablo --- */
  const y1 = T.yapistir(t0(), parseDelimited("Ürün\t2023\t2024\t2025\nX\t1\t2\t3\nY\t4\t5\t6"), { r: 0, c: 0 }, kartezyen, { tumTablo: true, baslik: "oto" });
  eq([y1.tablo.columns, y1.tablo.rows, y1.baslik], [["Ürün", "2023", "2024", "2025"], [["X", "1", "2", "3"], ["Y", "4", "5", "6"]], true], "tablo yerine konuyor, eski satır kalmıyor");
  const y1b = T.yapistir(t0(), parseDelimited("X\t1\nY\t2"), { r: 0, c: 0 }, kartezyen, { tumTablo: true, baslik: false });
  eq([y1b.tablo.columns, y1b.tablo.rows.length], [["Çeyrek", "A"], 2], "başlıksız yerine koyunca eski adlar kalıyor");
  const sabit = T.yapistir({ columns: ["Etiket", "Değer", "Hedef"], rows: [["a", "1", ""]] }, parseDelimited("E\tD\tH\tFazla\nx\t1\t2\t9"), { r: 0, c: 0 }, halka, { tumTablo: true, baslik: "oto" });
  eq([sabit.tablo.columns.length, sabit.sigmayan], [3, 1], "sabit sütunlu türde fazla sütun düşüyor ve sayılıyor");

  /* --- Y2: tek sütunu güncelle --- */
  const y2 = T.yapistir(t0(), parseDelimited("10\n30\n50\n70"), { r: 0, c: 1 }, kartezyen);
  eq([y2.tablo.rows.map((r) => r[1]), y2.eklenenSatir, y2.aralik], [["10", "30", "50", "70"], 1, { r0: 0, c0: 1, r1: 3, c1: 1 }], "sütuna yapıştırma fazlası satır ekliyor");
  const y2b = T.yapistir(t0(), parseDelimited("10\n30"), { r: 0, c: 1 }, kartezyen);
  eq(y2b.kalan, 1, "eksik yapıştırınca alttaki eski satır sayılıyor");

  /* --- Y3: yeni seri, başlığa adıyla --- */
  const y3 = T.yapistir(t0(), parseDelimited("2026\n7\n8\n9"), { r: -1, c: 3 }, kartezyen);
  eq([y3.tablo.columns, y3.tablo.rows.map((r) => r[3]), y3.baslik, y3.eklenenSutun], [["Çeyrek", "A", "B", "2026"], ["7", "8", "9"], true, 1], "başlığa adıyla yapıştırmak seri açıyor");
  const y3b = T.yapistir(t0(), parseDelimited("10\n20\n30"), { r: -1, c: 2 }, kartezyen);
  eq([y3b.tablo.columns[2], y3b.tablo.rows.map((r) => r[2]), y3b.baslik], ["B", ["10", "20", "30"], false], "sütuna yalnız sayılar: ad değişmiyor");

  /* --- Y4: geri kopyala --- */
  eq(T.araligiAl(t0(), { r0: 0, r1: 1, c0: 0, c1: 1, baslik: false }), [["Ç1", "1"], ["Ç2", "3"]], "aralık matrisi");
  eq(T.araligiAl(t0(), { r0: 0, r1: 0, c0: 1, c1: 1, baslik: true }), [["A"], ["1"]], "sütun başlığıyla");
  eq(T.tsv([["a\tb", "x"], ['"q"', "y"]]), '"a\tb"\tx\n"""q"""\ty', "sekme ve tırnak kaçışı");
  eq(parseDelimited(T.tsv([["a\tb", "x"], ['"q"', "y"]])), [["a\tb", "x"], ['"q"', "y"]], "TSV gidiş-dönüş");
  eq(T.htmlTablo([["A", "<b>"], ["1", "2"]], true), "<table><tr><th>A</th><th>&lt;b&gt;</th></tr><tr><td>1</td><td>2</td></tr></table>", "HTML tablo");

  /* --- Y5/Y8/Y10: temizle, doldur, aşağı doldur --- */
  eq(T.araligiTemizle(t0(), { r0: 0, r1: 1, c0: 1, c1: 2, baslik: false }).rows, [["Ç1", "", ""], ["Ç2", "", ""], ["Ç3", "5", "6"]], "aralığı temizle (başlık kalır)");
  eq(T.doldur(t0(), { r0: 0, r1: 2, c0: 1, c1: 1, baslik: false }, "0").rows.map((r) => r[1]), ["0", "0", "0"], "tek değeri seçime yapıştırmak doldurur");
  eq(T.asagiDoldur(t0(), { r0: 0, r1: 2, c0: 1, c1: 1, baslik: false }).rows.map((r) => r[1]), ["1", "1", "1"], "aşağı doldur");
  eq(T.asagiDoldur(t0(), { r0: 1, r1: 1, c0: 0, c1: 0, baslik: false }).rows.map((r) => r[0]), ["Ç1", "Ç1", "Ç3"], "tek satırda üstten doldur");

  /* --- Y6: satırlar --- */
  eq(T.satirEkle(t0(), 1).rows.map((r) => r[0]), ["Ç1", "", "Ç2", "Ç3"], "araya satır");
  eq(T.satirlariSil(t0(), [0, 2]).rows.map((r) => r[0]), ["Ç2"], "çoklu satır sil");
  eq(T.satirlariSil(t0(), [0, 1, 2]).rows, [["", "", ""]], "hepsi silinince bir boş satır kalıyor");
  eq(T.satirlariCogalt(t0(), [0]).tablo.rows.map((r) => r[0]), ["Ç1", "Ç1", "Ç2", "Ç3"], "satır çoğalt");
  const tas = T.satirlariTasi(t0(), [0], 3);
  eq([tas.tablo.rows.map((r) => r[0]), tas.yeni], [["Ç2", "Ç3", "Ç1"], [2]], "satırı sona taşı");
  eq(T.satirlariTasi(t0(), [1, 2], 0).tablo.rows.map((r) => r[0]), ["Ç2", "Ç3", "Ç1"], "blok taşı");
  eq(T.satirlariKaydir(t0(), [1], -1).tablo.rows.map((r) => r[0]), ["Ç2", "Ç1", "Ç3"], "Alt+↑");
  eq(T.satirlariKaydir(t0(), [1], 1).tablo.rows.map((r) => r[0]), ["Ç1", "Ç3", "Ç2"], "Alt+↓");
  eq(T.bosSatirlariSil({ columns: ["x"], rows: [["a"], [" "], ["b"]] }).rows, [["a"], ["b"]], "boş satırları sil");

  /* --- Y7: sütunlar ve sıralama --- */
  eq(T.sutunEkle(t0(), 1, kartezyen).columns, ["Çeyrek", "Seri 1", "A", "B"], "seri araya ekleniyor");
  eq(T.sutunEkle(t0(), 0, kartezyen).columns[0], "Çeyrek", "sabit sütunun önüne seri girmiyor");
  eq(T.sutunlariSil(t0(), [1], kartezyen).columns, ["Çeyrek", "B"], "seri sil");
  eq(T.sutunlariSil(T.sutunlariSil(t0(), [1], kartezyen), [1], kartezyen).columns, ["Çeyrek", "B"], "son seri silinmiyor");
  eq(T.sutunlariSil(t0(), [0], kartezyen).columns, ["Çeyrek", "A", "B"], "sabit sütun silinmiyor");
  const st = T.sutunlariTasi(t0(), [2], 1, kartezyen);
  eq([st.tablo.columns, st.tablo.rows[0], st.yeni], [["Çeyrek", "B", "A"], ["Ç1", "2", "1"], [1]], "seriyi sola taşı (değerleriyle)");
  eq(T.sutunlariTasi(t0(), [2], 0, kartezyen).tablo.columns, ["Çeyrek", "B", "A"], "sabit sütunun önüne geçmiyor");
  eq(T.sutunlariKaydir(t0(), [1], 1, kartezyen).tablo.columns, ["Çeyrek", "B", "A"], "Alt+→");
  eq(T.tabloSirala(t0(), 1, -1).rows.map((r) => r[0]), ["Ç3", "Ç2", "Ç1"], "sayı sütununa göre azalan");
  eq(T.tabloSirala({ columns: ["a"], rows: [["Şile"], [""], ["Çorum"], ["Ankara"]] }, 0, 1).rows.map((r) => r[0]), ["Ankara", "Çorum", "Şile", ""], "Türkçe alfabe, boş sonda");

  /* --- bütün tablo --- */
  eq(T.devrik(t0(), kartezyen), { columns: ["Çeyrek", "Ç1", "Ç2", "Ç3"], rows: [["A", "1", "3", "5"], ["B", "2", "4", "6"]] }, "satır ↔ sütun");
  eq(T.ilkSatiriBaslikYap({ columns: ["", "Seri 1"], rows: [["Ürün", "2024"], ["x", "1"]] }), { columns: ["Ürün", "2024"], rows: [["x", "1"]] }, "ilk satırı başlık yap");
  eq(T.basligiSatiraIndir({ columns: ["Ürün", "2024"], rows: [["x", "1"]] }, kartezyen), { columns: ["", "Seri 1"], rows: [["Ürün", "2024"], ["x", "1"]] }, "başlığı satıra indir");

  /* --- Y9/Y11: doğrulama ve özet --- */
  eq([...T.hataliHucreler({ columns: ["x", "y"], rows: [["a", "12"], ["b", "on iki"], ["c", ""]] }, "bar")], ["1:1"], "sayı sütununda sayı olmayan hücre");
  eq([...T.hataliHucreler({ columns: ["Tarih", "Değer"], rows: [["2025-01-01", "1"], ["dün", "2"]] }, "heatmap")], ["1:0"], "tarih sütununda tarih olmayan");
  eq([...T.hataliHucreler({ columns: ["K", "H", "D"], rows: [["A", "B", "3"]] }, "chord")], [], "akışta Hedef metin (eski hizalama hatası)");
  eq(T.secimOzeti(t0(), { r0: 0, r1: 2, c0: 1, c1: 2, baslik: false }), { dolu: 6, sayi: 6, toplam: 21, ortalama: 3.5 }, "seçim toplamı ve ortalaması");

  /* --- seçim modeli --- */
  const b = { satir: 3, sutun: 3 };
  eq(G.aralik(G.sutunSecimi(1, b), b), { r0: 0, r1: 2, c0: 1, c1: 1, baslik: true }, "sütun seçimi başlığı kapsıyor");
  eq(G.tasi(G.tekSecim(0, 1), -1, 0, b).mod, "sutun", "ilk satırdan yukarı başlık = sütun seçimi");
  eq(G.tasi(G.sutunSecimi(1, b), 1, 0, b), G.tekSecim(0, 1), "başlıktan aşağı ilk hücre");
  eq(G.aralik(G.genislet(G.tekSecim(0, 0), 1, 1, b), b), { r0: 0, r1: 1, c0: 0, c1: 1, baslik: false }, "Shift+ok");
  eq(G.hepsiMi(G.hepsi(b), b), true, "tümünü seç");
  eq(G.icinde(G.satirSecimi(1, b), 1, 2, b) && !G.icinde(G.satirSecimi(1, b), -1, 0, b), true, "satır seçimi başlığı kapsamıyor");
  eq(G.blokSonu([["a"], ["b"], [""], ["c"]], 0, 0, 1, 0, { satir: 4, sutun: 1 }), { r: 1, c: 0 }, "Ctrl+↓ dolu bloğun sonu");
  eq(G.blokSonu([["a"], [""], [""], ["c"]], 0, 0, 1, 0, { satir: 4, sutun: 1 }), { r: 3, c: 0 }, "Ctrl+↓ sonraki dolu hücre");
} catch (e) {
  hata++;
  console.error(e);
} finally {
  await server.close();
}

console.log(hata === 0 ? "\nhepsi geçti" : `\n${hata} test düştü`);
process.exit(hata === 0 ? 0 : 1);
