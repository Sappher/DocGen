import fs from 'fs/promises';

import * as core from '@actions/core';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { CodexCliClient } from '../src/domain/services/codexCli';

const { getExecOutputMock } = vi.hoisted(() => ({
  getExecOutputMock: vi.fn(),
}));

vi.mock('@actions/exec', () => ({
  getExecOutput: getExecOutputMock,
}));

describe('CodexCliClient', () => {
  beforeEach(() => {
    getExecOutputMock.mockReset();
    vi.spyOn(core, 'warning').mockImplementation(() => undefined);
  });

  it('invokes codex exec and returns the captured final message', async () => {
    getExecOutputMock.mockImplementation(async (_command: string, args: string[]) => {
      if (args[0] === 'login') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      const outputIndex = args.indexOf('--output-last-message');
      const outputPath = args[outputIndex + 1];
      await fs.writeFile(outputPath, '# Generated output\n');
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const client = new CodexCliClient({
      executable: 'codex',
      apiKey: 'secret-key',
      model: 'gpt-5-codex',
      profile: 'ci',
      sandbox: 'read-only',
      configOverrides: ['foo.bar=true'],
    });

    const output = await client.generateOutput({
      workingDirectory: '/repo',
      promptName: 'docs/ARCHITECTURE.md',
      promptContent: 'Describe the system architecture.',
      outputRelativePath: 'docs/ARCHITECTURE.md',
      systemPrompt: 'Prefer concise output.',
    });

    expect(output).toBe('# Generated output\n');
    expect(getExecOutputMock).toHaveBeenNthCalledWith(
      1,
      'codex',
      ['login', '--with-api-key'],
      expect.objectContaining({
        ignoreReturnCode: true,
        input: expect.any(Buffer),
      }),
    );
    expect(getExecOutputMock.mock.calls[0][2].input.toString('utf8')).toBe('secret-key\n');
    expect(getExecOutputMock).toHaveBeenCalledWith(
      'codex',
      expect.arrayContaining([
        'exec',
        '--ephemeral',
        '--sandbox',
        'read-only',
        '--cd',
        '/repo',
        '--model',
        'gpt-5-codex',
        '--profile',
        'ci',
        '--config',
        'foo.bar=true',
        '-',
      ]),
      expect.objectContaining({
        env: expect.objectContaining({
          CODEX_HOME: expect.any(String),
        }),
        ignoreReturnCode: true,
        input: expect.any(Buffer),
      }),
    );

    const prompt = getExecOutputMock.mock.calls[1][2].input.toString('utf8');
    expect(prompt).toContain('Prefer concise output.');
    expect(prompt).toContain('Read the current target document first if it already exists');
    expect(prompt).toContain('Base statements on files you actually inspect.');
    expect(prompt).toContain('Do not include process narration, status updates, or commentary about your steps.');
    expect(prompt).toContain('Prompt file: docs/ARCHITECTURE.md');
    expect(prompt).toContain('Target output file: docs/ARCHITECTURE.md');
    expect(prompt).toContain('Describe the system architecture.');
  });

  it('fails when codex exits non-zero', async () => {
    getExecOutputMock.mockImplementation(async (_command: string, args: string[]) => {
      const outputIndex = args.indexOf('--output-last-message');
      const outputPath = args[outputIndex + 1];
      await fs.writeFile(outputPath, '');
      return { exitCode: 1, stdout: '', stderr: 'network failed' };
    });

    const client = new CodexCliClient({
      executable: 'codex',
      sandbox: 'read-only',
      configOverrides: [],
    });

    await expect(
      client.generateOutput({
        workingDirectory: '/repo',
        promptName: 'ARCHITECTURE.md',
        promptContent: 'Explain the architecture.',
        outputRelativePath: 'ARCHITECTURE.md',
      }),
    ).rejects.toThrow('Codex exited with code 1');
  });

  it('fails fast on shell sandbox setup errors', async () => {
    getExecOutputMock.mockImplementation(async (_command: string, args: string[]) => {
      const outputIndex = args.indexOf('--output-last-message');
      const outputPath = args[outputIndex + 1];
      await fs.writeFile(outputPath, '# fallback\n');
      return {
        exitCode: 0,
        stdout: 'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted',
        stderr: '',
      };
    });

    const client = new CodexCliClient({
      executable: 'codex',
      sandbox: 'workspace-write',
      configOverrides: [],
    });

    await expect(
      client.generateOutput({
        workingDirectory: '/repo',
        promptName: 'ARCHITECTURE.md',
        promptContent: 'Explain the architecture.',
        outputRelativePath: 'ARCHITECTURE.md',
      }),
    ).rejects.toThrow('Try setting codex-sandbox to danger-full-access');
  });

  it('fails when api-key login fails', async () => {
    getExecOutputMock.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'invalid key',
    });

    const client = new CodexCliClient({
      executable: 'codex',
      apiKey: 'bad-key',
      sandbox: 'read-only',
      configOverrides: [],
    });

    await expect(
      client.prepare(),
    ).rejects.toThrow('Failed to authenticate Codex CLI with the provided API key');
  });

  it('fails with a clear message on authentication errors during exec', async () => {
    getExecOutputMock.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'unexpected status 401 Unauthorized: Missing bearer or basic authentication in header',
    });

    const client = new CodexCliClient({
      executable: 'codex',
      sandbox: 'danger-full-access',
      configOverrides: [],
    });

    await expect(
      client.generateOutput({
        workingDirectory: '/repo',
        promptName: 'ARCHITECTURE.md',
        promptContent: 'Explain the architecture.',
        outputRelativePath: 'ARCHITECTURE.md',
      }),
    ).rejects.toThrow('Provide a valid codex-api-key or pre-authenticate the Codex CLI on the runner');
  });
});
