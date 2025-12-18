import * as core from '@actions/core';

import { RepositoryFile } from '../../types/domain';

export interface RepoContextResult {
  contextText: string;
  includedFiles: RepositoryFile[];
}

export interface ContextBuilderOptions {
  files: RepositoryFile[];
  maxCharacters: number;
  chunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 4_000;

export function buildRepositoryContext(options: ContextBuilderOptions): RepoContextResult {
  const { files, maxCharacters, chunkSize = DEFAULT_CHUNK_SIZE } = options;
  const included: RepositoryFile[] = [];
  let remaining = maxCharacters;
  const segments: string[] = [];
  let outOfSpace = false;

  for (const file of files) {
    const chunks = chunkContent(file.content, chunkSize);
    const totalChunks = chunks.length;
    let addedChunks = 0;

    for (let index = 0; index < totalChunks; index += 1) {
      const chunk = chunks[index];
      const header = `FILE: ${file.relativePath} (chunk ${index + 1}/${totalChunks})\n`;
      const snippet = `${chunk}\n\n`;
      const needed = header.length + snippet.length;
      if (needed > remaining) {
        core.info(
          `Context limit reached before including chunk ${index + 1}/${totalChunks} of ${
            file.relativePath
          }. Consider increasing max-repo-characters.`,
        );
        outOfSpace = true;
        break;
      }

      segments.push(header, snippet);
      remaining -= needed;
      addedChunks += 1;
    }

    if (addedChunks > 0) {
      included.push(file);
    }

    if (outOfSpace) {
      break;
    }
  }

  return {
    contextText: segments.join(''),
    includedFiles: included,
  };
}

function chunkContent(content: string, size: number): string[] {
  if (content.length <= size) {
    return [content];
  }
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += size) {
    chunks.push(content.slice(i, i + size));
  }
  return chunks;
}
