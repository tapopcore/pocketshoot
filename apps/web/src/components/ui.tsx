import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost" | "outline" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-[0_1px_2px_rgb(0_0_0/0.1)]",
  accent: "bg-accent text-white hover:bg-accent-ink",
  ghost: "text-ink hover:bg-paper-2",
  outline: "border border-line bg-card text-ink hover:border-ink/50",
  danger: "border border-bad/40 text-bad hover:bg-bad hover:text-white",
};
const SIZES = { sm: "h-8 px-3 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-7 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap",
    VARIANTS[variant], SIZES[size], extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-card)] border border-line bg-card", className)} {...props} />;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "busy" | "good" | "warn" | "bad" | "accent"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-paper-2 text-ink-2",
    busy: "bg-busy/10 text-busy",
    good: "bg-good/10 text-good",
    warn: "bg-warn/10 text-warn",
    bad: "bg-bad/10 text-bad",
    accent: "bg-accent/10 text-accent-ink",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-mute">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full h-11 rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-mute/70 focus:border-ink/60 focus:outline-none focus:ring-4 focus:ring-ink/5 transition";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={clsx(inputClass, props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={clsx(inputClass, "h-auto min-h-24 py-2.5", props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={clsx(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22><path d=%22M2 4l4 4 4-4%22 fill=%22none%22 stroke=%22%23141310%22 stroke-width=%221.5%22/></svg>')] bg-[right_14px_center] bg-no-repeat pr-9", props.className)} />;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-rise">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-card/60 px-6 py-14 text-center">
      <div className="display text-2xl">{title}</div>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-mute">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-card p-5">
      <div className="eyebrow">{label}</div>
      <div className={clsx("display mt-2 text-4xl tabular-nums", accent && "text-accent")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "warn" | "bad" | "good"; children: ReactNode; className?: string }) {
  const tones = { neutral: "border-line bg-paper-2/60", warn: "border-warn/30 bg-warn/5 text-[#5c3b00]", bad: "border-bad/30 bg-bad/5 text-bad", good: "border-good/30 bg-good/5 text-good" };
  return <div className={clsx("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function Logo({ className }: { className?: string }) {
  const name = process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot";
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="6" fill="currentColor" />
        <circle cx="11" cy="11" r="4.6" fill="#ff5a1f" />
        <circle cx="16.2" cy="5.8" r="1.3" fill="#fff" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">{name}</span>
    </span>
  );
}

export function formatDate(d: string | Date, withTime = false) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "Asia/Kolkata" }).format(new Date(d));
}

export function money(minor: number, currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}
