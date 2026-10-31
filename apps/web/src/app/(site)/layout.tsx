import { getWebContext } from "@/lib/auth";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getWebContext().catch(() => null);
  return (
    <>
      <SiteNav signedIn={!!ctx} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
