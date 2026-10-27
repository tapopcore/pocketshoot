import { StudioPage } from "./new/load";

export const metadata = { title: "Studio" };

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string; product?: string; industry?: string; look?: string }> }) {
  const sp = await searchParams;
  return <StudioPage productId={sp.product} denied={!!sp.denied} industry={sp.industry} look={sp.look} />;
}
