import * as core from '@actions/core';

import { EmbeddingsSettings, RepoChunk } from '../../types/domain';

import { EmbeddingsClient, cosineSimilarity } from './embeddings';

interface EmbeddingsRankerOptions {
  apiKey: string;
  settings: EmbeddingsSettings;
  chunks: RepoChunk[];
}

export class EmbeddingsRanker {
  private constructor(
    private readonly client: EmbeddingsClient,
    private readonly chunks: RepoChunk[],
    private readonly chunkEmbeddings: number[][],
    private readonly maxChunks?: number,
  ) {}

  static async build(options: EmbeddingsRankerOptions): Promise<EmbeddingsRanker> {
    const client = new EmbeddingsClient(options.apiKey, options.settings.model);
    const chunkEmbeddings = await client.embedTexts(options.chunks.map((chunk) => chunk.content));
    core.info(`Generated embeddings for ${options.chunks.length} chunk(s).`);
    return new EmbeddingsRanker(client, options.chunks, chunkEmbeddings, options.settings.maxChunksPerPrompt);
  }

  async rankChunks(promptText: string): Promise<RepoChunk[]> {
    const promptEmbedding = await this.client.embedText(promptText);
    const scored = this.chunkEmbeddings.map((vector, index) => ({
      chunk: this.chunks[index],
      score: cosineSimilarity(vector, promptEmbedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const limited = this.maxChunks ? scored.slice(0, this.maxChunks) : scored;
    return limited.map((entry) => entry.chunk);
  }
}
