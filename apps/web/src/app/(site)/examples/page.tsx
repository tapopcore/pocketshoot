import { BeforeAfter } from "@/components/site/before-after";
import { ExamplesGallery } from "@/components/site/examples-gallery";

export const metadata = { title: "AI Product Photo Examples by Category", description: "Real before and after examples of AI product photography for skincare, sarees, jewellery, shoes, drinks, electronics and more." };

export default function Examples() {
  return (
    <div className="pg-examples">
<section className="phero"><div className="wrap"><span className="kicker"><i></i>Examples</span><h1 className="h1">Before and after <span className="it">examples</span></h1><p className="lead">Every photo below was made from one plain phone photo. The small photo in the corner is the original.</p><div className="feat">{([["saree-before", "saree-1", "Saree"], ["rings-before", "rings-4", "Ring"], ["skincare-before", "skincare-4", "Body lotion"]] as const).map(([b, a, n]) => <figure key={a}><BeforeAfter before={`/showcase/${b}.webp`} after={`/showcase/${a}.webp`} alt={`${n} product photo`} labels={["Before", "After"]} style={{ aspectRatio: "1" }} /><figcaption className="sm"><b>{n}</b><span className="muted">Drag to compare</span></figcaption></figure>)}</div><ExamplesGallery /><div style={{ height: "var(--section)" }} /></div></section>
    </div>
  );
}
