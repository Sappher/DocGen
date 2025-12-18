import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { getActionInputs, parseConfluencePageMapInput } from '../src/config/inputs';

import { mockCoreInputs, restoreCoreMocks } from './utils/mockActions';

describe('parseConfluencePageMapInput', () => {
  it('parses newline separated entries', () => {
    const mapping = parseConfluencePageMapInput('ARCH.md=123\nsub/doc.md=456');
    expect(mapping).toEqual({ 'ARCH.md': '123', 'sub/doc.md': '456' });
  });

  it('parses JSON payloads', () => {
    const mapping = parseConfluencePageMapInput('{"ARCH.md":"123"}');
    expect(mapping).toEqual({ 'ARCH.md': '123' });
  });

  it('throws on malformed lines', () => {
    expect(() => parseConfluencePageMapInput('foo')).toThrow();
  });
});

describe('getActionInputs', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    restoreCoreMocks();
  });

  it('throws when required secrets missing', () => {
    mockCoreInputs({});
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';
    expect(() => getActionInputs()).toThrow('Missing OpenAI API key');
  });

  it('returns defaults when provided', () => {
    mockCoreInputs({
      'openai-api-key': 'test-key',
      'github-token': 'gh-token',
      'prompts-folder': 'prompts',
      'output-folder': 'docs',
      'enable-git': 'true',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.promptsFolder).toContain('prompts');
    expect(inputs.openaiApiKey).toBe('test-key');
    expect(inputs.githubToken).toBe('gh-token');
    expect(inputs.gitPublisherEnabled).toBe(true);
  });

  it('does not require github token when git publisher disabled', () => {
    mockCoreInputs({
      'openai-api-key': 'test-key',
      'enable-git': 'false',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.githubToken).toBe('');
    expect(inputs.gitPublisherEnabled).toBe(false);
  });

  it('requires github token when git publisher enabled', () => {
    mockCoreInputs({
      'openai-api-key': 'test-key',
      'enable-git': 'true',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    expect(() => getActionInputs()).toThrow('Missing GitHub token');
  });
});
