import * as core from '@actions/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfluencePublisher } from '../../src/publishers/confluence';
import type { PromptResult } from '../../src/types/domain';

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

let fetchMock: ReturnType<typeof vi.fn>;
beforeAll(async () => {
  const fetchModule = await import('node-fetch');
  fetchMock = fetchModule.default as unknown as ReturnType<typeof vi.fn>;
});

describe('ConfluencePublisher', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.spyOn(core, 'warning').mockImplementation(() => undefined);
    vi.spyOn(core, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips prompts without mapping', async () => {
    const publisher = new ConfluencePublisher({
      enabled: true,
      baseUrl: 'https://example.atlassian.net/wiki/',
      email: 'user@example.com',
      apiToken: 'token',
      pageMap: {},
    });

    await publisher.publishPromptResult(dummyResult('unmapped.md'));
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('No Confluence mapping found for unmapped.md'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates mapped pages', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            version: { number: 1 },
            title: 'Doc',
            type: 'page',
          }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });

    const publisher = new ConfluencePublisher({
      enabled: true,
      baseUrl: 'https://example.atlassian.net/wiki/',
      email: 'user@example.com',
      apiToken: 'token',
      pageMap: { 'doc.md': '123' },
    });

    await publisher.publishPromptResult(dummyResult('doc.md'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function dummyResult(relativePath: string): PromptResult {
  return {
    prompt: { absolutePath: '', relativePath, content: 'prompt' },
    outputRelativePath: relativePath,
    outputAbsolutePath: '/tmp/doc.md',
    content: '# Title',
  };
}
