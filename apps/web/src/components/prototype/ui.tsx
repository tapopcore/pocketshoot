"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";

/** Keeps focus inside an open dialog, closes on Escape, and returns focus to the opener (pack 02 §8). */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button,[href],select,textarea,input,[tabindex]:not([tabindex='-1'])") ?? []).filter((n) => !n.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; opener?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return (
    <div className="pt-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="pt-sheet" role="dialog" aria-modal="true" aria-labelledby="pt-sheet-title">
        <div className="pt-between"><h2 id="pt-sheet-title">{title}</h2><button type="button" className="pt-icon" aria-label="Close" onClick={onClose}><X /></button></div>
        {children}
      </div>
    </div>
  );
}

export interface ViewerItem { src: string; alt: string; title: string; original?: string; caption?: string }

/** Full-screen photo viewer: compare with the original, zoom, download, keyboard and touch friendly. */
export function Viewer({ item, onClose, onDownload }: { item: ViewerItem | null; onClose: () => void; onDownload?: () => void }) {
  const ref = useDialog(!!item, onClose);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { setShowOriginal(false); setZoom(false); }, [item]);
  if (!item) return null;
  const src = showOriginal && item.original ? item.original : item.src;
  return (
    <div ref={ref} className="pt-viewer" role="dialog" aria-modal="true" aria-label={item.title}>
      <header>
        <div className="pt-stack-s" style={{ minWidth: 0 }}><b className="pt-ellipsis">{item.title}</b>{item.caption && <span className="pt-xs" style={{ color: "#B9B9BE" }}>{item.caption}</span>}</div>
        <button type="button" className="pt-icon" aria-label="Close viewer" onClick={onClose}><X /></button>
      </header>
      <div className="pt-stage">
        <img src={src} alt={showOriginal ? "Your original photo" : item.alt} data-zoom={zoom} onClick={() => setZoom((z) => !z)} />
      </div>
      <footer>
        {item.original ? (
          <span className="pt-seg" role="group" aria-label="Compare">
            <button type="button" aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)}>Result</button>
            <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(true)}>Your photo</button>
          </span>
        ) : <span />}
        <span className="pt-row">
          <button type="button" className="pt-icon" aria-label={zoom ? "Zoom out" : "Zoom in"} onClick={() => setZoom((z) => !z)}>{zoom ? <ZoomOut /> : <ZoomIn />}</button>
          {onDownload && <button type="button" className="pt-btn line sm" onClick={onDownload}><Download />Download</button>}
        </span>
      </footer>
    </div>
  );
}

/** Output shape icon drawn at the true ratio, so a Story icon is actually 9:16. */
export function RatioIcon({ w, h }: { w: number; h: number }) {
  return <span className="pt-shape" aria-hidden><i style={{ width: w, height: h }} /></span>;
}
