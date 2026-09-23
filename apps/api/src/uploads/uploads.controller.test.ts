import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('uploads controller wiring', () => {
  it('requires authentication', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/uploads/uploads.controller.ts'), 'utf8');
    expect(src).toMatch(/@Post\(\)/);
    expect(src).not.toMatch(/@Public\(\)/);
  });
});
