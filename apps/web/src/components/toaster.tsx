"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; isError: boolean }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { message, isError } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, message, isError }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
    };
    window.addEventListener("ps-toast", on);
    return () => window.removeEventListener("ps-toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={clsx("animate-rise pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm shadow-[var(--shadow-lift)]", t.isError ? "bg-bad text-white" : "bg-ink text-paper")}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
