import { createContext, useContext, useState } from "react";

/** The shoot being set up, shared across the camera, details and look screens. */
export interface Draft {
  photos: string[];
  productId: string | null;
  productName: string;
  category: string;
  locks: string[];
  mode: "preserve" | "creative";
  style: string;
  output: string;
  count: number;
  customBrief: string;
}

const EMPTY: Draft = { photos: [], productId: null, productName: "", category: "beauty", locks: [], mode: "preserve", style: "premium_minimal", output: "square", count: 4, customBrief: "" };

const DraftContext = createContext<{ draft: Draft; set: (p: Partial<Draft>) => void; reset: () => void }>({ draft: EMPTY, set: () => {}, reset: () => {} });

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  return (
    <DraftContext.Provider value={{ draft, set: (p) => setDraft((d) => ({ ...d, ...p })), reset: () => setDraft(EMPTY) }}>
      {children}
    </DraftContext.Provider>
  );
}

export const useDraft = () => useContext(DraftContext);
