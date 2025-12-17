import { describe, expect, it } from 'vitest';

import { buildRepositoryContext } from '../src/contextBuilder';

describe('buildRepositoryContext', () => {
  it('limits output when exceeding the maximum characters', () => {
    const files = [
      { relativePath: 'a.ts', size: 5, content: 'aaa' },
      { relativePath: 'b.ts', size: 5, content: 'bbb' },
    ];

    const result = buildRepositoryContext(files, 25);

    expect(result.includedFiles).toHaveLength(1);
    expect(result.contextText).toContain('a.ts');
    expect(result.contextText).not.toContain('b.ts');
  });
});
