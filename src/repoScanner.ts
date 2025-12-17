import fs from 'fs/promises';
import path from 'path';

import * as core from '@actions/core';
import ignore from 'ignore';
import { isBinary } from 'istextorbinary';

import { RepositoryFile } from './types';

const DEFAULT_EXCLUDES = [
  '.git/',
  'node_modules/',
  '.github/',
  '.vscode/',
  '.idea/',
  'dist/',
  'coverage/',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.bmp',
  '*.ico',
  '*.svg',
  '*.mp4',
  '*.mp3',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.tgz',
  '*.7z',
  '*.lock',
];

interface RepoScannerOptions {
  root: string;
  excludePatterns: string[];
  maxFileSizeBytes: number;
}

export async function collectRepositoryFiles(
  options: RepoScannerOptions,
): Promise<RepositoryFile[]> {
  const ig = ignore().add(DEFAULT_EXCLUDES).add(options.excludePatterns);
  const files: RepositoryFile[] = [];

  const normalizePath = (input: string): string => {
    const normalized = path.normalize(input).replace(/\\/g, '/');
    if (normalized === '.' || normalized === './') {
      return '';
    }
    return normalized.replace(/^\.\//, '');
  };

  async function walk(relativeDir: string): Promise<void> {
    const absoluteDir = relativeDir ? path.join(options.root, relativeDir) : options.root;
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      const normalized = normalizePath(relativePath);
      if (ig.ignores(normalized)) {
        continue;
      }

      const absoluteChild = path.join(options.root, relativePath);
      if (entry.isDirectory()) {
        if (ig.ignores(`${normalized}/`)) {
          continue;
        }
        await walk(relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(absoluteChild);
      if (stats.size > options.maxFileSizeBytes) {
        core.info(`Skipping ${normalized} (> ${options.maxFileSizeBytes} bytes).`);
        continue;
      }

      const buffer = await fs.readFile(absoluteChild);
      if (isBinary(absoluteChild, buffer)) {
        core.info(`Skipping binary file ${normalized}.`);
        continue;
      }

      files.push({
        relativePath: normalized,
        size: buffer.length,
        content: buffer.toString('utf8'),
      });
    }
  }

  await walk('');

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}
