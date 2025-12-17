import * as core from '@actions/core';
import OpenAI from 'openai';

interface AnalyzePromptOptions {
  model: string;
  promptName: string;
  repoContext: string;
  promptContent: string;
  temperature: number;
}

const RETRY_ATTEMPTS = 3;
type OpenAIResponse = Record<string, unknown>;

export class OpenAIClient {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyzePrompt(options: AnalyzePromptOptions): Promise<string> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.client.responses.create({
          model: options.model,
          temperature: options.temperature,
          stream: false,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: 'You are an assistant that analyzes source code repositories and produces concise, accurate documentation or analysis based on user prompts. Always cite file names when referencing code.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Repository context (truncated to ${options.repoContext.length} chars):\n${options.repoContext}\n\nPrompt: ${options.promptName}\n${options.promptContent}`,
                },
              ],
            },
          ],
        });

        const text = extractText(response as unknown as OpenAIResponse).trim();
        if (text.length === 0) {
          throw new Error('Received empty response from OpenAI.');
        }
        return text;
      } catch (error) {
        const remaining = RETRY_ATTEMPTS - attempt;
        core.warning(
          `OpenAI call failed for ${options.promptName} (attempt ${attempt}/${RETRY_ATTEMPTS}): ${
            (error as Error).message
          }`,
        );
        if (remaining <= 0) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error('Failed to call OpenAI after retries.');
  }
}

function extractText(response: OpenAIResponse): string {
  const outputText = (response as { output_text?: string[] }).output_text;
  if (Array.isArray(outputText) && outputText.length > 0) {
    return outputText.join('\n');
  }

  const output = (response as { output?: Array<{ content?: Array<{ type: string; text?: string }> }> })
    .output;
  if (!Array.isArray(output)) {
    return '';
  }

  const segments: string[] = [];
  for (const item of output) {
    if (!item || !Array.isArray(item.content)) {
      continue;
    }
    for (const entry of item.content) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      if (entry.type === 'output_text' || entry.type === 'text') {
        if (typeof entry.text === 'string') {
          segments.push(entry.text);
        }
      }
    }
  }

  return segments.join('\n');
}
