import * as core from '@actions/core';

import { RepoChunk, RepositoryFile } from '../../types/domain';

export interface RepoContextResult {
  contextText: string;
  includedFiles: RepositoryFile[];
}

export interface ContextBuilderOptions {
  chunks: RepoChunk[];
  maxCharacters: number;
}

export function buildRepositoryContext(options: ContextBuilderOptions): RepoContextResult {
  const { chunks, maxCharacters } = options;
  const included: RepositoryFile[] = [];
  const includedSet = new Set<string>();
  let remaining = maxCharacters;
  const segments: string[] = [];

  for (const chunk of chunks) {
    const header = `FILE: ${chunk.file.relativePath} (chunk ${chunk.chunkIndex + 1}/${
      chunk.totalChunks
    })\n`;
    const snippet = `${chunk.content}\n\n`;
    const needed = header.length + snippet.length;
    if (needed > remaining) {
      core.info(
        `Context limit reached before including chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} of ${
          chunk.file.relativePath
        }. Consider increasing max-repo-characters.`,
      );
      break;
    }

    segments.push(header, snippet);
    remaining -= needed;
    if (!includedSet.has(chunk.file.relativePath)) {
      includedSet.add(chunk.file.relativePath);
      included.push(chunk.file);
    }
  }

  return {
    contextText: segments.join(''),
    includedFiles: included,
  };
}
