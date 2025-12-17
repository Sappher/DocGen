import path from 'path';

import * as core from '@actions/core';

import { getActionInputs } from './config';
import { buildRepositoryContext } from './contextBuilder';
import { OpenAIClient } from './openaiClient';
import { loadPromptFiles } from './prompts';
import { GitPublisher } from './publishers/gitPublisher';
import { collectRepositoryFiles } from './repoScanner';
import { PromptResult, Publisher, RunSummary } from './types';

async function run(): Promise<void> {
  try {
    const config = getActionInputs();
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

    const { contextText, includedFiles } = buildRepositoryContext(repoFiles, config.maxRepoCharacters);
    core.info(`Including ${includedFiles.length} files within the model context (${contextText.length} chars).`);

    const openaiClient = new OpenAIClient(config.openaiApiKey);
    const publishers: Publisher[] = [new GitPublisher(config)];
    await Promise.all(publishers.map((publisher) => publisher.prepare()));

    const promptResults: PromptResult[] = [];

    for (const prompt of prompts) {
      core.startGroup(`Processing prompt ${prompt.relativePath}`);
      try {
        const response = await openaiClient.analyzePrompt({
          model: config.openaiModel,
          promptName: prompt.relativePath,
          repoContext: contextText,
          promptContent: prompt.content,
          temperature: config.temperature,
        });

        const parts = prompt.relativePath.split(/[\\/]+/).filter(Boolean);
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
      `Processed ${prompts.length} prompt(s).\\nIncluded ${includedFiles.length} repo file(s) in context.`,
    );
    if (promptResults.length) {
      summaryBuilder.addList(
        promptResults.map(
          (result) => `${result.prompt.relativePath} -> ${result.outputRelativePath}`,
        ),
      );
    }
    await summaryBuilder.write();
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
