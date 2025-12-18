import * as core from '@actions/core';

import { RepositoryFile } from '../../types/domain';

export interface RepoContextResult {
  contextText: string;
  includedFiles: RepositoryFile[];
}

export function buildRepositoryContext(
  files: RepositoryFile[],
  maxCharacters: number,
): RepoContextResult {
  const included: RepositoryFile[] = [];
  let remaining = maxCharacters;
  const segments: string[] = [];

  for (const file of files) {
    const header = `FILE: ${file.relativePath}\n`;
    const snippet = `${file.content}\n\n`;
    const needed = header.length + snippet.length;
    if (needed > remaining) {
      core.info(
        `Context limit reached before including ${file.relativePath}. Consider increasing max-repo-characters.`,
      );
      break;
    }

    segments.push(header, snippet);
    remaining -= needed;
    included.push(file);
  }

  return {
    contextText: segments.join(''),
    includedFiles: included,
  };
}
