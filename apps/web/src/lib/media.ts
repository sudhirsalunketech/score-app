import { API_URL } from './api';

export const DEFAULT_PROFILE_PHOTO = '/defaults/profile.svg';
export const DEFAULT_TEAM_PHOTO = '/defaults/team.svg';

export type AvatarKind = 'person' | 'team';

export function mediaSrc(src?: string | null): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('/defaults/')) return src;
  if (src.startsWith('/uploads/')) return API_URL ? `${API_URL}${src}` : src;
  return src;
}

export function defaultPhoto(kind: AvatarKind) {
  return kind === 'team' ? DEFAULT_TEAM_PHOTO : DEFAULT_PROFILE_PHOTO;
}

export function avatarSrc(src: string | null | undefined, kind?: AvatarKind) {
  return mediaSrc(src) ?? (kind ? defaultPhoto(kind) : undefined);
}

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

export function isAllowedLogoType(file: { name: string; type: string }) {
  const mimeOk = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
  const nameOk = /\.(jpe?g|png|webp)$/i.test(file.name);
  return mimeOk || nameOk;
}

export function validateLogoFile(file: { name: string; type: string; size: number }): 'PHOTO_TYPE' | 'PHOTO_SIZE' | null {
  if (!isAllowedLogoType(file)) return 'PHOTO_TYPE';
  if (file.size > LOGO_MAX_BYTES) return 'PHOTO_SIZE';
  return null;
}

export async function readPhotoAsDataUrl(file: File) {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    throw new Error('PHOTO_TYPE');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('PHOTO_SIZE');
  }
  const bitmap = await createImageBitmap(file);
  const max = 512;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PHOTO_TYPE');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.84);
}
