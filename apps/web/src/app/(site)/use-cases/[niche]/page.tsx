/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BeforeAfter } from "@/components/site/before-after";
import { shot } from "@/components/site/bits";
import { signInToShoot } from "@/lib/shoot-catalog";

type Niche = { industry: string; kicker: string; h1: [string, string]; title: string; desc: string; lead: string; ba: [string, string]; styles: [string, string, string][]; };
const N: Record<string, Niche> = {
  beauty: { industry: "beauty", kicker: "Skincare and beauty", h1: ["Skincare product", "photography"], title: "AI Product Photography for Skincare and Beauty Brands", desc: "Create skincare and beauty product photos with real texture, hands and natural light from one phone photo. Labels and ingredient lists stay sharp.", lead: "Glass that catches light, cream with real texture and a hand that shows the size. Every word on your label stays sharp, even the ingredient list.", ba: ["skincare-before", "skincare-3"], styles: [["skincare-0", "Clean studio", "Soft light and a plain backdrop"], ["skincare-1", "In hand", "Shows size and feels personal"], ["skincare-2", "On skin", "A real swatch on real skin"], ["skincare-3", "Texture", "Cream and stone, up close"], ["skincare-4", "Botanical", "Leaves, oils and natural props"], ["fragrance-2", "Held up", "Great for perfume and serums"]] },
  fashion: { industry: "fashion", kicker: "Clothing and sarees", h1: ["Clothing and saree", "photography"], title: "AI Product Photography for Sarees and Clothing", desc: "Turn a flat lay or hanger photo of your saree, kurta or dress into model and lifestyle photos. Fabric, colour and border stay true.", lead: "Show the drape, the border and the way it moves. Fabric, colour and print stay exactly as they are.", ba: ["saree-before", "saree-2"], styles: [["saree-1", "Full drape", "Front view on a model"], ["saree-2", "Courtyard", "Outdoor, natural light"], ["saree-3", "Seated", "Relaxed and elegant"], ["saree-4", "Fabric detail", "Weave and border up close"], ["lehenga-1", "Festive", "Rich colour for occasions"], ["mens-ethnic-2", "Menswear", "Kurtas and sherwanis"]] },
  jewellery: { industry: "jewellery", kicker: "Jewellery", h1: ["Jewellery product", "photography"], title: "AI Product Photography for Jewellery", desc: "Create jewellery photos with sparkle, skin and scale from one phone photo. Stones, metal colour and design stay exact.", lead: "Sparkle without a light tent. Show rings on a hand, necklaces on a neckline and every stone in sharp detail.", ba: ["rings-before", "rings-2"], styles: [["rings-1", "Clean studio", "Plain backdrop for listings"], ["rings-2", "On hand", "Shows size and fit"], ["rings-4", "Stone detail", "Every facet in focus"], ["necklace-2", "Worn", "On a neckline, in daylight"], ["earrings-3", "Close-up", "Texture and shine"], ["bracelets-2", "Lifestyle", "Everyday styling"]] },
  food: { industry: "food", kicker: "Food and drinks", h1: ["Food and drink", "photography"], title: "AI Product Photography for Food and Drink Brands", desc: "Create food and beverage product photos with pours, tables and real ingredients from one photo of your pack or bottle.", lead: "Pours, café tables and fresh ingredients around your pack. Your label, logo and nutrition panel stay readable.", ba: ["beverage-before", "beverage-3"], styles: [["beverage-1", "Clean studio", "For marketplace listings"], ["beverage-2", "With a model", "A real moment of use"], ["beverage-3", "Pouring", "Fresh and appetising"], ["beverage-5", "Table setting", "Outdoor, natural light"], ["packaged-food-2", "Pantry shelf", "At home, in context"], ["prepared-food-1", "Served", "Ingredients on the table"]] },
  "home-kitchen": { industry: "home_kitchen", kicker: "Home and kitchen", h1: ["Home and kitchen", "photography"], title: "AI Product Photography for Home and Kitchen Products", desc: "Place cookware, decor and home products in real kitchens and rooms from one phone photo. Colour and finish stay true.", lead: "Put your cookware on a stove and your decor in a styled room. Shape, colour and finish stay exactly as they are.", ba: ["cookware-before", "cookware-2"], styles: [["cookware-0", "Clean studio", "Plain backdrop for listings"], ["cookware-1", "In use", "On the stove"], ["cookware-4", "Dinner table", "Served and styled"], ["decor-1", "Living room", "Styled interiors"], ["decor-2", "Close-up", "Texture and finish"], ["cookware-5", "Detail", "Handles, lids and finish"]] },
  electronics: { industry: "electronics", kicker: "Electronics", h1: ["Electronics product", "photography"], title: "AI Product Photography for Electronics", desc: "Create electronics product photos with clean studio light, desks and people using your product. Ports, logos and finish stay exact.", lead: "Clean studio light, real desks and people using your product. Ports, buttons and logos stay exactly where they are.", ba: ["electronics-before", "electronics-3"], styles: [["electronics-0", "Clean studio", "For marketplace listings"], ["electronics-2", "In hand", "Shows size"], ["electronics-3", "Lifestyle", "A real moment of use"], ["electronics-4", "Detail", "Ports and finish"], ["electronics-5", "Desk", "At work, in context"], ["electronics-1", "Soft light", "Premium and calm"]] },
};
const OTHERS: [string, string, string][] = [["fashion", "saree-2", "Sarees and clothing"], ["jewellery", "rings-2", "Jewellery"], ["food", "beverage-3", "Food and drinks"], ["home-kitchen", "cookware-2", "Home and kitchen"], ["beauty", "skincare-1", "Skincare and beauty"], ["electronics", "electronics-3", "Electronics"]];

