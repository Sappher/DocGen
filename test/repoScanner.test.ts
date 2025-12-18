import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { collectRepositoryFiles } from '../src/domain/services/repoScanner';

async function setupRepoFixture(entries: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docgen-repo-'));
  await Promise.all(
    Object.entries(entries).map(async ([filePath, content]) => {
      const fullPath = path.join(root, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }),
  );
  return root;
}

describe('collectRepositoryFiles', () => {
  it('excludes binaries, large files, and ignored patterns', async () => {
    const root = await setupRepoFixture({
      'src/a.ts': 'console.log("a");',
      'dist/out.js': 'ignored',
      'large.txt': 'x'.repeat(800),
      'image.png': '\u0000\u0000',
      'keep.md': '# hello',
    });

    try {
      const files = await collectRepositoryFiles({
        root,
        excludePatterns: ['keep.md'],
        maxFileSizeBytes: 500,
      });

      const paths = files.map((f) => f.relativePath);
      expect(paths).toEqual(['src/a.ts']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
