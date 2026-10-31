import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { clientIp } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";

const TOPICS = ["photo", "payment", "bulk", "other"] as const;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Public contact form. Stored for the team, emailed to ALERT_EMAIL when email is configured. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { name?: string; email?: string; topic?: string; message?: string; website?: string } | null;
  if (!b) return NextResponse.json({ error: "Send the form again." }, { status: 400 });
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: bots fill hidden fields
  const name = (b.name ?? "").trim().slice(0, 120), email = (b.email ?? "").trim().slice(0, 254), message = (b.message ?? "").trim().slice(0, 4000);
  const topic = TOPICS.includes(b.topic as (typeof TOPICS)[number]) ? b.topic! : "other";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) return NextResponse.json({ error: "Add your name, a valid email and a short message." }, { status: 400 });
  const db = admin();
  const ipHash = sha256(`contact:${await clientIp()}`);
  const { count } = await db.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "You've sent a few messages already. We'll reply soon." }, { status: 429 });
  const { error } = await db.from("contact_messages").insert({ name, email, topic, message, ip_hash: ipHash });
  if (error) return NextResponse.json({ error: "We couldn't send that. Try again in a minute." }, { status: 500 });
  if (env.alertEmail) await sendEmail(env.alertEmail, `Contact form: ${topic} from ${name}`, `<p><b>${esc(name)}</b> (${esc(email)})</p><p>${esc(message).replace(/\n/g, "<br>")}</p>`).catch(() => false);
  return NextResponse.json({ ok: true });
}
