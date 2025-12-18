import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitPublisher } from '../../src/publishers/git';
import type { ActionInputs, PromptResult, RunSummary } from '../../src/types/domain';

type GitModule = typeof import('../../src/git');

vi.mock('../../src/git', async () => {
  const actual = await vi.importActual<GitModule>('../../src/git');
  return {
    ...actual,
    runGitCommand: vi.fn().mockResolvedValue(''),
    hasChanges: vi.fn().mockResolvedValue(true),
    pushBranch: vi.fn().mockResolvedValue(undefined),
    checkoutBranch: vi.fn().mockResolvedValue(undefined),
    configureGitUser: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<GitModule>;
});

let gitModule: GitModule;

vi.mock('@actions/github', () => {
  const pulls = {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ data: { number: 123 } }),
    update: vi.fn(),
  };
  return {
    getOctokit: vi.fn().mockReturnValue({ rest: { pulls } }),
  };
});

describe('GitPublisher', () => {
  let tmpDir: string;
  let baseConfig: ActionInputs;

beforeEach(async () => {
  if (!gitModule) {
    gitModule = (await import('../../src/git')) as GitModule;
  }
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-publisher-'));
    baseConfig = {
      workspacePath: tmpDir,
      promptsFolder: path.join(tmpDir, 'prompts'),
      outputFolder: path.join(tmpDir, 'out'),
      promptsFolderInput: 'prompts',
      outputFolderInput: 'out',
      openaiModel: 'gpt',
      openaiApiKey: 'key',
      githubToken: 'token',
      excludePatterns: [],
      maxFileSizeBytes: 1000,
      maxRepoCharacters: 1000,
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
      gitPublisherEnabled: true,
    };
  });

  it('skips git operations in dry-run', async () => {
    const publisher = new GitPublisher({ ...baseConfig, dryRun: true });
    await publisher.prepare();
    await publisher.publishPromptResult(dummyResult(tmpDir));
    await publisher.finalize({ promptResults: [] });

    expect(gitModule.configureGitUser).not.toHaveBeenCalled();
    expect(gitModule.runGitCommand).not.toHaveBeenCalled();
  });

  it('skips finalize when no changes', async () => {
    vi.spyOn(gitModule, 'hasChanges').mockResolvedValueOnce(false);
    const publisher = new GitPublisher(baseConfig);
    await publisher.prepare();
    await publisher.finalize({ promptResults: [] });

    expect(gitModule.runGitCommand).not.toHaveBeenCalled();
  });

  it('creates PR when changes exist', async () => {
    const publisher = new GitPublisher(baseConfig);
    await publisher.prepare();

    const result = dummyResult(tmpDir);
    await publisher.publishPromptResult(result);

    const summary: RunSummary = { promptResults: [result] };
    await publisher.finalize(summary);

    expect(gitModule.runGitCommand).toHaveBeenCalledWith(['commit', '-m', expect.stringContaining('title')]);
    expect(gitModule.pushBranch).toHaveBeenCalledWith('branch');
  });
});

function dummyResult(root: string): PromptResult {
  const filePath = path.join(root, 'out', 'file.md');
  return {
    prompt: {
      absolutePath: '',
      relativePath: 'file.md',
      content: 'prompt content',
    },
    outputAbsolutePath: filePath,
    outputRelativePath: 'file.md',
    content: 'output',
  };
}
