import { ExamplesGallery } from "@/components/site/examples-gallery";

export const metadata = { title: "AI Product Photo Examples by Category", description: "Real before and after examples of AI product photography for skincare, sarees, jewellery, shoes, drinks, electronics and more." };

export default function Examples() {
  return (
    <div className="pg-examples">
<section className="phero"><div className="wrap"><span className="kicker"><i></i>Examples</span><h1 className="h1">Before and after <span className="it">examples</span></h1><p className="lead">Pick a product and drag the handle to see the plain phone photo it started from.</p><ExamplesGallery /><div style={{ height: "var(--section)" }} /></div></section>
    </div>
  );
}
