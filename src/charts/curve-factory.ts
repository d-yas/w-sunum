/**
 * d3 eğri fabrikasının (curve factory) tip kısayolu.
 *
 * Gerçek tip `@types/d3-shape`ta ama o paket kurulu değil; visx eğriyi
 * opak bir değer olarak geçiriyor, yani burada yapılacak elle bir tip
 * tanımı visx ile uyumu garanti etmez, yalnızca uyumlu *görünür*.
 *
 * Bu bilinçli bir kaçış deliği ve **tek yerde** duruyor. Eskiden aynı satır
 * dört ayrı grafik dosyasında tekrarlanıyordu, üstelik `biome-ignore`
 * yorumlarıyla — depo bir zamanlar Biome kullanmış, ESLint'e geçilince o
 * bastırmalar sessizce işlevsiz kalmıştı (astra denetim 3, bulgu H3).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CurveFactory = any;