export function generateStaticParams() { return Object.keys(N).map((niche) => ({ niche })); }
export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }) { const n = N[(await params).niche]; return n ? { title: n.title, description: n.desc } : {}; }

export default async function UseCase({ params }: { params: Promise<{ niche: string }> }) {
  const slug = (await params).niche; const n = N[slug]; if (!n) notFound();
  const others = OTHERS.filter(([s]) => s !== slug).slice(0, 4);
  return (
    <div className="pg-category">
      <section className="phero"><div className="wrap cg">
        <div><span className="kicker"><i />{n.kicker}</span><h1 className="h1 s">{n.h1[0]} <span className="it">{n.h1[1]}</span></h1><p className="lead">{n.lead}</p>
          <div className="row" style={{ marginTop: "var(--s6)" }}><Link href={signInToShoot(n.industry)} className="btn btn-lg btn-lime">Try 2 photos free <span className="go"><ArrowRight /></span></Link></div></div>
        <BeforeAfter before={shot(n.ba[0])} after={shot(n.ba[1])} alt={`${n.kicker} product photo`} demo labels={["Before", "After"]} style={{ aspectRatio: 1 }} />
      </div></section>
      <section className="sec"><div className="wrap"><div className="sec-head"><h2 className="h2">Styles made for <span className="it">{n.kicker.toLowerCase()}</span></h2><p className="lead">Pick one, or try a few. Browsing is free.</p></div>
        <div className="gx c3 sec-body" style={{ gap: "var(--s6) var(--s4)" }}>
          {n.styles.map(([k, h, p]) => <div key={k}><div className="ph r11 zoom"><img src={shot(k)} alt={`${h} ${n.kicker.toLowerCase()} product photo`} loading="lazy" /></div><h3 className="h4" style={{ marginTop: "var(--s4)" }}>{h}</h3><p className="sm muted" style={{ marginTop: 4 }}>{p}</p></div>)}
        </div></div></section>
      <section className="sec dk"><div className="wrap"><div className="between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "var(--s5)" }}><h2 className="h2" style={{ color: "#fff" }}>Photos for every product you sell</h2><Link href="/examples" className="link" style={{ color: "#fff" }}>See all examples <ArrowRight /></Link></div>
        <div className="gx c4 sec-body">{others.map(([s, k, l]) => <Link key={s} href={`/use-cases/${s}`}><div className="ph r45 zoom"><img src={shot(k)} alt="" loading="lazy" /></div><div className="h5" style={{ marginTop: 12, color: "#fff" }}>{l}</div></Link>)}</div>
      </div></section>
    </div>
  );
}
