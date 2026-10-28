/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import Link from "next/link";
import { Ic } from "@/components/site/ic";
import { BeforeAfter } from "@/components/site/before-after";

export const metadata = { title: "PocketShoot for iPhone and Android", description: "Make product photos from your phone. Same account and credits as the web app." };

export default function Mobile() {
  const ios = process.env.NEXT_PUBLIC_IOS_URL;
  const android = process.env.NEXT_PUBLIC_ANDROID_URL;
  return (
    <div className="pg-apps">
<section className="phero"><div className="wrap ap"><div><span className="kicker"><i></i>iPhone and Android</span><h1 className="h1 s">Product photos from <span className="it">your phone</span></h1><p className="lead">Take the photo, pick a style and share it to Instagram or WhatsApp. Same account and credits as the web.</p><div className="row" style={{ marginTop: 'var(--s6)', flexWrap: 'wrap' }}>{ios ? <Link href={ios} className="btn btn-lg btn-dark"><Ic n="phone" />App Store</Link> : <span className="btn btn-lg btn-soft">iPhone app coming soon</span>}{android ? <Link href={android} className="btn btn-lg btn-dark"><Ic n="phone" />Google Play</Link> : <span className="btn btn-lg btn-soft">Android app coming soon</span>}</div></div><div className="phs"><div className="pf a"><img src="/showcase/saree-3.webp" alt="" /><span className="pill glass" style={{ position: 'absolute', left: '14px', bottom: '14px' }}>Seated portrait</span></div><div className="pf b"><BeforeAfter before="/showcase/rings-before.webp" after="/showcase/rings-3.webp" start={44} labels={null} style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></div></div></div></section><section style={{ height: 'var(--section)' }}></section>
    </div>
  );
}
