import { StudioPage } from "./load";

export const metadata = { title: "Studio" };

export default async function NewShoot({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const sp = await searchParams;
  return <StudioPage productId={sp.product} />;
}
