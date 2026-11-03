/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getWebContext } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Log in" };

const ART = ["saree-2", "skincare-1", "rings-3", "beverage-2", "bags-3", "fragrance-2", "footwear-2", "necklace-2"];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") && !sp.next.includes("\\") ? sp.next : "/app";
  if (await getWebContext()) redirect(next);
  const col = (offset: number) => [...ART.slice(offset), ...ART.slice(0, offset)];
  return (
    <div className="pg-signin">
      <div className="si">
        <div className="fm">
          <div className="logo-row"><Link href="/" className="blogo"><img src="/brand/logo-light.svg" alt="PocketShoot" style={{ height: 38 }} /></Link></div>
          <div className="art-m m-only" aria-hidden>
            {[0, 4].map((o, r) => <div key={r} className={`row-m ${r ? "rev" : ""}`}>{[...col(o), ...col(o)].map((k, i) => <div key={i} className="ph"><img src={`/showcase/${k}.webp`} alt="" loading="lazy" decoding="async" /></div>)}</div>)}
            <span className="pill lime sm tag">2 photos free</span>
          </div>
          <div className="box">
            {sp.error && <p className="sm" style={{ color: "var(--bad)", background: "#FDECEA", padding: "12px 16px", borderRadius: 14, marginBottom: "var(--s5)" }}>That sign-in link didn&apos;t work or has expired. Try again.</p>}
            <SignInForm next={next} />
            <p className="xs muted" style={{ marginTop: "var(--s6)" }}>By continuing you agree to our <Link href="/legal/terms" style={{ textDecoration: "underline" }}>Terms</Link> and <Link href="/legal/privacy" style={{ textDecoration: "underline" }}>Privacy policy</Link>.</p>
          </div>
        </div>
        <div className="art d-only">
          <div className="cols">{[0, 4].map((o, c) => <div key={c} className={`col ${c ? "dn" : "up"}`}>{[...col(o), ...col(o)].map((k, i) => <div key={i} className="ph r45"><img src={`/showcase/${k}.webp`} alt="" loading="lazy" decoding="async" /></div>)}</div>)}</div>
          <div className="q"><span className="pill lime">2 photos free</span><h2 className="h3" style={{ color: "#fff", marginTop: "var(--s4)" }}>Your next product shoot is one photo away</h2></div>
        </div>
      </div>
    </div>
  );
}
