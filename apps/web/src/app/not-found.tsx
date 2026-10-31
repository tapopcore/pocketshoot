/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SiteNav } from "@/components/site/site-nav";

export default function NotFound() {
  return (
    <div className="pg-404">
      <SiteNav signedIn={false} />
<section style={{ padding: 'var(--s9) 0', textAlign: 'center' }}><div className="wrap"><img src="/brand/mark-light.svg" alt="" style={{ width: '120px', margin: '0 auto' }} /><div className="nf">404</div><h1 className="h2" style={{ marginTop: 'var(--s5)' }}>We could not find that page</h1><p className="lead" style={{ margin: 'var(--s4) auto 0', maxWidth: '520px' }}>The link may be old or mistyped, but your shoots and photos are safe.</p><div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s6)' }}><Link href="/" className="btn btn-dark">Go to home</Link><Link href="/app/shoots" className="btn btn-soft">Open my shoots</Link></div></div></section>
    </div>
  );
}
