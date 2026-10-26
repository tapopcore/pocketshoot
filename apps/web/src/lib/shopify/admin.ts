import "server-only";
import { env } from "../env";
import { ApiError } from "../api";

export async function shopifyGraphql<T = unknown>(shop: { domain: string; accessToken: string }, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${shop.domain}/admin/api/${env.shopifyApiVersion}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": shop.accessToken },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401) throw new ApiError(401, "Shopify access expired. Reload the app.");
  if (res.status === 429) throw new ApiError(429, "Shopify is busy. Try again in a moment.");
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new ApiError(502, `Shopify: ${body.errors.map((e) => e.message).join("; ")}`);
  return body.data as T;
}

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  vendor: string;
  totalInventory: number | null;
  featuredImage: { url: string; altText: string | null } | null;
  images: { id: string; url: string; altText: string | null; width: number; height: number }[];
  sku: string | null;
}

const PRODUCT_FIELDS = `
  id title handle status productType vendor totalInventory
  featuredMedia { preview { image { url altText } } }
  media(first: 10, query: "media_type:IMAGE") { nodes { ... on MediaImage { id image { url altText width height } } } }
  variants(first: 1) { nodes { sku } }
`;

type RawProduct = {
  id: string; title: string; handle: string; status: string; productType: string; vendor: string; totalInventory: number | null;
  featuredMedia: { preview: { image: { url: string; altText: string | null } | null } | null } | null;
  media: { nodes: { id?: string; image?: { url: string; altText: string | null; width: number; height: number } }[] };
  variants: { nodes: { sku: string | null }[] };
};

function mapProduct(p: RawProduct): ShopifyProductSummary {
  return {
    id: p.id, title: p.title, handle: p.handle, status: p.status, productType: p.productType, vendor: p.vendor, totalInventory: p.totalInventory,
    featuredImage: p.featuredMedia?.preview?.image ?? null,
    images: p.media.nodes.filter((n) => n.image && n.id).map((n) => ({ id: n.id!, ...n.image! })),
    sku: p.variants.nodes[0]?.sku ?? null,
  };
}

export async function listProducts(shop: { domain: string; accessToken: string }, opts: { after?: string | null; query?: string | null; first?: number }) {
  const data = await shopifyGraphql<{ products: { nodes: RawProduct[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>(
    shop,
    `query Products($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        nodes { ${PRODUCT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { first: opts.first ?? 24, after: opts.after ?? null, query: opts.query || null },
  );
  return { products: data.products.nodes.map(mapProduct), pageInfo: data.products.pageInfo };
}

export async function getProduct(shop: { domain: string; accessToken: string }, id: string) {
  const data = await shopifyGraphql<{ product: RawProduct | null }>(shop, `query P($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id });
  return data.product ? mapProduct(data.product) : null;
}

/** Adds an image to a product. Shopify downloads it from the (short-lived, signed) URL. */
export async function addProductImage(shop: { domain: string; accessToken: string }, productId: string, url: string, alt: string) {
  const data = await shopifyGraphql<{ productUpdate: { product: { media: { nodes: { id: string; status: string }[] } } | null; userErrors: { field: string[]; message: string }[] } }>(
    shop,
    `mutation AddMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { media(last: 1) { nodes { id status } } }
        userErrors { field message }
      }
    }`,
    { product: { id: productId }, media: [{ originalSource: url, alt: alt.slice(0, 512), mediaContentType: "IMAGE" }] },
  );
  const errs = data.productUpdate.userErrors;
  if (errs.length) throw new ApiError(400, `Shopify: ${errs.map((e) => e.message).join("; ")}`);
  return data.productUpdate.product?.media.nodes[0]?.id ?? null;
}

export async function createOneTimeCharge(shop: { domain: string; accessToken: string }, opts: { name: string; amount: number; currency: string; returnUrl: string; test: boolean }) {
  const data = await shopifyGraphql<{ appPurchaseOneTimeCreate: { appPurchaseOneTime: { id: string } | null; confirmationUrl: string | null; userErrors: { message: string }[] } }>(
    shop,
    `mutation Charge($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
      appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
        appPurchaseOneTime { id }
        confirmationUrl
        userErrors { field message }
      }
    }`,
    { name: opts.name, price: { amount: opts.amount.toFixed(2), currencyCode: opts.currency }, returnUrl: opts.returnUrl, test: opts.test },
  );
  const r = data.appPurchaseOneTimeCreate;
  if (r.userErrors.length || !r.appPurchaseOneTime || !r.confirmationUrl) throw new ApiError(400, `Shopify billing: ${r.userErrors.map((e) => e.message).join("; ") || "no confirmation URL"}`);
  return { chargeId: r.appPurchaseOneTime.id, confirmationUrl: r.confirmationUrl };
}

export async function getOneTimeCharge(shop: { domain: string; accessToken: string }, id: string) {
  const data = await shopifyGraphql<{ node: { id: string; status: string; price: { amount: string; currencyCode: string }; test: boolean } | null }>(
    shop,
    `query C($id: ID!) { node(id: $id) { ... on AppPurchaseOneTime { id status test price { amount currencyCode } } } }`,
    { id },
  );
  return data.node;
}

export async function shopInfo(shop: { domain: string; accessToken: string }) {
  const data = await shopifyGraphql<{ shop: { name: string; email: string; plan: { displayName: string } } }>(shop, `{ shop { name email plan { displayName } } }`);
  return data.shop;
}
