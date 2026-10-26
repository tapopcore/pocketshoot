import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Normalises a captured or picked photo before upload: converts HEIC to JPEG,
 * fixes orientation, and caps the long edge at 2400px to keep uploads quick.
 */
export async function prepareForUpload(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const long = Math.max(width ?? 0, height ?? 0);
  if (long > 2400) {
    if ((width ?? 0) >= (height ?? 0)) ctx.resize({ width: 2400 });
    else ctx.resize({ height: 2400 });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return out.uri;
}
