/**
 * Referans çizgisi listesi.
 *
 * Satır düzeni dekor listesinden geliyor (`.decor-row`): aynı stüdyoda iki
 * farklı "öğe listesi" görünümü olmasın diye.
 */
import { Plus, X } from "lucide-react";

import { uid, type RefLine } from "@/lib/spec";

import { Num, Switch } from "./Panels";

export function RefLineList({ lines, onChange }: { lines: RefLine[]; onChange: (next: RefLine[]) => void }) {
  const patch = (id: string, p: Partial<RefLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));

  return (
    <div className="flex flex-col gap-1 pt-1">
      {lines.map((l) => (
        <div className="decor-row" key={l.id} style={{ cursor: "default" }}>
          <Num value={l.value} width={62} onChange={(v) => patch(l.id, { value: v ?? 0 })} />
          <input
            className="inp h-6 grow text-[11px]"
            value={l.label}
            placeholder="Etiket"
            maxLength={60}
            onChange={(e) => patch(l.id, { label: e.target.value })}
          />
          <input
            className="swatch"
            style={{ width: 20, height: 20 }}
            type="color"
            value={l.color || "#7a7975"}
            title="Çizgi rengi"
            onChange={(e) => patch(l.id, { color: e.target.value })}
          />
          <Switch checked={l.dash} onChange={(v) => patch(l.id, { dash: v })} />
          <button className="icon-btn danger" title="Çizgiyi kaldır" onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>
            <X size={13} />
          </button>
        </div>
      ))}
      {lines.length > 0 && (
        <div className="flex items-center justify-between px-1.5 text-[10px] text-muted-foreground">
          <span>değer · etiket · renk · kesik</span>
        </div>
      )}
      {lines.length < 12 && (
        <button
          className="btn btn-sm mt-0.5 justify-center"
          onClick={() => onChange([...lines, { id: uid(), value: 0, label: "Hedef", color: "", dash: true }])}
        >
          <Plus size={12} /> Çizgi ekle
        </button>
      )}
    </div>
  );
}
