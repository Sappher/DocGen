import { RepoChunk, RepositoryFile } from '../../types/domain';

export function createFileChunks(files: RepositoryFile[], chunkSize: number): RepoChunk[] {
  const chunks: RepoChunk[] = [];
  for (const file of files) {
    const contentChunks = chunkContent(file.content, chunkSize);
    const totalChunks = contentChunks.length;
    contentChunks.forEach((content, index) => {
      chunks.push({
        file,
        chunkIndex: index,
        totalChunks,
        content,
      });
    });
  }
  return chunks;
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
