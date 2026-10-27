"use client";

/** Files dropped on the dashboard are handed to the studio through this in-memory slot. */
let pending: File[] = [];
export function setPendingFiles(files: File[]) { pending = files; }
export function takePendingFiles(): File[] { const f = pending; pending = []; return f; }

export function checkPhoto(f: File): string | null {
  if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) return "This HEIC photo cannot be opened here yet. Choose a JPG export from Photos, or use Take a photo. Your saved draft is kept.";
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return `${f.name} isn't a JPG, PNG or WebP image.`;
  if (f.size > 25 * 1024 * 1024) return `${f.name} is larger than 25 MB.`;
  return null;
}

/** Shrinks big phone photos before upload (faster on mobile data, same quality for the AI). */
export async function shrinkPhoto(file: File, maxEdge = 3072): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 4 * 1024 * 1024) { bmp.close(); return file; }
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
