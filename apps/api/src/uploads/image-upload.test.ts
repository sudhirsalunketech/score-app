import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedImageUrl, MAX_IMAGE_BYTES, parseImageDataUrl, saveUploadedImage, sniffImageExt } from './image-upload';

const originalUploadDir = process.env.UPLOAD_DIR;

afterEach(() => {
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
});

describe('image upload', () => {
  it('accepts stored upload paths and http URLs', () => {
    expect(isAllowedImageUrl('/uploads/123-ab.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isAllowedImageUrl('/etc/passwd')).toBe(false);
    expect(isAllowedImageUrl('/uploads/../secret')).toBe(false);
    expect(isAllowedImageUrl('blob:http://localhost/abc')).toBe(false);
  });

  it('parses a jpeg data URL using magic bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const parsed = parseImageDataUrl(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
    expect(parsed.ext).toBe('jpg');
    expect(parsed.buffer.length).toBe(4);
  });

  it('rejects svg and html even when labelled as jpeg', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(() => parseImageDataUrl(`data:image/jpeg;base64,${svg.toString('base64')}`)).toThrow();
    expect(() => parseImageDataUrl(`data:image/svg+xml;base64,${svg.toString('base64')}`)).toThrow();
  });

  it('sniffs png and webp headers', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(sniffImageExt(png)).toBe('png');
    expect(sniffImageExt(webp)).toBe('webp');
    expect(sniffImageExt(Buffer.from('MZ'))).toBeNull();
  });

  it('rejects images over 5 MB', () => {
    const buf = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    expect(() => parseImageDataUrl(`data:image/jpeg;base64,${buf.toString('base64')}`)).toThrow(/5 MB/);
  });

  it('saves a valid image to storage and returns an uploads path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cs-upload-'));
    process.env.UPLOAD_DIR = dir;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const result = await saveUploadedImage(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
    expect(result.url).toMatch(/^\/uploads\/[A-Za-z0-9._-]+\.jpg$/);
    const filename = result.url.replace('/uploads/', '');
    const written = await readFile(join(dir, filename));
    expect(written.equals(jpeg)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
