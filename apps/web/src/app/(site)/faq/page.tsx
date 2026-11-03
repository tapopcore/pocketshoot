import Link from "next/link";
import { FaqList, type FaqGroup } from "@/components/site/faq-list";

export const metadata = { title: "AI Product Photography FAQ", description: "Answers about AI product photos: what to upload, label accuracy, marketplace sizes, credits, pricing and refunds." };

const GROUPS: FaqGroup[] = [
  { group: "Getting started", items: [
    { q: "What is AI product photography?", a: "You upload a normal photo of your product and PocketShoot creates new photos from it: studio shots, lifestyle scenes, photos with a model and close-ups." },
    { q: "What kind of photo should I upload?", a: "A clear phone photo with the whole product in frame and the label facing you. Daylight from a window works best." },
    { q: "Which products work well?", a: "Bottles, jars, boxes, jewellery, shoes, bags, clothing, sarees, food packs and electronics. Very shiny or see-through items may need a second photo." },
    { q: "Do I need to write prompts?", a: "No. You choose a style from example photos. If you want something specific, add a short note in plain words." },
  ] },
  { group: "Your photos", items: [
    { q: "Will my label and logo change?", a: "No. We use your real product and check every photo against your original. If something changes, the photo is flagged and you are not charged." },
    { q: "Who owns the photos?", a: "You do. Use them on your website, marketplaces, ads, social media and print." },
    { q: "Can I get a white background for Amazon?", a: "Yes. Pick the clean studio style or download any photo with a white background." },
    { q: "What sizes can I download?", a: "Square, portrait 4:5, story 9:16 and wide banners, as JPG, PNG or WebP." },
  ] },
  { group: "Credits and payment", items: [
    { q: "How much does a photo cost?", a: "1 credit per photo. Packs start at ₹499 for 5 photos and go down to ₹50 a photo on bigger packs. Your first 2 photos are free." },
    { q: "Do credits expire?", a: "Paid credits last 12 months. Free credits last 60 days." },
    { q: "What if a photo fails?", a: "Credits are only held while a photo is being made. If it fails, the credit comes back automatically." },
    { q: "Do I get a GST invoice?", a: "Yes. Add your GSTIN at checkout and download invoices from your account." },
  ] },
];

export default function Faq() {
  return (
    <div className="pg-faq">
      <section className="phero c"><div className="wrap"><span className="kicker"><i />Help</span><h1 className="h1">Questions and <span className="it">answers</span></h1><p className="lead">Everything sellers ask before their first shoot.</p>
        <FaqList groups={GROUPS} />
        <div className="fq" style={{ margin: "0 auto", textAlign: "left" }}><div className="card pl help"><div><h2 className="h4">Still have a question?</h2><p className="body muted" style={{ marginTop: 4 }}>A real person replies within one working day.</p></div><Link href="/contact" className="btn btn-dark">Message us</Link></div></div>
        <div style={{ height: "var(--section)" }} />
      </div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: GROUPS.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } }))) }) }} />
    </div>
  );
}
