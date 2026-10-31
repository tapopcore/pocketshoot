import { notFound } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot";
const UPDATED = "26 October 2026";

/**
 * Starting drafts written in plain language. They must be reviewed by a lawyer
 * (DPDP Act, Consumer Protection (E-Commerce) Rules, GST) before launch.
 */
const DOCS: Record<string, { title: string; summary?: string[]; sections: [string, string[]][] }> = {
  terms: {
    title: "Terms of Service",
    summary: ["You own the photos you create.", "Only upload products you have the right to sell or show.", "If a photo fails our check, the credit comes back."],
    sections: [
      ["Who we are", [`${NAME} ("we") provides an online service that creates product images from photos you upload. The legal entity operating the service and its address are shown on your invoice and on the Contact page.`]],
      ["Your account", ["You need a verified email to use the service. You're responsible for activity in your workspace, including what team members you invite do.", "You must be 18 or older and able to enter into a contract."]],
      ["What you upload", ["You confirm you own, or have permission to use, the products, brand names, logos and photos you upload.", "Don't upload anything illegal, anything that infringes someone else's rights, or images of people without their consent. See the Acceptable Use Policy."]],
      ["What you get", ["You may use images you create for any lawful commercial purpose related to your products, including websites, marketplaces, ads, packaging and print.", "AI images can contain mistakes. You are responsible for checking every image before you publish it, including that product details, claims and regulatory information are correct. We don't guarantee acceptance by any marketplace or platform."]],
      ["Credits and payment", ["Credits are prepaid. One credit is used for one delivered image at standard size. Prices, taxes and pack sizes are shown before you pay.", "Paid credits are valid for 12 months from purchase; free and bonus credits for the period shown when they're given. Expired credits can't be restored.", "Credits have no cash value and can't be transferred outside your workspace. See the Credits & Refunds Policy for when credits are returned."]],
      ["Service changes", ["We may change features, AI providers or prices. Price changes never affect credits you've already bought."]],
      ["Liability", ["The service is provided as is. To the extent the law allows, our total liability for any claim is limited to the amount you paid us in the 3 months before the claim."]],
      ["Suspension", ["We may suspend accounts that break these terms, abuse the refund process, or put other users at risk. We'll tell you why unless the law prevents it."]],
      ["Governing law", ["These terms are governed by the laws of India. Courts at the city of our registered office have jurisdiction."]],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: ["We never sell your data or train AI on your photos.", "Uploads are private and reached only through short-lived links.", "You can ask us to delete your data at any time."],
    sections: [
      ["What we collect", ["Account details: your email, name and the workspace you belong to.", "Billing details: business name, GSTIN, address and state for invoices. Card and UPI details are handled by our payment partner (Razorpay), Shopify, Apple or Google, and never reach us.", "Your content: product photos you upload and the images we create.", "Usage data: which features you use and basic technical logs, to run and improve the service. We store network addresses only as one-way hashes for fraud prevention."]],
      ["How we use it", ["To provide the service, send you the images, process payments, issue invoices, prevent abuse and give support.", "We do not sell your personal data. We do not use your photos or images to train AI models."]],
      ["Who processes it", ["Hosting and database (Supabase), application hosting (Vercel), AI image providers (such as Google, OpenAI and fal.ai) which receive the photos needed to make each image, payment providers, and email delivery. Some of these process data outside India. We choose providers that don't use API data to train their models by default."]],
      ["How long we keep it", ["Product photos and images: while your workspace is active, or until you delete them. Failed outputs: up to 30 days. Invoices and payment records: 8 years, as tax law requires."]],
      ["Your rights", ["You can access, correct or delete your personal data, and withdraw consent, by writing to us. Under India's Digital Personal Data Protection Act you can also nominate someone to exercise your rights and raise a grievance with our Grievance Officer, whose contact is on the Contact page."]],
      ["Security", ["Uploads are private by default and only reachable with short-lived signed links. Data is encrypted in transit and at rest."]],
    ],
  },
  refunds: {
    title: "Credits and Refunds Policy",
    summary: ["Credits are only used when a photo is delivered.", "Failed photos and changed products give the credit back.", "Unused packs can be refunded within 7 days."],
    sections: [
      ["When a credit is used", ["Credits are held when a shoot starts and only used when an image is delivered to you."]],
      ["Automatic returns", ["If an image fails, times out, or doesn't pass our automatic checks after retries, its credit is returned automatically. You don't need to do anything."]],
      ["Product changed", ["If a delivered image shows your product with a changed logo, changed or wrong label text, a different or missing product, extra items, or clearly wrong colour or shape, report it from the image. When our checks confirm the problem, the credit comes back straight away. Otherwise a person reviews it within one working day and explains the decision."]],
      ["Not to your taste", ["For images you simply don't like, each image includes one free remake within 7 days. These aren't refunded as credits."]],
      ["Money refunds", ["Unused paid credits can be refunded to the original payment method within 7 days of purchase, if none of that pack has been used. After that, purchases are non-refundable except where the law requires otherwise. Purchases through Shopify, the App Store or Google Play follow those platforms' refund processes."]],
      ["Abuse", ["Repeated reports that don't match the images may lead to manual review of all future reports, or suspension."]],
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    summary: ["Only upload products you have rights to.", "No images of real people without consent, and none of minors.", "Don't use photos to mislead buyers."],
    sections: [
      ["Don't upload", ["Products or brands you don't have rights to, including counterfeits.", "Weapons, drugs, tobacco or alcohol where advertising them is illegal, or any illegal product.", "Images of real people without their consent, or any images of minors.", "Sexual, violent or hateful content."]],
      ["Don't use images to", ["Mislead buyers about what a product is, what it contains, or what it does.", "Add false health, safety or certification claims.", "Impersonate another brand."]],
      ["Enforcement", ["We may refuse to process images, remove content, and suspend accounts that break this policy. Our AI providers also apply their own safety filters, and refused requests don't use credits."]],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  return { title: DOCS[(await params).doc]?.title };
}

const NAV: [string, string][] = [["terms", "Terms of service"], ["privacy", "Privacy policy"], ["refunds", "Refund policy"], ["acceptable-use", "Acceptable use"]];
const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const doc = (await params).doc;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="pg-legal">
      <section style={{ padding: "var(--s8) 0 var(--section)" }}><div className="wrap lg">
        <aside className="toc d-only"><div className="sm muted" style={{ fontWeight: 600, marginBottom: "var(--s3)" }}>Legal</div>
          {NAV.map(([k, l]) => <Link key={k} href={`/legal/${k}`} className={k === doc ? "on" : ""}>{l}</Link>)}
          <div className="sm muted" style={{ fontWeight: 600, margin: "var(--s6) 0 var(--s3)" }}>On this page</div>
          {d.sections.map(([h]) => <a key={h} href={`#${slug(h)}`} className="s">{h}</a>)}
        </aside>
        <article className="prose-legal"><span className="xs muted">Last updated {UPDATED}</span><h1 className="h2" style={{ marginTop: "var(--s3)" }}>{d.title}</h1>
          {d.summary && <div className="sum"><h2 className="h5" style={{ margin: 0 }}>In short</h2><ul>{d.summary.map((x) => <li key={x}><Check />{x}</li>)}</ul></div>}
          {d.sections.map(([h, ps], i) => (
            <section key={h} id={slug(h)}><h2>{i + 1}. {h}</h2>{ps.map((p, n) => <p key={n}>{p}</p>)}</section>
          ))}
        </article>
      </div></section>
    </div>
  );
}
