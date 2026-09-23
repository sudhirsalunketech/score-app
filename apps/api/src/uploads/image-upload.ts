import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { Errors } from '../common/app-error';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function sniffImageExt(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export const storedImageUrlSchema = z.preprocess(
  (v) => (typeof v === 'string' && !v.trim() ? null : v),
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => isAllowedImageUrl(v), 'Enter a valid image URL')
    .nullable()
    .optional(),
);

export function isAllowedImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(value);
}

export function uploadDir() {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}

export function parseImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) throw Errors.validation('Use a JPG, PNG, or WebP photo.');
  const mime = match[1].toLowerCase();
  if (mime === 'image/svg+xml' || mime.includes('svg')) {
    throw Errors.validation('Use a JPG, PNG, or WebP photo.');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw Errors.validation('Use a JPG, PNG, or WebP photo.');
  if (buffer.length > MAX_IMAGE_BYTES) throw Errors.validation('Photo must be under 5 MB.');
  const ext = sniffImageExt(buffer);
  if (!ext) throw Errors.validation('Use a JPG, PNG, or WebP photo.');
  return { ext, buffer };
}

export async function saveUploadedImage(dataUrl: string) {
  const { ext, buffer } = parseImageDataUrl(dataUrl);
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  await writeFile(join(dir, filename), buffer);
  return { url: `/uploads/${filename}` };
}

export const uploadBodySchema = z.object({
  dataUrl: z.string().min(30).max(7_500_000),
});
