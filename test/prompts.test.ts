import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { loadPromptFiles } from '../src/domain/services/prompts';

describe('loadPromptFiles', () => {
  it('reads markdown files recursively', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docgen-prompts-'));
    try {
      await fs.mkdir(path.join(tmpDir, 'nested'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'a.md'), '# A');
      await fs.writeFile(path.join(tmpDir, 'nested', 'b.MD'), '# B');
      await fs.writeFile(path.join(tmpDir, 'ignore.txt'), 'nope');

      const prompts = await loadPromptFiles(tmpDir);
      const names = prompts.map((prompt) => prompt.relativePath).sort();

      expect(names).toEqual(['a.md', 'nested/b.MD']);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
