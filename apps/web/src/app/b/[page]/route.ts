import { babyBusiness } from "@/lib/baby/business";
import { babyPacks } from "@/lib/baby/service";

export const runtime = "nodejs";
export const revalidate = 300;

type Biz = Awaited<ReturnType<typeof babyBusiness>>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const UPDATED = "27 November 2026";

function who(b: Biz) { return b.legalName ? `${esc(b.legalName)} ("we", "us"), which runs Baby Shoot` : `Baby Shoot ("we", "us")`; }
function contactLines(b: Biz) {
  return [
    b.legalName && `<b>${esc(b.legalName)}</b>`,
    b.address && `<span style="white-space:pre-line">${esc(b.address)}</span>`,
    b.gstin && `GSTIN ${esc(b.gstin)}`,
    b.email && `Email: <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`,
    b.phone && `Phone and WhatsApp: ${esc(b.phone)}`,
  ].filter(Boolean).join("<br>");
}

const PAGES: Record<string, { title: string; body: (b: Biz, packs: Awaited<ReturnType<typeof babyPacks>>) => string }> = {
  terms: { title: "Terms of use", body: (b) => `
<p>These terms are an agreement between you and ${who(b)}. By using baby-shoot.com or the Baby Shoot app you agree to them.</p>
<h2>What Baby Shoot does</h2>
<p>Baby Shoot makes studio-style portraits of your baby from photos you add. The portraits are made by computer (generative AI) from your photos. They are made to look like your baby, but small details can differ from real life.</p>
<h2>Who can use it</h2>
<p>You must be 18 or older. Only add photos of a baby you are the parent or legal guardian of. By adding photos you confirm this and give your consent, as parent or guardian, for us to process them to make your portraits.</p>
<h2>Prices and payment</h2>
<p>Prices are shown in Indian rupees and include GST. You always see the price before you pay. Payments are handled by Razorpay; we never see your card, UPI or bank details. Each paid photo is credited to your account the moment payment succeeds and can be used for 12 months. Your first photo is free, once per person.</p>
<h2>Remakes, failures and refunds</h2>
<p>Every photo includes one free remake. If a photo fails to make, the photo is returned to your account automatically. Refunds are covered in our <a href="/refunds">refund policy</a>.</p>
<h2>Your photos</h2>
<p>The photos you add and the portraits we make for you are yours. You give us permission to store and process them only to make, show and deliver your portraits. We do not use them for advertising and do not sell them. You can delete them at any time.</p>
<h2>Fair use</h2>
<p>Do not add photos of other people's children, photos you have no right to use, or anything unlawful. Do not try to misuse, copy or overload the service. We may refuse or stop service to anyone who breaks these terms, and refund any unused paid photos when we do.</p>
<h2>Limits</h2>
<p>We work hard to keep Baby Shoot running and your photos safe, but the service is provided as it is. To the extent the law allows, our total liability for any claim is limited to the amount you paid us in the 3 months before the claim.</p>
<h2>Changes and law</h2>
<p>We may update these terms; the date below shows the latest version. These terms are governed by the laws of India.</p>
<h2>Contact</h2><p>${contactLines(b) || "Use Contact us in the app."}</p>` },

  privacy: { title: "Privacy policy", body: (b) => `
<p>This policy explains how ${who(b)} handles your information, in line with India's Digital Personal Data Protection Act, 2023.</p>
<h2>What we collect</h2>
<p>Your name and email (or Google account name and email), your baby's name and age band if you add them, the photos of your baby you add, the portraits we make, and a record of your payments and invoices. Card, UPI and bank details stay with Razorpay; we never see them.</p>
<h2>Why we use it</h2>
<p>Only to sign you in, make and deliver your portraits, keep your shoots, issue GST invoices, prevent misuse of free photos, and answer you when you contact us. We never sell your data, never use your baby's photos for advertising, and never use them to train AI models.</p>
<h2>Your baby's photos</h2>
<p>A baby's photos are a child's personal data. We process them only with your consent as parent or guardian, which you give when you add them, and only to make your portraits. We do not track or profile children.</p>
<h2>Who helps us</h2>
<p>OpenAI (image generation), Razorpay (payments), Supabase and Vercel (secure hosting and storage), and Google (if you sign in with Google). Each gets only what it needs to do its part. Our image partner may keep a copy for up to 30 days for safety checks before deleting it.</p>
<h2>How long we keep it</h2>
<p>Photos of your baby that you add are deleted after 90 days, or after each shoot if you choose that in the app. Portraits stay in your account until you delete them or your account. Invoices are kept for 8 years because tax law requires it.</p>
<h2>Your rights</h2>
<p>You can see, correct, download or delete your data at any time from the You tab in the app. Deleting your account erases your baby's photos, shoots and details. You can withdraw consent the same way. For anything else, or a complaint, write to us below; we reply within 7 days.</p>
<h2>Grievance contact</h2><p>${contactLines(b) || "Use Contact us in the app."}</p>` },

  refunds: { title: "Refund and cancellation policy", body: (b) => `
<p>Baby Shoot sells digital portraits delivered in the app. You pay per photo or per shoot, with no subscription, so there is nothing to cancel.</p>
<h2>If a photo fails</h2>
<p>If a photo fails to make, you are not charged for it: the photo is returned to your account straight away and you can use it again.</p>
<h2>If you don't like a photo</h2>
<p>Every photo comes with one free remake. Use it first; you can keep whichever take you prefer.</p>
<h2>Refunds</h2>
<p>If something still isn't right, write to us within 7 days of your shoot with your registered email. We'll fix it or refund you. Unused paid photos can also be refunded within 7 days of purchase.</p>
<p>Approved refunds go back to your original payment method within 5 to 7 working days.</p>
<h2>Contact</h2><p>${contactLines(b) || "Use Contact us in the app."}</p>` },

  delivery: { title: "Delivery policy", body: (b) => `
<p>Baby Shoot is a digital service. Nothing is shipped.</p>
<h2>How you get your photos</h2>
<p>Your portraits are delivered in the Baby Shoot app and on baby-shoot.com, in your account, as soon as they are made. A single photo usually takes under a minute; a full shoot takes a few minutes. You can save them to your phone in full quality or share them from there.</p>
<h2>When payment is taken</h2>
<p>Your paid photos are added to your account the moment Razorpay confirms the payment. If a payment succeeds but your photos don't appear within 30 minutes, contact us and we'll sort it out the same day.</p>
<h2>Contact</h2><p>${contactLines(b) || "Use Contact us in the app."}</p>` },

  contact: { title: "Contact us", body: (b) => `
<p>We're happy to help with a photo, a payment or anything else.</p>
<p>${contactLines(b) || "Use Contact us in the app."}</p>
<p>We reply within one working day, Monday to Saturday.</p>` },

  pricing: { title: "Prices", body: (b, packs) => `
<p>Pay for what you make, when you make it. No subscription. Your first photo is free.</p>
<table>${packs.map((p) => `<tr><td><b>${esc(p.name)}</b>${p.credits > 1 ? `<br><span class="m">₹${Math.round(p.price_minor / 100 / p.credits)} a photo</span>` : ""}</td><td>₹${(p.price_minor / 100).toLocaleString("en-IN")}</td></tr>`).join("")}</table>
<p>Prices include GST. Every photo is full quality with no watermark and includes one free remake. If a photo fails, you are not charged for it.</p>` },
};

