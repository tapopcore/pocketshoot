import type { CategoryId } from "@packshot/core";
export { SHOOT_STYLES, SHOOT_STYLE_IDS, type ShootStyleId } from "@packshot/core";
export const INDUSTRIES: { id: CategoryId; title: string; image: string }[] = [
  { id: "beauty", title: "Beauty & skincare", image: "/catalog/beauty.webp" },
  { id: "fashion", title: "Fashion & accessories", image: "/catalog/fashion.webp" },
  { id: "jewellery", title: "Jewellery", image: "/catalog/jewellery.webp" },
  { id: "food", title: "Food & drink", image: "/catalog/food.webp" },
  { id: "home_kitchen", title: "Home & living", image: "/catalog/home.webp" },
  { id: "electronics", title: "Electronics", image: "/catalog/electronics.webp" },
];
export function startLink(industry?: string, look?: string) {
  const p = new URLSearchParams();
  if (industry) p.set("industry", industry);
  if (look) p.set("look", look);
  return "/app/new" + (p.size ? "?" + p.toString() : "");
}
export function signInToShoot(industry?: string, look?: string) {
  return "/sign-in?next=" + encodeURIComponent(startLink(industry, look));
}
