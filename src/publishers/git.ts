import fs from 'fs/promises';
import path from 'path';

import * as core from '@actions/core';
import * as github from '@actions/github';

import { checkoutBranch, configureGitUser, hasChanges, pushBranch, runGitCommand } from '../git';
import { ActionInputs, PromptResult, Publisher, RunSummary } from '../types/domain';

export class GitPublisher implements Publisher {
  private readonly config: ActionInputs;
  private readonly octokit: ReturnType<typeof github.getOctokit>;
  private readonly outputFolderRelative: string;

  constructor(config: ActionInputs) {
    this.config = config;
    this.octokit = github.getOctokit(config.githubToken);
    this.outputFolderRelative =
      path.relative(config.workspacePath, config.outputFolder) || config.outputFolder;
  }

  async prepare(): Promise<void> {
    await fs.mkdir(this.config.outputFolder, { recursive: true });
    if (this.config.dryRun) {
      core.info('Dry-run enabled: skipping git branch checkout.');
      return;
    }

    const actor = process.env.GITHUB_ACTOR || 'github-actions[bot]';
    await configureGitUser(actor, `${actor}@users.noreply.github.com`);
    await checkoutBranch(this.config.branchName, this.config.baseBranch);
  }

  async publishPromptResult(result: PromptResult): Promise<void> {
    await fs.mkdir(path.dirname(result.outputAbsolutePath), { recursive: true });
    await fs.writeFile(result.outputAbsolutePath, result.content, 'utf8');
    core.info(`Wrote AI output to ${result.outputRelativePath}`);
  }

  async finalize(summary: RunSummary): Promise<void> {
    if (this.config.dryRun) {
      core.info('Dry-run enabled: skipping git commit and PR creation.');
      return;
    }

    if (!(await hasChanges())) {
      core.info('No changes detected after generation. Skipping PR creation.');
      return;
    }

    await runGitCommand(['add', '--all', this.outputFolderRelative]);
    const commitMessage = `${this.config.prTitle} (run ${this.config.runId})`;
    await runGitCommand(['commit', '-m', commitMessage]);
    await pushBranch(this.config.branchName);

    const owner = this.config.repositoryOwner;
    const repo = this.config.repositoryName;

    const head = `${owner}:${this.config.branchName}`;
    const existingPrs = await this.octokit.rest.pulls.list({
      owner,
      repo,
      head,
      state: 'open',
    });

    const body = buildPrBody(this.config.prBody, summary);

    if (existingPrs.data.length > 0) {
      const pr = existingPrs.data[0];
      await this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        title: this.config.prTitle,
        body,
      });
      core.info(`Updated existing PR #${pr.number}.`);
      return;
    }

    const newPr = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title: this.config.prTitle,
      body,
      head: this.config.branchName,
      base: this.config.baseBranch,
      maintainer_can_modify: true,
    });
    core.info(`Created PR #${newPr.data.number}.`);
  }
}

function buildPrBody(template: string, summary: RunSummary): string {
  const bullets = summary.promptResults
    .map((result) => `- ${result.outputRelativePath}`)
    .join('\n');
  return `${template}\n\n## Generated Files\n${bullets || '- (no changes written)'}`.trim();
}
