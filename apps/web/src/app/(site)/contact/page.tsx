import { HelpCircle, ChevronRight, Mail, MessageCircle, Users } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";

export const metadata = { title: "Contact PocketShoot", description: "Talk to the PocketShoot team about product photos, billing or bulk work." };

export default function Contact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const wa = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const channels: [typeof Mail, string, string, string | null][] = [
    ...(email ? [[Mail, email, "General questions and billing", `mailto:${email}`] as [typeof Mail, string, string, string]] : []),
    ...(wa ? [[MessageCircle, "WhatsApp chat", wa, `https://wa.me/${wa.replace(/\D/g, "")}`] as [typeof Mail, string, string, string]] : []),
    [HelpCircle, "Quick answers", "Most questions are answered in the FAQ", "/faq"],
    [Users, "Agencies and large catalogues", "Choose Bulk work in the form and tell us your volume", "#message"],
  ];
  return (
    <div className="pg-contact">
      <section className="phero"><div className="wrap ct">
        <div><span className="kicker"><i />Contact</span><h1 className="h1 s">Talk to a <span className="it">real person</span></h1><p className="lead">Questions about a photo, a payment or a large catalogue. We reply within one working day.</p>
          <div className="chs">{channels.map(([I, h, p, href]) => {
            const inner = <><span className="ico"><I /></span><div style={{ flex: 1, minWidth: 0 }}><div className="h5">{h}</div><div className="sm muted">{p}</div></div>{href && <ChevronRight className="chev" aria-hidden />}</>;
            return href ? <a key={h} className="ch" href={href}>{inner}</a> : <div key={h} className="ch">{inner}</div>;
          })}</div></div>
        <ContactForm />
      </div></section>
      <section style={{ height: "var(--section)" }} />
    </div>
  );
}
