/**
 * Geri al / yinele.
 *
 * Yalnız **işin kendisi** kaydedilir: grafikler ve paletler. Tema, yakınlaştırma,
 * açık sekme, seçili grafik ve dışa aktarım ayarları kaydedilmez — bunlar
 * pencerenin hâli, kullanıcı "geri al" derken bunları kastetmiyor. Bir grafiği
 * sildikten sonra geri alırsanız grafik geri gelir; o arada temayı
 * değiştirdiyseniz tema koyu kalır.
 *
 * Yazmayı tek adımda geri almak için ardışık kayıtlar `COALESCE_MS` içinde
 * birleşir: başlığa "Çeyreklik satış" yazmak 16 girdi değil bir girdidir.
 * `mark()` bu pencereyi zorla kapatır — panelde odak değiştiğinde çağrılır,
 * böylece "başlığı yaz, alt başlığa geç, onu da yaz" iki adım olur.
 */
import type { ChartSpec } from "./spec";
import type { Palette } from "./palettes";

export interface Snapshot {
  charts: ChartSpec[];
  palettes: Palette[];
}

const COALESCE_MS = 400;

export interface History {
  /** Değişiklikten **önceki** hâli yığına koy. */
  record(prev: Snapshot, now?: number): void;
  /** Sonraki `record` yeni bir girdi açsın (birleştirme penceresini kapat). */
  mark(): void;
  undo(current: Snapshot): Snapshot | null;
  redo(current: Snapshot): Snapshot | null;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createHistory(cap = 100): History {
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];
  let lastAt = 0;

  return {
    record(prev, now = Date.now()) {
      future.length = 0;
      const coalesce = now - lastAt < COALESCE_MS && past.length > 0;
      lastAt = now;
      if (coalesce) return;
      past.push(prev);
      if (past.length > cap) past.shift();
    },
    mark() {
      lastAt = 0;
    },
    undo(current) {
      const prev = past.pop();
      if (!prev) return null;
      future.push(current);
      lastAt = 0;
      return prev;
    },
    redo(current) {
      const next = future.pop();
      if (!next) return null;
      past.push(current);
      lastAt = 0;
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
