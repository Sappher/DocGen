import path from 'path';

import * as core from '@actions/core';
import { context } from '@actions/github';

import { ActionInputs, ConfluenceSettings } from '../types/domain';

function coalesceInput(name: string, envName?: string): string {
  const actionValue = core.getInput(name);
  if (actionValue) {
    return actionValue.trim();
  }
  const envValue = process.env[envName ?? name.replace(/-/g, '_').toUpperCase()];
  return envValue ? envValue.trim() : '';
}

function coalesceBooleanInput(name: string, envName?: string, defaultValue = false): boolean {
  const actionProvided = core.getInput(name);
  if (actionProvided) {
    return /^true$/i.test(actionProvided.trim());
  }
  const envValue = process.env[envName ?? name.replace(/-/g, '_').toUpperCase()];
  if (envValue) {
    return /^true$/i.test(envValue.trim());
  }
  return defaultValue;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRelativePath(input: string): string {
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

export function parseConfluencePageMapInput(raw: string): Record<string, string> {
  if (!raw || !raw.trim()) {
    return {};
  }

  const normalizedInput = raw.trim();
  if (normalizedInput.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedInput) as Record<string, string>;
      return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
        if (!key || !value) {
          return acc;
        }
        acc[normalizeRelativePath(key)] = value.trim();
        return acc;
      }, {});
    } catch (error) {
      throw new Error(`Invalid JSON provided for confluence-page-map: ${(error as Error).message}`);
    }
  }

  const mapping: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, value] = trimmed.split('=');
    if (!key || !value) {
      throw new Error(
        `Invalid confluence-page-map entry "${line}". Expected format "prompt/path.md=1234567".`,
      );
    }
    const normalizedKey = normalizeRelativePath(key);
    mapping[normalizedKey] = value.trim();
  }
  return mapping;
}

