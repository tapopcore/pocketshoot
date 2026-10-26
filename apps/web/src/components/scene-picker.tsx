"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { SCENE_GROUPS, STYLES, type SceneGroup, type StyleId } from "@packshot/core";

type Tab = "for_you" | SceneGroup;

export function SceneCard({ id, selected, order, onClick, size = "md" }: { id: StyleId; selected: boolean; order?: number; onClick: () => void; size?: "sm" | "md" }) {
  const s = STYLES[id];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "group relative overflow-hidden rounded-2xl text-left transition-all duration-200",
        selected ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "ring-1 ring-black/5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      <div className={clsx("relative w-full", size === "sm" ? "aspect-square" : "aspect-[4/5]")} style={{ background: s.art }}>
        {/* A soft product silhouette so the card reads as a scene, not a swatch */}
        <div className="absolute inset-x-0 bottom-[16%] mx-auto h-[38%] w-[22%] rounded-[40%_40%_14%_14%/30%_30%_10%_10%] bg-white/55 shadow-[0_18px_22px_-14px_rgba(0,0,0,0.45)] backdrop-blur-[2px] transition-transform duration-300 group-hover:scale-105" />
        {id === "custom" && <Wand2 className="absolute left-1/2 top-[38%] -translate-x-1/2 text-white/90" size={28} />}
        {selected && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white animate-pop">
            {order ? order : <Check size={14} />}
          </span>
        )}
      </div>
      <div className="bg-card px-2.5 py-2">
        <div className="truncate text-[13px] font-semibold">{s.name}</div>
        {size === "md" && <div className="truncate text-[11px] text-mute">{s.description}</div>}
      </div>
    </button>
  );
}

export function ScenePicker({ selected, onChange, suggested, max = 4 }: { selected: StyleId[]; onChange: (ids: StyleId[]) => void; suggested: StyleId[]; max?: number }) {
  const [tab, setTab] = useState<Tab>(suggested.length ? "for_you" : "studio");
  const all = useMemo(() => Object.values(STYLES), []);
  const list: StyleId[] = useMemo(() => {
    if (tab === "for_you") return [...suggested.filter((s) => s !== "custom"), "custom"];
    return all.filter((s) => s.group === tab && s.id !== "custom").map((s) => s.id);
  }, [tab, suggested, all]);

  function toggle(id: StyleId) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
    else onChange([...selected.slice(1), id]);
  }

  const tabs: { id: Tab; label: string }[] = [{ id: "for_you", label: "For you" }, ...SCENE_GROUPS.map((g) => ({ id: g.id as Tab, label: g.name }))];
  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2")}>
            {t.id === "for_you" && <Sparkles size={13} className="-mt-0.5 mr-1 inline" />}{t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {list.map((id) => <SceneCard key={id} id={id} selected={selected.includes(id)} order={selected.length > 1 ? selected.indexOf(id) + 1 || undefined : undefined} onClick={() => toggle(id)} />)}
      </div>
    </div>
  );
}
