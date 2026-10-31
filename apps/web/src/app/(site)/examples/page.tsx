import { ExamplesGallery } from "@/components/site/examples-gallery";
export const metadata = { title: "Product Photo Examples by Category", description: "Illustrative product photography directions for skincare, sarees, jewellery, shoes, drinks, electronics and more." };
export default async function Examples({ searchParams }: { searchParams: Promise<{ category?: string; industry?: string }> }) {
  const query=await searchParams;
  const byIndustry: Record<string,string>={beauty:"skincare",fashion:"saree",jewellery:"rings",food:"prepared-food",home_kitchen:"decor",electronics:"electronics"};
  const category=typeof query.category==="string"?query.category:byIndustry[query.industry??""]??"skincare";
  return <div className="pg-examples"><section className="phero"><div className="wrap"><span className="kicker"><i/>Examples</span><h1 className="h1">Find your next <span className="it">direction</span></h1><p className="lead">Browse sample products and compare different photographic directions.</p><ExamplesGallery key={category} initialCategory={category}/><p className="xs muted" style={{marginTop:24}}>Illustrative demos; people shown are synthetic adults. Your photos are created from your own references after you confirm the shoot.</p><div style={{height:"var(--section)"}}/></div></section></div>;
}