export function getActionInputs(): ActionInputs {
  const workspacePath = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const promptsFolderInput = coalesceInput('prompts-folder', 'PROMPTS_FOLDER') || 'prompts';
  const outputFolderInput = coalesceInput('output-folder', 'OUTPUT_FOLDER') || 'generated-docs';

  const promptsFolder = path.resolve(workspacePath, promptsFolderInput);
  const outputFolder = path.resolve(workspacePath, outputFolderInput);

  const gitPublisherEnabled = coalesceBooleanInput('enable-git', 'ENABLE_GIT', false);

  const openaiApiKey =
    coalesceInput('openai-api-key', 'OPENAI_API_KEY') || process.env.OPENAI_API_KEY || '';
  if (!openaiApiKey) {
    throw new Error('Missing OpenAI API key. Provide it via the openai-api-key input or env.');
  }

  const githubToken =
    coalesceInput('github-token', 'GITHUB_TOKEN') || process.env.GITHUB_TOKEN || '';
  if (gitPublisherEnabled && !githubToken) {
    throw new Error(
      'Missing GitHub token. Provide it via the github-token input or env when enable-git is true.',
    );
  }

  const excludePatterns = core
    .getMultilineInput('exclude-patterns', { trimWhitespace: true })
    .filter(Boolean);

  if (!excludePatterns.length) {
    const envPatterns = process.env.EXCLUDE_PATTERNS;
    if (envPatterns) {
      excludePatterns.push(
        ...envPatterns
          .split(/\r?\n/) // newline separated
          .map((line) => line.trim())
          .filter(Boolean),
      );
    }
  }

  const maxFileSizeBytes = parseNumber(
    coalesceInput('max-file-size-bytes', 'MAX_FILE_SIZE_BYTES'),
    750_000,
  );

  const maxRepoCharacters = parseNumber(
    coalesceInput('max-repo-characters', 'MAX_REPO_CHARACTERS'),
    400_000,
  );

  const temperatureRaw = coalesceInput('temperature', 'OPENAI_TEMPERATURE');
  const parsedTemp = Number(temperatureRaw);
  const temperature = Number.isFinite(parsedTemp)
    ? Math.min(Math.max(parsedTemp, 0), 2)
    : 0;

  const model = coalesceInput('openai-model', 'OPENAI_MODEL') || 'gpt-4.1-mini';

  const branchNameInput = coalesceInput('branch-name', 'BRANCH_NAME');
  const runId = context.runId ?? Date.now();
  const runAttempt = context.runAttempt ?? 1;
  const defaultBranchName = `docgen/run-${runId}-${runAttempt}`;
  const branchName = branchNameInput || defaultBranchName;

  const baseBranch =
    coalesceInput('base-branch', 'BASE_BRANCH') || context.ref?.replace('refs/heads/', '') || 'main';

  const prTitle =
    coalesceInput('pr-title', 'PR_TITLE') || 'AI-generated documentation and analysis updates';
  const prBodyTemplate =
    coalesceInput('pr-body', 'PR_BODY') ||
    'Automated updates generated by the docgen action. Please review the changes.';

  const dryRun = coalesceBooleanInput('dry-run', 'DRY_RUN', false);

  const repoFullName = process.env.GITHUB_REPOSITORY ?? '';
  if (!repoFullName) {
    throw new Error('GITHUB_REPOSITORY env is required when running inside GitHub Actions.');
  }

  const [repositoryOwner, repositoryName] = repoFullName.split('/', 2);

  const enableConfluence = coalesceBooleanInput('enable-confluence', 'ENABLE_CONFLUENCE', false);
  let confluenceConfig: ConfluenceSettings | undefined;
  if (enableConfluence) {
    const baseUrl =
      coalesceInput('confluence-base-url', 'CONFLUENCE_BASE_URL') ||
      process.env.CONFLUENCE_BASE_URL ||
      '';
    const email =
      coalesceInput('confluence-email', 'CONFLUENCE_EMAIL') ||
      process.env.CONFLUENCE_EMAIL ||
      '';
    const apiToken =
      coalesceInput('confluence-api-token', 'CONFLUENCE_API_TOKEN') ||
      process.env.CONFLUENCE_API_TOKEN ||
      '';

    const spaceKey =
      coalesceInput('confluence-space-key', 'CONFLUENCE_SPACE_KEY') ||
      process.env.CONFLUENCE_SPACE_KEY ||
      '';

    const mapInputLines = core.getMultilineInput('confluence-page-map', {
      trimWhitespace: false,
    });
    const mapInput =
      mapInputLines.length > 0 ? mapInputLines.join('\n') : process.env.CONFLUENCE_PAGE_MAP || '';
    const pageMap = parseConfluencePageMapInput(mapInput);

    if (!baseUrl) {
      throw new Error('confluence-base-url is required when enable-confluence is true.');
    }
    if (!email) {
      throw new Error('confluence-email is required when enable-confluence is true.');
    }
    if (!apiToken) {
      throw new Error('confluence-api-token is required when enable-confluence is true.');
    }
    if (!Object.keys(pageMap).length) {
      throw new Error('confluence-page-map must define at least one mapping when Confluence is enabled.');
    }

    confluenceConfig = {
      enabled: true,
      baseUrl,
      email,
      apiToken,
      spaceKey: spaceKey || undefined,
      pageMap,
    };
  }

  return {
    workspacePath,
    promptsFolder,
    outputFolder,
    promptsFolderInput,
    outputFolderInput,
    openaiModel: model,
    openaiApiKey,
    githubToken,
    excludePatterns,
    maxFileSizeBytes,
    maxRepoCharacters,
    temperature,
    branchName,
    baseBranch,
    prTitle,
    prBody: prBodyTemplate,
    dryRun,
    repoFullName,
    repositoryOwner,
    repositoryName,
    runId,
    runAttempt,
    gitPublisherEnabled,
    confluence: confluenceConfig,
  };
}