export async function GET(_req: Request, route: { params: Promise<{ page: string }> }) {
  const { page } = await route.params;
  const p = PAGES[page];
  if (!p) return new Response("Not found", { status: 404 });
  const [b, packs] = await Promise.all([babyBusiness(), page === "pricing" ? babyPacks() : Promise.resolve([])]);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.title} · Baby Shoot</title><meta name="theme-color" content="#ffffff"><link rel="icon" href="/baby/icons/icon-192.png">
<style>:root{--ink:#1c1b18;--m:#67625a;--line:#e9e5dc;--bg:#f6f4ef;--pink:#d63f74}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif;padding:0 max(16px,env(safe-area-inset-left,0px))}
main{max-width:680px;margin:0 auto;padding:28px 0 48px}header{display:flex;align-items:center;gap:10px;margin-bottom:28px}header img{height:40px}
header a{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;font-weight:700;font-size:18px}
h1{font-size:30px;line-height:1.15;margin:0 0 16px}h2{font-size:18px;margin:28px 0 6px}a{color:var(--pink)}
table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:12px 0;border-bottom:1px solid var(--line)}td:last-child{text-align:right;font-weight:700}.m{color:var(--m);font-size:14px}
footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--m)}footer nav{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:10px}footer a{color:var(--m)}
.upd{color:var(--m);font-size:13px}</style></head><body><main>
<header><a href="/"><img src="/baby/brand/mark.png" alt="">Baby Shoot</a></header>
<h1>${p.title}</h1>${page !== "contact" && page !== "pricing" ? `<p class="upd">Last updated ${UPDATED}</p>` : ""}
${p.body(b, packs)}
<footer><nav><a href="/">Open Baby Shoot</a><a href="/pricing">Prices</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a><a href="/delivery">Delivery</a><a href="/contact">Contact</a></nav>
© 2026 ${esc(b.legalName || "Baby Shoot")}.${b.legalName ? ` Baby Shoot is a product of ${esc(b.legalName)}.` : ""}</footer>
</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" } });
}
