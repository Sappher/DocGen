import { describe, expect, it } from 'vitest';

import { createFileChunks } from '../src/domain/services/chunker';
import { buildRepositoryContext } from '../src/domain/services/contextBuilder';

describe('buildRepositoryContext', () => {
  it('limits output when exceeding the maximum characters', () => {
    const files = [
      { relativePath: 'a.ts', size: 5, content: 'aaa' },
      { relativePath: 'b.ts', size: 5, content: 'bbb' },
    ];

    const chunks = createFileChunks(files, 10);
    const result = buildRepositoryContext({ chunks, maxCharacters: 40 });

    expect(result.includedFiles).toHaveLength(1);
    expect(result.contextText).toContain('FILE: a.ts (chunk 1/1)');
    expect(result.contextText).not.toContain('b.ts');
  });

  it('chunks large files and annotates chunk indices', () => {
    const files = [{ relativePath: 'big.ts', size: 200, content: 'x'.repeat(120) }];

    const chunks = createFileChunks(files, 50);
    const result = buildRepositoryContext({ chunks, maxCharacters: 500 });

    expect(result.contextText).toContain('FILE: big.ts (chunk 1/3)');
    expect(result.contextText).toContain('FILE: big.ts (chunk 2/3)');
    expect(result.contextText).toContain('FILE: big.ts (chunk 3/3)');
  });
});
