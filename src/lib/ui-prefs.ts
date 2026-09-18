/**
 * Studio UI tercihleri — çalışma alanının **dışında** duran ayarlar.
 *
 * `spec.ts`/`storage.ts` kullanıcının işini (grafikler, paletler, veri) tutar
 * ve `Kaydet (JSON)` ile taşınır. Panelin hangi bölümü açık, katman listesinin
 * yüksekliği ne — bunlar işin parçası değil, o makinedeki pencere hâli. Ayrı
 * anahtarda durmaları çalışma alanı JSON'unu taşınabilir tutuyor: başka bir
 * ekranda açtığınızda panel sizin ekranınıza göre değil kendi ekranına göre
 * kurulur.
 */
const KEY = "data-gorsel.ui.v1";

export interface UiPrefs {
  /** Sol paneldeki katman listesinin yüksekliği (px). */
  layerHeight: number;
  /** Bölüm id → açık mı. Yazılmayan bölüm açık sayılır. */
  sections: Record<string, boolean>;
}

const DEFAULTS: UiPrefs = { layerHeight: 300, sections: {} };

let cache: UiPrefs | null = null;

export function loadPrefs(): UiPrefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<UiPrefs>) : {};
    cache = {
      layerHeight: clampHeight(typeof p.layerHeight === "number" ? p.layerHeight : DEFAULTS.layerHeight),
      sections: isRecord(p.sections) ? p.sections : {},
    };
  } catch {
    cache = { ...DEFAULTS, sections: {} };
  }
  return cache;
}

export function savePrefs(patch: Partial<UiPrefs>) {
  const next = { ...loadPrefs(), ...patch };
  if (patch.layerHeight != null) next.layerHeight = clampHeight(patch.layerHeight);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — tercihler yalnız bu oturum için geçerli olur.
  }
}

/** Bölüm açık mı; hiç yazılmamışsa açık. */
export function sectionOpen(id: string): boolean {
  return loadPrefs().sections[id] !== false;
}

export function setSectionOpen(id: string, open: boolean) {
  savePrefs({ sections: { ...loadPrefs().sections, [id]: open } });
}

function clampHeight(h: number): number {
  return Math.max(90, Math.min(900, Math.round(h)));
}

function isRecord(v: unknown): v is Record<string, boolean> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
