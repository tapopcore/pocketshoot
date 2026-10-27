/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
export const metadata = { title: "How a shoot works" };
const STEPS = [
  { n: "01", title: "Tell us what you sell.", image: "beauty", text: "Choose your industry: beauty, fashion, jewellery, food, home or electronics. Something different? Choose Something else." },
  { n: "02", title: "Choose a style you can see.", image: "model", text: "Compare six clear photographic examples. Pick indoor, outdoor, with a model, close-up, macro or a graphic campaign. Browsing styles does not generate images." },
  { n: "03", title: "Add a clear product photo.", image: "indoor", text: "Show the whole product in soft light with a sharp label. We study its visible materials and details. Your photo guides the product; the style guides the scene." },
  { n: "04", title: "Create, review, make it yours.", image: "graphic", text: "Choose a shape and image count. Check the credit total, then press Create. Review labels, materials and human details before you download or publish." },
];
export default function HowItWorks() { return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
  <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">From product to photograph</p><h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">Four decisions.<br />A clear creative direction.</h1>
  <div className="mt-10 grid gap-9 sm:grid-cols-2">{STEPS.map(s => <section key={s.n}><img src={"/catalog/" + s.image + ".webp"} alt={s.title + " illustrated with an AI-created example"} width={512} height={512} className="aspect-[4/3] w-full rounded-2xl object-cover" /><p className="mt-4 font-mono text-xs text-accent-ink">{s.n}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{s.title}</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-2">{s.text}</p></section>)}</div>
  <div className="mt-12 rounded-2xl bg-paper-2 p-6"><h2 className="text-lg font-semibold">What the checks can do</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">Automatic checks compare visible product details, dimensions and photographic issues. AI can still alter details. Check results closely, especially text, jewellery settings, hands and faces. Failed undelivered images release reserved credits under the credit policy.</p><Link href="/legal/refunds" className="mt-3 inline-flex min-h-11 items-center text-sm underline">Credit and refund policy</Link></div>
  <Link href="/sign-in?next=%2Fapp%2Fnew" className="mt-8 inline-flex min-h-13 items-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-white">Find your style <ArrowRight size={17} /></Link>
</div>; }
