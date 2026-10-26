import { Platform } from "react-native";
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from "react-native-purchases";
import { config } from "./config";

let configured = false;

/**
 * In-app credit packs go through Apple and Google, managed by RevenueCat.
 * Purchasers are identified as "org:<workspace id>" so the server webhook can add credits.
 */
export async function initPurchases(orgId: string) {
  const key = Platform.OS === "ios" ? config.revenuecatIosKey : config.revenuecatAndroidKey;
  if (!key) return false;
  if (!configured) {
    Purchases.configure({ apiKey: key, appUserID: `org:${orgId}` });
    configured = true;
  } else {
    await Purchases.logIn(`org:${orgId}`);
  }
  return true;
}

export function purchasesAvailable() {
  return configured;
}

export async function storeProducts(ids: string[]): Promise<PurchasesStoreProduct[]> {
  if (!configured || ids.length === 0) return [];
  return Purchases.getProducts(ids, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
}

export async function buy(product: PurchasesStoreProduct) {
  return Purchases.purchaseStoreProduct(product);
}
