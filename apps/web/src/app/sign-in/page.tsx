import { redirect } from "next/navigation";
import Link from "next/link";
import { getWebContext } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") && !sp.next.includes("\\") ? sp.next : "/app";
  if (await getWebContext()) redirect(next);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <Link href="/"><Logo className="text-paper" /></Link>
        <div>
          <div className="eyebrow !text-paper/60">Frame 01 / Your product</div>
          <p className="display mt-4 text-6xl leading-[0.95]">Your next shoot.<br /><em className="text-accent">A fresh perspective.</em></p>
        </div>
        <div className="grid grid-cols-3 gap-3 opacity-80">
          {["indoor", "model", "graphic"].map((c, i) => (
            <div key={c} className="cropmarks relative aspect-[4/5] overflow-hidden rounded-md" >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={"/catalog/" + c + ".webp"} alt="AI-created product photography example" className="size-full object-cover" /><div className="frame-no absolute bottom-2 left-2 !text-white/70">{String(i + 1).padStart(2, "0")}A</div>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <Link href="/" className="mb-12 lg:hidden"><Logo /></Link>
        <div className="mx-auto w-full max-w-sm animate-rise">
          <h1 className="display text-5xl">Sign in</h1>
          <p className="mt-2 text-ink-2">Your products, shoots and credits in one place. New here? Signing in creates your account.</p>
          {sp.error && <p className="mt-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">That sign-in link didn&apos;t work or has expired. Try again.</p>}
          <SignInForm next={next} />
          <p className="mt-8 text-xs text-mute">
            By continuing you agree to our <Link className="underline" href="/legal/terms">Terms</Link> and <Link className="underline" href="/legal/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
