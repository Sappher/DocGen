import OpenAI from 'openai';

export class EmbeddingsClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly batchSize: number;

  constructor(apiKey: string, model: string, batchSize = 50) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.batchSize = batchSize;
  }

  async embedText(text: string): Promise<number[]> {
    const [vector] = await this.embedTexts([text]);
    return vector;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });
      response.data.forEach((item) => {
        const embedding = item.embedding;
        if (!embedding) {
          throw new Error('Received empty embedding from OpenAI.');
        }
        vectors.push(embedding);
      });
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
