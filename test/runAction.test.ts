import * as core from '@actions/core';
import { describe, expect, it, vi } from 'vitest';

import type { ActionInputs } from '../src/types/domain';

const getActionInputsMock = vi.fn();
const loadPromptFilesMock = vi.fn();

vi.mock('../src/config/inputs', () => ({
  getActionInputs: getActionInputsMock,
}));
vi.mock('../src/domain/services/prompts', () => ({
  loadPromptFiles: loadPromptFilesMock,
}));
vi.mock('../src/domain/services/repoScanner', () => ({
  collectRepositoryFiles: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/domain/services/contextBuilder', () => ({
  buildRepositoryContext: vi.fn().mockReturnValue({ contextText: '', includedFiles: [] }),
}));
vi.mock('../src/domain/services/openaiClient', () => ({
  OpenAIClient: vi.fn().mockImplementation(() => ({ analyzePrompt: vi.fn() })),
}));

const { runAction } = await import('../src/main/useCases/runAction');

describe('runAction', () => {
  it('fails early when no publishers enabled', async () => {
    getActionInputsMock.mockReturnValueOnce(minimalConfig());
    const setFailed = vi.spyOn(core, 'setFailed').mockImplementation(() => undefined);

    await runAction();

    expect(loadPromptFilesMock).not.toHaveBeenCalled();
    expect(setFailed).toHaveBeenCalledWith(
      expect.stringContaining("enable-git: true"),
    );
  });
});

function minimalConfig(): ActionInputs {
  return {
    workspacePath: '/tmp',
    promptsFolder: '/tmp/prompts',
    outputFolder: '/tmp/out',
    promptsFolderInput: 'prompts',
    outputFolderInput: 'out',
    openaiModel: 'model',
    openaiApiKey: 'key',
    githubToken: '',
    excludePatterns: [],
    maxFileSizeBytes: 500,
    maxRepoCharacters: 500,
    temperature: 0,
    branchName: 'branch',
    baseBranch: 'main',
    prTitle: 'title',
    prBody: 'body',
    dryRun: false,
    repoFullName: 'owner/repo',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    runId: 1,
    runAttempt: 1,
    gitPublisherEnabled: false,
    confluence: undefined,
  };
}
