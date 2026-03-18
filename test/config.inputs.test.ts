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

  it('throws when repository metadata missing', () => {
    mockCoreInputs({});
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';
    delete process.env.GITHUB_REPOSITORY;

    expect(() => getActionInputs()).toThrow('GITHUB_REPOSITORY env is required');
  });

  it('returns defaults when provided', () => {
    mockCoreInputs({
      'github-token': 'gh-token',
      'prompts-folder': 'prompts',
      'output-folder': 'docs',
      'enable-git': 'true',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.promptsFolder).toContain('prompts');
    expect(inputs.codex.executable).toBe('codex');
    expect(inputs.codex.apiKey).toBeUndefined();
    expect(inputs.githubToken).toBe('gh-token');
    expect(inputs.gitPublisherEnabled).toBe(true);
    expect(inputs.codex.sandbox).toBe('workspace-write');
    expect(inputs.codex.configOverrides).toEqual([]);
  });

  it('does not require github token when git publisher disabled', () => {
    mockCoreInputs({
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
      'enable-git': 'true',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    expect(() => getActionInputs()).toThrow('Missing GitHub token');
  });

  it('configures codex settings when provided', () => {
    mockCoreInputs({
      'codex-api-key': 'codex-key',
      'codex-executable': '/usr/local/bin/codex',
      'codex-model': 'gpt-5-codex',
      'codex-profile': 'ci',
      'codex-sandbox': 'workspace-write',
      'codex-config': 'model_reasoning_effort = "high"\nfoo.bar=true',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.codex.executable).toBe('/usr/local/bin/codex');
    expect(inputs.codex.apiKey).toBe('codex-key');
    expect(inputs.codex.model).toBe('gpt-5-codex');
    expect(inputs.codex.profile).toBe('ci');
    expect(inputs.codex.sandbox).toBe('workspace-write');
    expect(inputs.codex.configOverrides).toEqual([
      'model_reasoning_effort = "high"',
      'foo.bar=true',
    ]);
  });

  it('rejects invalid codex sandbox values', () => {
    mockCoreInputs({
      'codex-sandbox': 'invalid',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    expect(() => getActionInputs()).toThrow('Invalid codex-sandbox');
  });

  it('falls back to the legacy openai api key input', () => {
    mockCoreInputs({
      'openai-api-key': 'legacy-key',
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = '/tmp/workspace';

    const inputs = getActionInputs();
    expect(inputs.codex.apiKey).toBe('legacy-key');
  });

  it('loads system prompt from file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docgen-system-'));
    const tmpFile = path.join(tmpDir, 'system.md');
    fs.writeFileSync(tmpFile, 'System instructions');

    mockCoreInputs({
      'system-prompt-file': path.relative(tmpDir, tmpFile),
    });
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_WORKSPACE = tmpDir;

    const inputs = getActionInputs();
    expect(inputs.systemPrompt).toBe('System instructions');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
