import { Mail, MessageCircle } from "lucide-react";

export const metadata = { title: "Contact" };

export default function Contact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
  const wa = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="eyebrow">Contact</div>
      <h1 className="display mt-4 text-6xl">Talk to a person.</h1>
      <p className="mt-4 text-ink-2">Questions about an image, a bulk order, or using us for your clients? We reply within one working day, usually sooner.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${email}`} className="rounded-xl border border-line bg-card p-6 hover:border-ink"><Mail /><div className="display mt-3 text-3xl">Email</div><div className="mt-1 text-sm text-mute">{email}</div></a>
        {wa && <a href={`https://wa.me/${wa.replace(/\D/g, "")}`} className="rounded-xl border border-line bg-card p-6 hover:border-ink"><MessageCircle /><div className="display mt-3 text-3xl">WhatsApp</div><div className="mt-1 text-sm text-mute">{wa}</div></a>}
      </div>
      <p className="mt-8 text-sm text-mute">Already a customer? Use Help inside the app so we can see your shoot.</p>
    </div>
  );
}
