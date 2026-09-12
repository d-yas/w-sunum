import {
  ArrowRight,
  Asterisk,
  Atom,
  Baby,
  Banknote,
  Boxes,
  Briefcase,
  Building,
  Car,
  ChartArea,
  ChartBarBig,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartNetwork,
  ChartPie,
  ChartScatter,
  Circle,
  CircleDot,
  Coffee,
  Cpu,
  Diamond,
  Donut,
  Factory,
  Flower2,
  Fuel,
  Funnel,
  Gauge,
  Globe,
  Grid2x2,
  Hexagon,
  House,
  Laptop,
  Leaf,
  Map as MapIcon,
  Package,
  PersonStanding,
  Plane,
  Radar,
  Server,
  Ship,
  Sparkles,
  Spline,
  Square,
  Star,
  Torus,
  Triangle,
  Truck,
  User,
  Users,
  Waypoints,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import type { ChartKind } from "@/lib/spec";

/**
 * Lucide ikon paketi (ISC). Yalnız adı geçen ikonlar paketlenir — lucide-react
 * ES modülü olarak yayınlandığı için ağaç sarsma bunları tek tek ayıklar,
 * kullanılmayan 1.500 ikon tek dosyaya girmez.
 */
export type { LucideIcon };

/** Tür seçicideki simgeler. */
export const KIND_ICONS: Record<ChartKind, LucideIcon> = {
  bar: ChartColumn,
  barH: ChartBarBig,
  line: ChartLine,
  area: ChartArea,
  slope: Spline,
  radar: Radar,
  marimekko: ChartColumnStacked,
  ring: Donut,
  gauge: Gauge,
  funnel: Funnel,
  waterfall: ChartColumn,
  pictogram: Users,
  treemap: Grid2x2,
  sunburst: Torus,
  pack: Boxes,
  scatter: ChartScatter,
  bubble: CircleDot,
  sankey: Waypoints,
  chord: Atom,
  network: ChartNetwork,
  arc: ChartPie,
  heatmap: Grid2x2,
  map: MapIcon,
};

/**
 * Piktogram grafiğinin simge kataloğu. Bir "her simge N birim" grafiğinde
 * anlatının konusu ne ise o seçilir.
 */
export const PICTO_ICONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "person", label: "Kişi", icon: PersonStanding },
  { id: "user", label: "Profil", icon: User },
  { id: "users", label: "Grup", icon: Users },
  { id: "baby", label: "Çocuk", icon: Baby },
  { id: "house", label: "Konut", icon: House },
  { id: "building", label: "Bina", icon: Building },
  { id: "factory", label: "Fabrika", icon: Factory },
  { id: "briefcase", label: "İş", icon: Briefcase },
  { id: "banknote", label: "Para", icon: Banknote },
  { id: "package", label: "Koli", icon: Package },
  { id: "truck", label: "Kamyon", icon: Truck },
  { id: "car", label: "Araç", icon: Car },
  { id: "plane", label: "Uçak", icon: Plane },
  { id: "ship", label: "Gemi", icon: Ship },
  { id: "cpu", label: "İşlemci", icon: Cpu },
  { id: "server", label: "Sunucu", icon: Server },
  { id: "laptop", label: "Dizüstü", icon: Laptop },
  { id: "leaf", label: "Yaprak", icon: Leaf },
  { id: "wheat", label: "Buğday", icon: Wheat },
  { id: "fuel", label: "Yakıt", icon: Fuel },
  { id: "coffee", label: "Kahve", icon: Coffee },
  { id: "circle", label: "Daire", icon: Circle },
  { id: "square", label: "Kare", icon: Square },
  { id: "triangle", label: "Üçgen", icon: Triangle },
  { id: "diamond", label: "Elmas", icon: Diamond },
  { id: "hexagon", label: "Altıgen", icon: Hexagon },
  { id: "star", label: "Yıldız", icon: Star },
  { id: "flower", label: "Çiçek", icon: Flower2 },
  { id: "sparkles", label: "Parıltı", icon: Sparkles },
  { id: "asterisk", label: "Yıldızcık", icon: Asterisk },
  { id: "globe", label: "Küre", icon: Globe },
  { id: "arrow", label: "Ok", icon: ArrowRight },
];

const PICTO_BY_ID = new Map(PICTO_ICONS.map((p) => [p.id, p.icon]));

export function pictoIcon(id: string): LucideIcon {
  return PICTO_BY_ID.get(id) ?? PersonStanding;
}
