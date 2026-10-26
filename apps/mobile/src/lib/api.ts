import { config } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Calls the web app's API with the signed-in user's token. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  if (init.json !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  } catch {
    throw new ApiError(0, "No internet connection. Check your network and try again.");
  }
  if (!res.ok) {
    let msg = `Something went wrong (${res.status})`;
    let code: string | undefined;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
      code = j.code;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, msg, code);
  }
  return res.json() as Promise<T>;
}

export function newKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Uploads local image files (already JPEG) to signed storage URLs. Returns storage keys. */
export async function uploadImages(uris: string[]): Promise<string[]> {
  const blobs = await Promise.all(uris.map(async (u) => (await fetch(u)).blob()));
  const { uploads } = await api<{ uploads: { key: string; url: string }[] }>("/api/uploads", {
    method: "POST",
    json: { files: blobs.map((b, i) => ({ name: `photo-${i + 1}.jpg`, type: "image/jpeg", size: b.size || 1 })) },
  });
  await Promise.all(uploads.map(async (u, i) => {
    const r = await fetch(u.url, { method: "PUT", headers: { "content-type": "image/jpeg", "x-upsert": "true" }, body: blobs[i] });
    if (!r.ok) throw new ApiError(r.status, "Upload failed. Check your connection and try again.");
  }));
  return uploads.map((u) => u.key);
}
