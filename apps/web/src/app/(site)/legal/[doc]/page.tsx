import { notFound } from "next/navigation";

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "PackShot";
const UPDATED = "26 October 2026";

/**
 * Starting drafts written in plain language. They must be reviewed by a lawyer
 * (DPDP Act, Consumer Protection (E-Commerce) Rules, GST) before launch.
 */
const DOCS: Record<string, { title: string; sections: [string, string[]][] }> = {
  terms: {
    title: "Terms of Service",
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
    title: "Credits & Refunds Policy",
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

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="eyebrow">Last updated {UPDATED}</div>
      <h1 className="display mt-4 text-6xl">{d.title}</h1>
      {d.sections.map(([h, ps]) => (
        <section key={h}>
          <h2>{h}</h2>
          {ps.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
    </article>
  );
}
