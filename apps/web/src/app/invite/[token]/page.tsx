import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getWebContext, ORG_COOKIE } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { sha256 } from "@/lib/crypto";
import { audit } from "@/lib/observe";
import { Button, LinkButton, Logo } from "@/components/ui";

async function accept(token: string) {
  "use server";
  const ctx = await getWebContext();
  if (!ctx) redirect(`/sign-in?next=/invite/${token}`);
  const db = admin();
  const { data: inv } = await db.from("invitations").select("id, organization_id, email, role, accepted_at, expires_at").eq("token_hash", sha256(token)).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date() || inv.email.toLowerCase() !== ctx.email?.toLowerCase()) redirect(`/invite/${token}`);
  await db.from("memberships").upsert({ organization_id: inv.organization_id, user_id: ctx.userId!, role: inv.role }, { onConflict: "organization_id,user_id", ignoreDuplicates: true });
  await db.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  await audit({ orgId: inv.organization_id, userId: ctx.userId }, "team.joined", { type: "invitation", id: inv.id });
  (await cookies()).set(ORG_COOKIE, inv.organization_id, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  redirect("/app");
}

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();
  const { data: inv } = await db.from("invitations").select("id, organization_id, email, role, accepted_at, expires_at, organizations(name)").eq("token_hash", sha256(token)).maybeSingle();
  const orgName = (inv as unknown as { organizations: { name: string } } | null)?.organizations.name;
  const ctx = await getWebContext();
  let problem: string | null = null;

  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) problem = "This invitation has expired or was already used. Ask for a new one.";
  else if (ctx && ctx.email?.toLowerCase() !== inv.email.toLowerCase()) problem = `This invitation is for ${inv.email}. You're signed in as ${ctx.email}. Sign out and sign in with the invited email.`;

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <Link href="/"><Logo /></Link>
        {problem ? (
          <p className="mt-10 text-ink-2">{problem}</p>
        ) : ctx ? (
          <>
            <h1 className="display mt-10 text-5xl">Join {orgName}</h1>
            <p className="mt-3 text-ink-2">You&apos;ll join as {inv!.role}.</p>
            <form action={accept.bind(null, token)} className="mt-8"><Button>Accept invitation</Button></form>
          </>
        ) : (
          <>
            <h1 className="display mt-10 text-5xl">Join {orgName}</h1>
            <p className="mt-3 text-ink-2">Sign in with <b>{inv!.email}</b> to accept.</p>
            <LinkButton href={`/sign-in?next=/invite/${token}`} className="mt-8">Sign in to accept</LinkButton>
          </>
        )}
      </div>
    </main>
  );
}
