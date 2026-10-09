/**
 * `src/lib/sira.ts` birim testleri — tarayıcısız.
 *
 * Çıplak `node --experimental-strip-types` bu modülü yükleyemiyor: zinciri
 * uzantısız importlar (`./parse`) ve `@/` takma adı (`spec.ts` → `@/decor/model`)
 * içeriyor. Vite'ın `ssrLoadModule`'ü ikisini de uygulamanın kendi derlemesi
 * gibi çözüyor, o yüzden test kodu modülü olduğu gibi yüklüyor.
 */
import { createServer } from "vite";
import { fileURLToPath, URL } from "node:url";

const kok = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({
  configFile: false,
  root: kok,
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
  const S = await server.ssrLoadModule("/src/lib/sira.ts");
  const { newChart } = await server.ssrLoadModule("/src/lib/spec.ts");
  const A = await server.ssrLoadModule("/src/lib/adapters.ts");
  const { bicemAl, bicemUygula } = await server.ssrLoadModule("/src/lib/bicem.ts");
  const { normalizeChart } = await server.ssrLoadModule("/src/lib/storage.ts");

  const kart = (kind, columns, rows, opts = {}) => {
    const c = newChart(kind);
    return { ...c, data: { columns, rows }, options: { ...c.options, ...opts } };
  };
  const sira = (spec, boyut = "oge") => S.gorunenSira(spec, boyut).map((x) => x.anahtar);
  const renk = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"];

  /* --- 1. saf yardımcılar --- */
  eq(S.yerlestir(["a", "b", "c", "d"], ["a"], 2), ["b", "c", "a", "d"], "yerlestir tek");
  eq(S.yerlestir(["a", "b", "c", "d"], ["d", "b"], 0), ["b", "d", "a", "c"], "yerlestir blok listedeki sırayla");
  eq(S.bosluktanHedef(["a", "b", "c", "d"], ["a"], 3), 2, "boşluk → hedef (sağa)");
  eq(S.bosluktanHedef(["a", "b", "c", "d"], ["c"], 1), 1, "boşluk → hedef (sola)");
  eq(S.adimHedefi(["a", "b", "c"], ["b"], 1, false), 2, "bir adım ileri");
  eq(S.adimHedefi(["a", "b", "c"], ["b"], -1, false), 0, "bir adım geri");
  eq(S.adimHedefi(["a", "b", "c"], ["a"], -1, false), 0, "baştan geri gidilmez");
  eq(S.adimHedefi(["a", "b", "c"], ["a"], 1, true), 2, "sona");
  eq(S.altKumedeTasi(["a", "x", "b", "y", "c"], ["a", "b", "c"], "a", 2), ["x", "b", "y", "c", "a"], "alt kümede sona");
  eq(S.altKumedeTasi(["a", "x", "b", "y", "c"], ["a", "b", "c"], "c", 0), ["c", "a", "x", "b", "y"], "alt kümede başa");
  eq(S.anahtarla(["A", "B", "A", "A"]), ["A", "B", "A#2", "A#3"], "aynı adlar ayrılıyor");

  /* --- 2. tek serili sütun: modlar --- */
  const bar = kart("bar", ["x", "Değer"], [["A", "10"], ["B", "30"], ["C", "20"]]);
  eq(sira(bar), ["A", "B", "C"], "Otomatik = tablo");
  eq(sira({ ...bar, options: { ...bar.options, sort: "desc" } }), ["B", "C", "A"], "büyükten küçüğe");
  eq(sira({ ...bar, options: { ...bar.options, sort: "asc" } }), ["A", "C", "B"], "küçükten büyüğe");
  eq(sira({ ...bar, options: { ...bar.options, sort: "manual", sira: { oge: ["C", "A"], seri: [], alt: {} } } }), ["C", "A", "B"], "elle: listede olmayan sona");
  const azalan = { ...bar, options: { ...bar.options, sort: "desc", colorBy: "category" } };
  const g = S.gorunum(azalan, renk);
  eq(A.toCartesian(g.spec).labels, ["B", "C", "A"], "görünüm satırları diziyor");
  eq(g.colors.slice(0, 3), ["r1", "r2", "r0"], "kategoriye göre renk öğeyle gidiyor");
  eq(S.gorunum({ ...bar, options: { ...bar.options, sort: "desc" } }, renk).colors.slice(0, 3), ["r0", "r1", "r2"], "seriye göre renkte öğe sırası rengi oynatmıyor");
  eq(S.gorunum(bar, renk).spec === bar, true, "Otomatik'te girdinin kendisi döner");

  /* --- 3. taşıma ve dondurma --- */
  const t1 = S.siraTasi(bar, "oge", ["A"], 2);
  eq([t1.options.sort, t1.options.sira.oge], ["manual", ["B", "C", "A"]], "sürükleme Elle'ye geçiriyor");
  const t2 = S.siraTasi({ ...bar, options: { ...bar.options, sort: "desc" } }, "oge", ["A"], 0);
  eq(t2.options.sira.oge, ["A", "B", "C"], "değer modunda çizilen sıra donup üstüne uygulanıyor");
  eq(S.siraModu(bar, "manual").options.sira.oge, ["A", "B", "C"], "Elle'ye geçmek görüntüyü donduruyor");
  const hatirla = { ...t1, options: { ...t1.options, sort: "desc" } };
  eq(sira(S.siraModu(hatirla, "manual")), ["B", "C", "A"], "Elle'ye dönünce son elle düzen geliyor");
  eq(S.tersCevir({ ...bar, options: { ...bar.options, sort: "desc" } }, "oge").options.sort, "asc", "ters çevir değer modunda yönü değiştiriyor");
  eq(S.tersCevir(bar, "oge").options.sira.oge, ["C", "B", "A"], "ters çevir Otomatik'te ters Elle");

  /* --- 4. tarih gibi görünen etiketler --- */
  const ceyrek = kart("bar", ["x", "Değer"], [["Ç1 2025", "5"], ["Ç3 2025", "1"], ["Ç2 2025", "9"]]);
  eq(sira(ceyrek), ["Ç1 2025", "Ç2 2025", "Ç3 2025"], "Otomatik tarih sırası");
  const ceyrekAz = S.gorunum({ ...ceyrek, options: { ...ceyrek.options, sort: "desc" } }, renk);
  eq(A.toCartesian(ceyrekAz.spec).labels, ["Ç2 2025", "Ç1 2025", "Ç3 2025"], "değer sırası tarih sırasını eziyor (eski hata)");
  const ceyrekElle = S.siraTasi(ceyrek, "oge", ["Ç3 2025"], 0);
  eq(ceyrekElle.options.sira.oge, ["Ç3 2025", "Ç1 2025", "Ç2 2025"], "ilk sürükleme tarih sırasından donuyor, zıplamıyor");
  const cizgi = kart("line", ["x", "Değer"], [["2025-01", "5"], ["2025-03", "1"], ["2025-02", "9"]]);
  eq(S.siraBoyutlari(cizgi)[0].kapali, true, "zaman ekseninde öğe sıralaması kapalı");
  eq(S.gorunum({ ...cizgi, options: { ...cizgi.options, sort: "desc" } }, renk).spec.data, cizgi.data, "zaman ekseninde görünüm satırlara dokunmuyor");

  /* --- 5. seriler --- */
  const cok = kart("bar", ["x", "s1", "s2", "s3"], [["A", "1", "2", "3"], ["B", "4", "5", "6"]], {
    sira: { oge: [], seri: ["s3", "s1"], alt: {} },
  });
  const cg = S.gorunum(cok, renk);
  eq(cg.spec.data.columns, ["x", "s3", "s1", "s2"], "seri sırası sütunları diziyor");
  eq(cg.spec.data.rows[0], ["A", "3", "1", "2"], "hücreler sütunlarla gidiyor");
  eq(cg.colors.slice(0, 3), ["r2", "r0", "r1"], "seri rengi seriyle gidiyor");
  eq(S.seriSifirla(cok).options.sira.seri, [], "tablo sırasına dön");
  const coklu = kart("bar", ["x", "s1", "s2"], [["A", "1", "1"], ["B", "5", "5"], ["C", "3", "3"]], { sort: "desc" });
  eq(A.toCartesian(S.gorunum(coklu, renk).spec).labels, ["B", "C", "A"], "çok seride değer = satır toplamı");

  /* --- 6. kategori + değer --- */
  const halka = kart("ring", ["Etiket", "Değer", "Hedef"], [["a", "1", ""], ["b", "3", ""], ["", "9", ""], ["c", "2", ""]], { sort: "desc" });
  const hg = S.gorunum(halka, renk);
  eq(A.toRing(hg.spec, hg.colors).data.map((d) => [d.label, d.color]), [["b", "r1"], ["c", "r2"], ["a", "r0"]], "halkada sıralama artık uygulanıyor, renk öğede");
  const selale = kart("waterfall", ["Kalem", "Değer"], [["x", "5"], ["y", "-2"], ["z", "9"]], { sort: "desc" });
  const sg = S.gorunum(selale, renk);
  eq([A.toWaterfall(sg.spec).steps.map((s) => s.label), sg.colors.slice(0, 3)], [["z", "x", "y", "Toplam"], ["r0", "r1", "r2"]], "şelalede renk anlamsal, dizilmiyor");
  const huni = kart("funnel", ["Aşama", "Değer"], [["A", "5"], ["B", "7"], ["A", "2"]]);
  eq(sira(huni), ["A", "B", "A#2"], "aynı adlı aşamalar ayrı anahtar");
  eq(S.renkAdlari(selale), ["Artış", "Azalış", "Toplam"], "şelale renk adları anlamsal");

  /* --- 7. hiyerarşi --- */
  const agac = kart("treemap", ["Ana", "Alt", "Değer"], [["A", "a1", "1"], ["B", "b1", "9"], ["A", "a2", "5"]]);
  eq(S.gorunum(agac, renk).spec === agac, true, "hiyerarşi Otomatik'te dokunulmuyor");
  eq(sira(agac), ["B", "A"], "hiyerarşi Otomatik = büyükten küçüğe");
  eq(sira(agac, "alt"), ["b1", "a2", "a1"], "yapraklar da büyükten küçüğe");
  const agacElle = S.siraTasi(agac, "oge", ["A"], 0);
  eq([agacElle.options.sira.oge, agacElle.options.sira.alt], [["A", "B"], { B: ["b1"], A: ["a2", "a1"] }], "ilk taşıma yaprakları da donduruyor");
  const ag = S.gorunum(agacElle, renk);
  eq([ag.spec.options.sort, ag.spec.data.rows.map((r) => r[1]), ag.colors.slice(0, 2)], ["manual", ["a2", "a1", "b1"], ["r0", "r1"]], "Elle'de satırlar dizili, renk grupta");
  const yaprak = S.siraTasi(agacElle, "alt", ["a1"], 0, { grup: "A" });
  eq(yaprak.options.sira.alt.A, ["a1", "a2"], "yaprak kendi grubunda taşınıyor");

  /* --- 8. akış --- */
  const akor = kart("chord", ["Kaynak", "Hedef", "Değer"], [["X", "Y", "3"], ["Y", "Z", "2"], ["Z", "X", "1"]], {
    sort: "manual",
    sira: { oge: ["Z", "X"], seri: [], alt: {} },
  });
  const ak = S.gorunum(akor, renk);
  eq([A.toFlow(ak.spec).names, ak.colors.slice(0, 3)], [["Z", "X", "Y"], ["r2", "r0", "r1"]], "akorda düğüm dizisi ve renk elle sırada");
  const sankey = kart("sankey", ["Kaynak", "Hedef", "Değer"], [["X", "Y", "3"], ["X", "Z", "2"]], { sort: "alpha" });
  const sk = S.gorunum(sankey, renk);
  eq([sk.spec.options.sort, sk.spec.options.sira.oge, sk.colors === renk], ["manual", ["X", "Y", "Z"], true], "sankey karşılaştırıcıya liste veriyor, renge dokunmuyor");
  eq(sira({ ...sankey, options: { ...sankey.options, sort: "none" } }), ["X", "Y", "Z"], "sankey Otomatik ölçüsüz = ilk görünüş");
  eq(S.gorunenSira({ ...sankey, options: { ...sankey.options, sort: "none" } }, "oge", ["Z", "X", "Y"]).map((x) => x.anahtar), ["Z", "X", "Y"], "sankey Otomatik sahnede ölçülen sırayı kullanıyor");

  /* --- 9. dağılım --- */
  const dag = kart("scatter", ["Etiket", "X", "Y", "Boyut", "Grup"], [["p", "1", "1", "", "K"], ["q", "2", "2", "", "M"], ["r", "x", "3", "", "K"], ["s", "3", "3", "", "K"]], { sort: "alpha" });
  const dg = S.gorunum({ ...dag, options: { ...dag.options, sort: "manual", sira: { oge: ["M"], seri: [], alt: {} } } }, renk);
  eq([dg.spec.data.rows.map((r) => r[0]), dg.colors.slice(0, 2)], [["q", "p", "s"], ["r1", "r0"]], "dağılımda grup blokları ve renk");

  /* --- 10. tablodan ad değiştirme --- */
  const adli = { ...t1, options: { ...t1.options, highlight: ["A"] } };
  const yeni = S.adlariTasi(adli, { columns: ["x", "Değer"], rows: [["AA", "10"], ["B", "30"], ["C", "20"]] });
  eq([yeni.options.sira.oge, yeni.options.highlight], [["B", "C", "AA"], ["AA"]], "hücrede ad değişince sıra ve vurgu izliyor");
  const bos = S.adlariTasi(adli, { columns: ["x", "Değer"], rows: [["", "10"], ["B", "30"], ["C", "20"]] });
  const yaz = S.adlariTasi(bos, { columns: ["x", "Değer"], rows: [["Z", "10"], ["B", "30"], ["C", "20"]] });
  eq(yaz.options.sira.oge, ["B", "C", "Z"], "boşaltıp yeniden yazmak da ad değiştirme");
  const seriAd = S.adlariTasi(cok, { columns: ["x", "s1", "s2", "S3"], rows: cok.data.rows });
  eq(seriAd.options.sira.seri, ["S3", "s1"], "sütun adı değişince seri sırası izliyor");

  /* --- 11. renk adları ve kimlik --- */
  eq(S.renkAdlari({ ...bar, options: { ...bar.options, colorBy: "category" } }), ["A", "B", "C"], "kategoriye göre renkte panel kategorileri listeliyor");
  eq(S.renkAdlari(halka), ["a", "b", "c"], "halkada kimlik etiketsiz satırı atlıyor");

  /* --- 12. biçem ve kayıt --- */
  const kaynak = { ...t1, options: { ...t1.options, sort: "manual" } };
  const hedef = kart("bar", ["x", "Değer"], [["P", "1"]], { sort: "asc" });
  const uyg = bicemUygula(hedef, bicemAl(kaynak));
  eq([uyg.options.sort, uyg.options.sira.oge], ["asc", []], "biçem Elle'yi ve elle listeyi taşımıyor");
  const uyg2 = bicemUygula(hedef, bicemAl({ ...bar, options: { ...bar.options, sort: "desc" } }));
  eq(uyg2.options.sort, "desc", "biçem değer modunu taşıyor");
  const eskiHalka = normalizeChart({ ...halka, options: { ...halka.options, sira: undefined } });
  eq(eskiHalka.options.sort, "none", "eski halka kaydında etkisiz sort sıfırlanıyor");
  eq(normalizeChart(halka).options.sort, "desc", "yeni halka kaydı sırasını koruyor");
  eq(normalizeChart({ ...bar, options: { ...bar.options, sira: { oge: ["x", 3], alt: { g: "bozuk" } } } }).options.sira, { oge: ["x", "3"], seri: [], alt: { g: [] } }, "bozuk sira güvenceye alınıyor");
} catch (e) {
  hata++;
  console.error(e);
} finally {
  await server.close();
}

console.log(hata === 0 ? "\nhepsi geçti" : `\n${hata} test düştü`);
process.exit(hata === 0 ? 0 : 1);
