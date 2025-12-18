import fs from 'fs/promises';
import path from 'path';

import * as core from '@actions/core';

import { PromptFile } from '../../types/domain';

async function walkDirectory(root: string, current: string, results: PromptFile[]): Promise<void> {
  const currentPath = current ? path.join(root, current) : root;
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const relativeChild = path.join(current, entry.name);
    const absoluteChild = path.join(root, relativeChild);
    if (entry.isDirectory()) {
      await walkDirectory(root, relativeChild, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.toLowerCase().endsWith('.md')) {
      continue;
    }

    const content = await fs.readFile(absoluteChild, 'utf8');
    const normalizedRelative = path
      .relative(root, absoluteChild)
      .split(path.sep)
      .filter(Boolean)
      .join('/');
    results.push({
      absolutePath: absoluteChild,
      relativePath: normalizedRelative || entry.name,
      content,
    });
  }
}

export async function loadPromptFiles(promptsFolder: string): Promise<PromptFile[]> {
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(promptsFolder);
  } catch (error) {
    throw new Error(`Prompts folder not found at ${promptsFolder}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Prompts folder path ${promptsFolder} is not a directory.`);
  }

  const prompts: PromptFile[] = [];
  await walkDirectory(promptsFolder, '', prompts);

  const filtered = prompts.filter((prompt) => prompt.relativePath.toLowerCase().endsWith('.md'));
  filtered.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  if (!filtered.length) {
    core.warning(`No .md prompt files found under ${promptsFolder}`);
  }

  return filtered;
}
