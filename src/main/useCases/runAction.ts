import path from 'path';

import * as core from '@actions/core';

import { getActionInputs } from '../../config/inputs';
import { CodexCliClient } from '../../domain/services/codexCli';
import { loadPromptFiles } from '../../domain/services/prompts';
import { createPublishers } from '../../publishers';
import { PromptResult, RunSummary } from '../../types/domain';

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
    const codexClient = new CodexCliClient(config.codex);
    try {
      await codexClient.prepare();
      const publishers = createPublishers(config);
      await Promise.all(publishers.map((publisher) => publisher.prepare()));

      const promptResults: PromptResult[] = [];

      for (const prompt of prompts) {
        core.startGroup(`Processing prompt ${prompt.relativePath}`);
        try {
          const response = await codexClient.generateOutput({
            workingDirectory: config.workspacePath,
            promptName: prompt.relativePath,
            promptContent: prompt.content,
            outputRelativePath: prompt.relativePath,
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

      const summaryBuilder = core.summary
        .addHeading('DocGen Codex run')
        .addRaw(`Processed ${prompts.length} prompt(s).`);
      if (promptResults.length) {
        summaryBuilder.addList(
          promptResults.map((result) => `${result.prompt.relativePath} -> ${result.outputRelativePath}`),
        );
      }
      await summaryBuilder.write();
    } finally {
      await codexClient.cleanup();
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
