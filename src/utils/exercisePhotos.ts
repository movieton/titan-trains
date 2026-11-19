/** Every shipped exercise photo is resized to this box (inside, no upscale). */
export const EXERCISE_PHOTO_WIDTH = 960;
export const EXERCISE_PHOTO_HEIGHT = 536;

/**
 * Prefer WebP. Older records and the photo map used to point at JPG;
 * those URLs are rewritten so a stale `.jpg` string still hits the new file.
 */
export function exercisePhotoSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/\.jpe?g(?=$|\?)/i, '.webp');
}
