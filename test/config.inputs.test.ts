import fs from 'fs';
import os from 'os';
import path from 'path';

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
    expect(inputs.contextChunkSize).toBeGreaterThan(0);
    expect(inputs.embeddings).toBeUndefined();
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

  it('configures embeddings when enabled', () => {
    mockCoreInputs({
      'openai-api-key': 'test-key',
      'enable-embeddings': 'true',
      'embeddings-model': 'text-embedding-3-small',
      'max-embeddings-chunks': '25',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.embeddings?.enabled).toBe(true);
    expect(inputs.embeddings?.model).toBe('text-embedding-3-small');
    expect(inputs.embeddings?.maxChunksPerPrompt).toBe(25);
  });

  it('loads system prompt from file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docgen-system-'));
    const tmpFile = path.join(tmpDir, 'system.md');
    fs.writeFileSync(tmpFile, 'System instructions');

    mockCoreInputs({
      'openai-api-key': 'test-key',
      'system-prompt-file': path.relative(tmpDir, tmpFile),
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = tmpDir;

    const inputs = getActionInputs();
    expect(inputs.systemPrompt).toBe('System instructions');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
