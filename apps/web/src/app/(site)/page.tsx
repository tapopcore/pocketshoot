/* eslint-disable @next/next/no-img-element -- original, pre-sized campaign examples */
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Check, Camera, Fingerprint, Layers3 } from "lucide-react";
import { webPacks } from "@/lib/public";
import { StyleGallery } from "@/components/style-gallery";

export const revalidate = 300;
const money = (minor: number) => "₹" + Math.round(minor / 100).toLocaleString("en-IN");
const worlds = [
  { image: "/looks/footwear-2.webp", title: "Made for the street", type: "Footwear", href: "fashion" },
  { image: "/looks/skincare-5.webp", title: "A little more character", type: "Beauty", href: "beauty" },
  { image: "/looks/saree-2.webp", title: "Let the fabric move", type: "Indian fashion", href: "fashion" },
];
export default async function Home() {
  const packs = await webPacks();
  const featured = ["creator", "brand", "business"].map(code => packs.find(p => p.code === code)).filter(p => !!p);
  return <div className="campaign-site">
    <section className="campaign-hero wrap">
      <div className="campaign-intro"><span className="kicker"><i />Product photography, with a point of view</span>
        <h1>Your product.<br />A world <span className="it">of its own.</span></h1>
        <p>A clean catalogue. A candid moment. A campaign with character. Create a shoot around what makes your product yours.</p>
        <div className="campaign-actions"><Link href="/sign-in?next=%2Fapp%2Fnew" className="btn btn-lime btn-lg">Create your shoot <ArrowUpRight size={20} /></Link><a href="#looks" className="link">Find your direction <ArrowRight size={18} /></a></div>
        <div className="campaign-assurance"><span><Check size={15} />Your first 2 photos are free</span><span><Check size={15} />No card needed</span></div>
      </div>
      <div className="campaign-triptych">{worlds.map((world, n) => <Link href={"/examples?industry=" + world.href} className={"campaign-frame frame-" + n} key={world.type}>
        <img src={world.image} alt={world.type + " — original illustrative campaign example"} width={640} height={640} fetchPriority={n === 0 ? "high" : "auto"} decoding="async" />
        <div><span>{world.type}</span><b>{world.title}</b><ArrowUpRight size={20} /></div>
      </Link>)}</div>
      <p className="campaign-caption">Original AI-created examples. Explore the direction, then make it your product.</p>
    </section>
    <section className="campaign-proof wrap"><div><Fingerprint /><b>Your details matter</b><span>Shape, colour, construction and print are checked against your photos.</span></div><div><Camera /><b>Choose the purpose</b><span>Studio, real-life context or a closer look. Each photo has a job.</span></div><div><Layers3 /><b>One product or a whole range</b><span>Create one shoot, a coordinated set, or a batch for your catalogue.</span></div></section>
    <section className="sec" id="looks"><div className="wrap"><div className="campaign-section-head"><div><span className="kicker">A direction for your category</span><h2 className="h2">Different products.<br /><span className="it">Different worlds.</span></h2></div><p>Start with your industry. See examples made for that kind of product, from Indian textiles and everyday jewellery to beauty, food and footwear.</p></div><div className="sec-body"><StyleGallery /></div></div></section>
    <section className="campaign-process"><div className="wrap"><div className="campaign-section-head"><div><span className="kicker">From your camera roll to your next campaign</span><h2 className="h2">A good shoot starts<br />with <span className="it">your product.</span></h2></div><Link href="/sign-in?next=%2Fapp%2Fnew" className="btn btn-lime">Start a shoot <ArrowRight size={18} /></Link></div><ol className="campaign-steps">
      <li><span>01</span><h3>Show us what makes it yours.</h3><p>Upload a clear photo or take one on your phone. Add the back, sides or details when the design needs them.</p></li>
      <li><span>02</span><h3>Pick a direction. See the price.</h3><p>Confirm the product, choose a visual style and a photo size. Shared examples are free to browse.</p></li>
      <li><span>03</span><h3>Make a set worth using.</h3><p>Your photos are created and checked. Download individual images or the complete set; rejected photos use no customer credit.</p></li>
    </ol></div></section>
    <section className="sec"><div className="wrap"><div className="campaign-section-head"><div><span className="kicker">Built for the way you sell</span><h2 className="h2">A photo for <span className="it">every job.</span></h2></div><p>Choose a clean main image for your listing, an in-use moment for your store, or a closer detail for the customer who wants to be sure.</p></div><div className="campaign-formats">
      {[['/showcase/studio/front.webp','The catalogue','Clean product. Clear details.'],['/looks/footwear-2.webp','The campaign','Context, character and movement.'],['/looks/earrings-4.webp','The close-up','Material that feels tangible.']].map(([image,title,copy])=><Link href="/sign-in?next=%2Fapp%2Fnew" key={title}><div><img src={image} alt={title + ' — illustrative example'} width={640} height={640} loading="lazy" decoding="async" /></div><h3>{title}<ArrowUpRight size={20}/></h3><p>{copy}</p></Link>)}
    </div></div></section>
    <section className="sec campaign-pricing"><div className="wrap"><div className="sec-head c"><span className="kicker">Know the price before you create</span><h2 className="h2">Your shoot. <span className="it">Your pace.</span></h2><p className="lead">1 credit per photo. No subscription required.</p></div><div className="campaign-price-grid sec-body">{featured.map(p=>p&&<div key={p.id} className="card p"><span className="kicker">{p.name}</span><h3>{money(p.price_minor)}</h3><p>{p.credits} photo credits</p><ul><li><Check size={16}/>Studio and category-specific looks</li><li><Check size={16}/>Full-size downloads, no added watermark</li><li><Check size={16}/>Credits valid for 12 months</li></ul><Link href="/sign-in?next=%2Fapp%2Fwallet" className="btn btn-soft btn-block">Choose {p.name}<ArrowRight size={17}/></Link></div>)}</div><Link href="/pricing" className="link">See all credit packs <ArrowRight size={17}/></Link></div></section>
    <section className="wrap campaign-faq"><h2 className="h2">Before your <span className="it">first shoot.</span></h2><div className="qa"><details><summary>Will the design stay the same?<i>+</i></summary><p>We use your reference photos and check the visible shape, colour, construction, print and inventory. AI can still make mistakes. Extra views help with different camera angles; a rejected result is not charged to your credits.</p></details><details><summary>Do examples cost me credits?<i>+</i></summary><p>No. Style examples are shared demonstration images. Uploading your product does not generate a paid image preview. You see the photo count and credit price before you create.</p></details><details><summary>Are the example people real models?<i>+</i></summary><p>The examples are AI-created and people shown are synthetic adults. They illustrate a photographic direction, not a guarantee of an identical result.</p></details><details><summary>Can I create several products together?<i>+</i></summary><p>Use Bulk shoots for separate products in your catalogue. Use multiple reference photos in a single shoot for different views of the same product.</p></details></div></section>
    <section className="wrap campaign-end"><span className="kicker">Make something your customers can picture.</span><h2>Give your product<br /><span className="it">its next chapter.</span></h2><Link href="/sign-in?next=%2Fapp%2Fnew" className="btn btn-lime btn-lg">Create your first shoot <ArrowUpRight size={20}/></Link></section>
  </div>;
}
