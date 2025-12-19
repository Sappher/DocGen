import path from 'path';

import * as core from '@actions/core';

import { getActionInputs } from '../../config/inputs';
import { createFileChunks } from '../../domain/services/chunker';
import { buildRepositoryContext } from '../../domain/services/contextBuilder';
import { EmbeddingsRanker } from '../../domain/services/embeddingsRanker';
import { OpenAIClient } from '../../domain/services/openaiClient';
import { loadPromptFiles } from '../../domain/services/prompts';
import { collectRepositoryFiles } from '../../domain/services/repoScanner';
import { createPublishers } from '../../publishers';
import { PromptResult, RepoChunk, RunSummary } from '../../types/domain';

export async function runAction(): Promise<void> {
  try {
    const config = getActionInputs();
    if (!config.gitPublisherEnabled && !(config.confluence?.enabled)) {
      throw new Error(
        "No publishers enabled. Enable at least one, e.g., set 'enable-git: true' in the workflow inputs.",
      );
    }
    core.info(`Using prompts from ${config.promptsFolderInput} and outputs to ${config.outputFolderInput}`);

    const prompts = await loadPromptFiles(config.promptsFolder);
    if (!prompts.length) {
      throw new Error('No prompts were discovered. Please add .md files to the prompt folder.');
    }

    const excludePatterns = [...config.excludePatterns];
    const outputRelative = path.relative(config.workspacePath, config.outputFolder).split(path.sep).join('/');
    if (outputRelative && !outputRelative.startsWith('..')) {
      excludePatterns.push(`${outputRelative}/`);
    }

    const repoFiles = await collectRepositoryFiles({
      root: config.workspacePath,
      excludePatterns,
      maxFileSizeBytes: config.maxFileSizeBytes,
    });

    if (!repoFiles.length) {
      core.warning('No repository files collected for context. The AI will only see the prompts.');
    }

    const repoChunks = createFileChunks(repoFiles, config.contextChunkSize);
    core.info(`Prepared ${repoChunks.length} repository chunks for context building.`);

    let embeddingsRanker: EmbeddingsRanker | undefined;
    if (config.embeddings?.enabled) {
      core.info(
        `Embeddings enabled: generating vectors for ${repoChunks.length} chunk(s) using ${config.embeddings.model}. This may take a few minutes.`,
      );
      try {
        embeddingsRanker = await EmbeddingsRanker.build({
          apiKey: config.openaiApiKey,
          settings: config.embeddings,
          chunks: repoChunks,
        });
        core.info('Embeddings enabled: ranking chunks per prompt.');
      } catch (error) {
        core.warning(
          `Failed to initialize embeddings ranker, falling back to sequential chunks: ${
            (error as Error).message
          }`,
        );
        core.info('Embeddings ready; chunks will be ranked per prompt.');
        embeddingsRanker = undefined;
      }
    }

    const openaiClient = new OpenAIClient(config.openaiApiKey);
    const publishers = createPublishers(config);
    await Promise.all(publishers.map((publisher) => publisher.prepare()));

    const promptResults: PromptResult[] = [];
    const summaryIncludedFiles = new Set<string>();

    for (const prompt of prompts) {
      core.startGroup(`Processing prompt ${prompt.relativePath}`);
      try {
        const chunkOrder = embeddingsRanker
          ? await rankChunksSafely(embeddingsRanker, prompt.content, repoChunks)
          : repoChunks;

        const { contextText, includedFiles } = buildRepositoryContext({
          chunks: chunkOrder,
          maxCharacters: config.maxRepoCharacters,
        });
        includedFiles.forEach((file) => summaryIncludedFiles.add(file.relativePath));
        core.info(
          `Context for ${prompt.relativePath}: ${includedFiles.length} file(s), ${contextText.length} chars.`,
        );

        const response = await openaiClient.analyzePrompt({
          model: config.openaiModel,
          promptName: prompt.relativePath,
          repoContext: contextText,
          promptContent: prompt.content,
          temperature: config.temperature,
          systemPrompt: config.systemPrompt,
        });

        const parts = prompt.relativePath.split(/[/\\]+/).filter(Boolean);
        if (!parts.length) {
          parts.push(path.basename(prompt.absolutePath));
        }
        const outputRelativePath = parts.join('/');
        const outputAbsolutePath = path.join(config.outputFolder, ...parts);

        const result: PromptResult = {
          prompt,
          outputRelativePath,
          outputAbsolutePath,
          content: response,
        };
        promptResults.push(result);

        for (const publisher of publishers) {
          await publisher.publishPromptResult(result);
        }
      } finally {
        core.endGroup();
      }
    }

    const summary: RunSummary = { promptResults };
    for (const publisher of publishers) {
      await publisher.finalize(summary);
    }

    const summaryBuilder = core.summary.addHeading('DocGen AI run').addRaw(
      `Processed ${prompts.length} prompt(s).\nIncluded ${summaryIncludedFiles.size} unique repo file(s) across contexts.`,
    );
    if (promptResults.length) {
      summaryBuilder.addList(
        promptResults.map((result) => `${result.prompt.relativePath} -> ${result.outputRelativePath}`),
      );
    }
    await summaryBuilder.write();
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

async function rankChunksSafely(
  ranker: EmbeddingsRanker,
  promptContent: string,
  fallback: RepoChunk[],
): Promise<RepoChunk[]> {
  try {
    return await ranker.rankChunks(promptContent);
  } catch (error) {
    core.warning(
      `Failed to rank chunks for prompt, using sequential order: ${(error as Error).message}`,
    );
    return fallback;
  }
}
