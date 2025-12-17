import * as core from '@actions/core';
import { exec } from '@actions/exec';

export async function runGitCommand(args: string[], silent = false): Promise<string> {
  let output = '';
  let errorOutput = '';
  await exec('git', args, {
    silent,
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
      stderr: (data) => {
        errorOutput += data.toString();
      },
    },
  });
  if (errorOutput && !silent) {
    core.info(errorOutput);
  }
  return output.trim();
}

export async function hasChanges(): Promise<boolean> {
  const status = await runGitCommand(['status', '--porcelain'], true);
  return status.length > 0;
}

export async function configureGitUser(name: string, email: string): Promise<void> {
  await runGitCommand(['config', 'user.name', name]);
  await runGitCommand(['config', 'user.email', email]);
}

export async function checkoutBranch(branchName: string, baseRef?: string): Promise<void> {
  if (baseRef) {
    await runGitCommand(['fetch', 'origin', baseRef]);
    await runGitCommand(['checkout', '-B', branchName, `origin/${baseRef}`]);
    return;
  }
  await runGitCommand(['checkout', '-B', branchName]);
}

export async function pushBranch(branchName: string): Promise<void> {
  await runGitCommand(['push', 'origin', branchName, '--force-with-lease']);
}
