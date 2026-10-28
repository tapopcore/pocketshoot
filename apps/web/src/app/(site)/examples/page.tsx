import { BeforeAfter } from "@/components/site/before-after";
import { ExamplesGallery } from "@/components/site/examples-gallery";

export const metadata = { title: "AI Product Photo Examples by Category", description: "Real before and after examples of AI product photography for skincare, sarees, jewellery, shoes, drinks, electronics and more." };

export default function Examples() {
  return (
    <div className="pg-examples">
<section className="phero"><div className="wrap"><span className="kicker"><i></i>Examples</span><h1 className="h1">Before and after <span className="it">examples</span></h1><p className="lead">Every photo below was made from one plain phone photo. The small image in the corner shows the original.</p><div className="feat"><BeforeAfter before="/showcase/saree-before.webp" after="/showcase/saree-2.webp" labels={['Before','After']} style={{ aspectRatio: '4/3' }} /><BeforeAfter before="/showcase/rings-before.webp" after="/showcase/rings-3.webp" start={42} labels={['Before','After']} style={{ aspectRatio: 'auto', height: '100%' }} /></div><ExamplesGallery /><div style={{ height: "var(--section)" }} /></div></section>
    </div>
  );
}
