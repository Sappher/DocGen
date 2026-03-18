import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import * as core from '@actions/core';
import { getExecOutput } from '@actions/exec';

import { CodexSettings } from '../../types/domain';

interface GenerateOutputOptions {
  workingDirectory: string;
  promptName: string;
  promptContent: string;
  outputRelativePath: string;
  systemPrompt?: string;
}

const RETRY_ATTEMPTS = 3;

export class CodexCliClient {
  private codexHomePath?: string;
  private prepared = false;

  constructor(private readonly settings: CodexSettings) {}

  async prepare(): Promise<void> {
    if (this.prepared) {
      return;
    }

    this.codexHomePath = await fs.mkdtemp(path.join(os.tmpdir(), 'docgen-codex-home-'));
    try {
      if (this.settings.apiKey) {
        await this.loginWithApiKey(this.settings.apiKey);
      }
      this.prepared = true;
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.codexHomePath) {
      return;
    }

    await fs.rm(this.codexHomePath, { recursive: true, force: true });
    this.codexHomePath = undefined;
    this.prepared = false;
  }

  async generateOutput(options: GenerateOutputOptions): Promise<string> {
    await this.prepare();

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.runOnce(options);
      } catch (error) {
        const remaining = RETRY_ATTEMPTS - attempt;
        core.warning(
          `Codex CLI failed for ${options.promptName} (attempt ${attempt}/${RETRY_ATTEMPTS}): ${
            (error as Error).message
          }`,
        );
        if (remaining <= 0) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error('Failed to run Codex CLI after retries.');
  }

  private async runOnce(options: GenerateOutputOptions): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docgen-codex-'));
    const lastMessagePath = path.join(tempDir, 'last-message.md');

    try {
      const args = this.buildArgs(options.workingDirectory, lastMessagePath);
      const execOutput = await getExecOutput(this.settings.executable, args, {
        env: this.buildEnvironment(),
        ignoreReturnCode: true,
        input: Buffer.from(buildCodexPrompt(options), 'utf8'),
      });

      const content = await this.readLastMessage(lastMessagePath);
      if (execOutput.exitCode !== 0) {
        const details = summarizeProcessError(execOutput.stderr || execOutput.stdout);
        throw new Error(
          `Codex exited with code ${execOutput.exitCode}${
            details ? `: ${details}` : ''
          }`,
        );
      }

      if (!content.trim()) {
        throw new Error('Codex returned an empty final message.');
      }

      return content;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildArgs(workingDirectory: string, lastMessagePath: string): string[] {
    const args = [
      'exec',
      '--color',
      'never',
      '--ephemeral',
      '--sandbox',
      this.settings.sandbox,
      '--cd',
      workingDirectory,
      '--output-last-message',
      lastMessagePath,
    ];

    if (this.settings.model) {
      args.push('--model', this.settings.model);
    }

    if (this.settings.profile) {
      args.push('--profile', this.settings.profile);
    }

    for (const override of this.settings.configOverrides) {
      args.push('--config', override);
    }

    args.push('-');
    return args;
  }

  private async loginWithApiKey(apiKey: string): Promise<void> {
    const loginResult = await getExecOutput(
      this.settings.executable,
      ['login', '--with-api-key'],
      {
        env: this.buildEnvironment(),
        ignoreReturnCode: true,
        input: Buffer.from(`${apiKey}\n`, 'utf8'),
      },
    );

    if (loginResult.exitCode !== 0) {
      const details = summarizeProcessError(loginResult.stderr || loginResult.stdout);
      throw new Error(
        `Failed to authenticate Codex CLI with the provided API key${
          details ? `: ${details}` : ''
        }`,
      );
    }
  }

  private buildEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }

    if (this.codexHomePath) {
      env.CODEX_HOME = this.codexHomePath;
    }

    if (this.settings.apiKey) {
      env.OPENAI_API_KEY = this.settings.apiKey;
    }

    return env;
  }

  private async readLastMessage(lastMessagePath: string): Promise<string> {
    try {
      return await fs.readFile(lastMessagePath, 'utf8');
    } catch (error) {
      throw new Error(
        `Failed to read Codex output from ${lastMessagePath}: ${(error as Error).message}`,
      );
    }
  }
}

function buildCodexPrompt(options: GenerateOutputOptions): string {
  const sections = [
    options.systemPrompt?.trim(),
    [
      'You are generating a repository documentation artifact for an automated workflow.',
      'Inspect the repository directly from the current working directory as needed.',
      'Do not modify repository files.',
      'Return only the final Markdown content that should be written to the target output file.',
      'Do not wrap the full answer in code fences.',
    ].join('\n'),
    `Prompt file: ${options.promptName}`,
    `Target output file: ${options.outputRelativePath}`,
    'Task prompt:',
    options.promptContent.trim(),
  ];

  return `${sections.filter(Boolean).join('\n\n')}\n`;
}

function summarizeProcessError(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  return lines.slice(-3).join(' | ');
}
