import { StudioPage } from "./load";

export const metadata = { title: "Studio" };

export default async function NewShoot({ searchParams }: { searchParams: Promise<{ product?: string; industry?: string; look?: string }> }) {
  const sp = await searchParams;
  return <StudioPage productId={sp.product} industry={sp.industry} look={sp.look} />;
}
