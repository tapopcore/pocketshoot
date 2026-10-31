"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type FaqGroup = { group: string; items: { q: string; a: string }[] };

export function FaqList({ groups }: { groups: FaqGroup[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups.map((g) => ({ ...g, items: g.items.filter((i) => (i.q + " " + i.a).toLowerCase().includes(s)) })).filter((g) => g.items.length);
  }, [q, groups]);
  return (
    <>
      <div className="srch"><Search /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example: white background" aria-label="Search questions" /></div>
      <div className="fq" style={{ margin: "var(--s8) auto 0" }}>
        {shown.length === 0 && <p className="body muted">No answers match that. Try another word, or message us below.</p>}
        {shown.map((g, gi) => (
          <div className="grp" key={g.group}><h2 className="h4">{g.group}</h2><div className="qa">
            {g.items.map((i, n) => (
              <details key={i.q} open={gi === 0 && n === 0 && !q}><summary>{i.q}<i aria-hidden>+</i></summary><p className="body">{i.a}</p></details>
            ))}
          </div></div>
        ))}
      </div>
    </>
  );
}
