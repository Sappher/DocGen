import { describe, expect, it } from 'vitest';

import { createPublishers } from '../../src/publishers';
import type { ActionInputs } from '../../src/types/domain';

const baseConfig: ActionInputs = {
  workspacePath: '/tmp',
  promptsFolder: '/tmp/prompts',
  outputFolder: '/tmp/out',
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

describe('createPublishers', () => {
  it('returns git publisher when enabled', () => {
    const publishers = createPublishers(baseConfig);
    expect(publishers).toHaveLength(1);
  });

  it('returns empty when all publishers disabled', () => {
    const publishers = createPublishers({ ...baseConfig, gitPublisherEnabled: false, confluence: undefined });
    expect(publishers).toHaveLength(0);
  });
});
