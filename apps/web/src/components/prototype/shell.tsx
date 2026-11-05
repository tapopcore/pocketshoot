"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Boxes, Home, Images, Plus, UserRound, WifiOff } from "lucide-react";
import { DEMO } from "@/lib/prototype/demo";

type Dir = "studio" | "editorial";
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const NAV = [
  { href: "/prototype", label: "Home", icon: Home },
  { href: "/prototype/shoots", label: "Shoots", icon: Images },
  { href: "/prototype/create", label: "Create", icon: Plus, create: true },
  { href: "/prototype/products", label: "Products", icon: Boxes },
  { href: "/prototype/you", label: "You", icon: UserRound },
];

function current(path: string, href: string) {
  return href === "/prototype" ? path === href : path.startsWith(href);
}

export function PrototypeShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const sp = useSearchParams();
  const [dir, setDir] = useState<Dir>("studio");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlow = path.startsWith("/prototype/create");
  const offline = sp.get("offline") === "1";

  useEffect(() => {
    try { const d = localStorage.getItem("pt-direction"); if (d === "studio" || d === "editorial") setDir(d); } catch { /* storage unavailable */ }
  }, []);
  const choose = (d: Dir) => { setDir(d); try { localStorage.setItem("pt-direction", d); } catch { /* storage unavailable */ } };
  const show = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      <div className="pt" data-direction={dir}>
        <div className="pt-proto" role="note">
          <span>Example data, nothing saved. <Link href="/prototype/states">All screens</Link></span>
          <span className="pt-seg" role="group" aria-label="Visual direction">
            <button type="button" aria-pressed={dir === "studio"} onClick={() => choose("studio")}>Studio</button>
            <button type="button" aria-pressed={dir === "editorial"} onClick={() => choose("editorial")}>Editorial</button>
          </span>
        </div>
        <div className="pt-app">
          <aside className="pt-side" aria-label="Main">
            <Link href="/prototype" className="pt-logo"><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link>
            <Link href="/prototype/create" className="pt-btn primary block pt-create"><Plus />Create shoot</Link>
            {NAV.filter((n) => !n.create).map((n) => (
              <Link key={n.href} href={n.href} className="pt-nav" aria-current={current(path, n.href) ? "page" : undefined}><n.icon size={20} />{n.label}</Link>
            ))}
            <div style={{ flex: 1 }} />
            <Link href="/prototype/you" className="pt-credits" style={{ justifyContent: "center" }}><i aria-hidden />{DEMO.user.balance} credits</Link>
          </aside>
          <div style={{ minWidth: 0 }}>
            {!inFlow && (
              <header className="pt-top">
                <Link href="/prototype" className="pt-logo"><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link>
                <span />
                <Link href="/prototype/you" className="pt-credits" aria-label={`${DEMO.user.balance} credits. Open account`}><i aria-hidden />{DEMO.user.balance} credits</Link>
              </header>
            )}
            {offline && <div className="pt-note warn" role="status" style={{ borderRadius: 0 }}><WifiOff />You&apos;re offline. Your choices are kept on this phone and will continue when you&apos;re back online.</div>}
            {children}
          </div>
        </div>
        {!inFlow && (
          <nav className="pt-tabs" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={n.create ? "pt-tab-create" : undefined} aria-current={current(path, n.href) ? "page" : undefined}>
                {n.create ? <span className="pt-plus" aria-hidden><Plus size={20} /></span> : <n.icon aria-hidden />}
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        {toast && <div className="pt-toast" role="status" aria-live="polite">{toast}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
