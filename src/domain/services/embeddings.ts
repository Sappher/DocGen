import * as core from '@actions/core';
import OpenAI from 'openai';

export class EmbeddingsClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    const vector = response.data[0]?.embedding;
    if (!vector) {
      throw new Error('Failed to generate embedding.');
    }
    return vector;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      try {
        const vector = await this.embedText(text);
        vectors.push(vector);
      } catch (error) {
        core.warning(`Embedding failed, falling back on sequential order: ${(error as Error).message}`);
        throw error;
      }
    }
    return vectors;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions do not match.');
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
