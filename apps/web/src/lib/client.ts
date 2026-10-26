"use client";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string>; toast?: { show: (m: string, o?: { isError?: boolean }) => void } };
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: unknown) => void) => void };
  }
}

export class ClientApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Fetch wrapper used by every client screen. Inside the Shopify admin it attaches the App Bridge session token. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (typeof window !== "undefined" && window.shopify?.idToken) {
    headers.set("authorization", `Bearer ${await window.shopify.idToken()}`);
    headers.set("x-client", "shopify");
  }
  const res = await fetch(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
      code = j.code;
    } catch {
      // not JSON
    }
    throw new ClientApiError(res.status, msg, code);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
}

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Uploads files to the signed URLs returned by /api/uploads. */
export async function uploadFiles(files: File[], onProgress?: (done: number) => void): Promise<string[]> {
  const { uploads } = await api<{ uploads: { key: string; url: string }[] }>("/api/uploads", {
    method: "POST",
    json: { files: files.map((f) => ({ name: f.name, type: f.type || "image/jpeg", size: f.size })) },
  });
  let done = 0;
  await Promise.all(
    uploads.map(async (u, i) => {
      const res = await fetch(u.url, { method: "PUT", headers: { "content-type": files[i].type || "image/jpeg", "x-upsert": "true" }, body: files[i] });
      if (!res.ok) throw new ClientApiError(res.status, `Upload of ${files[i].name} failed. Check your connection and try again.`);
      onProgress?.(++done);
    }),
  );
  return uploads.map((u) => u.key);
}

export async function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toast(message: string, isError = false) {
  if (typeof window === "undefined") return;
  if (window.shopify?.toast) return window.shopify.toast.show(message, { isError });
  window.dispatchEvent(new CustomEvent("ps-toast", { detail: { message, isError } }));
}
