"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const config_1 = require("./config");
const contextBuilder_1 = require("./contextBuilder");
const openaiClient_1 = require("./openaiClient");
const prompts_1 = require("./prompts");
const gitPublisher_1 = require("./publishers/gitPublisher");
const repoScanner_1 = require("./repoScanner");
async function run() {
    try {
        const config = (0, config_1.getActionInputs)();
        core.info(`Using prompts from ${config.promptsFolderInput} and outputs to ${config.outputFolderInput}`);
        const prompts = await (0, prompts_1.loadPromptFiles)(config.promptsFolder);
        if (!prompts.length) {
            throw new Error('No prompts were discovered. Please add .md files to the prompt folder.');
        }
        const excludePatterns = [...config.excludePatterns];
        const outputRelative = path_1.default.relative(config.workspacePath, config.outputFolder).split(path_1.default.sep).join('/');
        if (outputRelative && !outputRelative.startsWith('..')) {
            excludePatterns.push(`${outputRelative}/`);
        }
        const repoFiles = await (0, repoScanner_1.collectRepositoryFiles)({
            root: config.workspacePath,
            excludePatterns,
            maxFileSizeBytes: config.maxFileSizeBytes,
        });
        if (!repoFiles.length) {
            core.warning('No repository files collected for context. The AI will only see the prompts.');
        }
        const { contextText, includedFiles } = (0, contextBuilder_1.buildRepositoryContext)(repoFiles, config.maxRepoCharacters);
        core.info(`Including ${includedFiles.length} files within the model context (${contextText.length} chars).`);
        const openaiClient = new openaiClient_1.OpenAIClient(config.openaiApiKey);
        const publishers = [new gitPublisher_1.GitPublisher(config)];
        await Promise.all(publishers.map((publisher) => publisher.prepare()));
        const promptResults = [];
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
                    parts.push(path_1.default.basename(prompt.absolutePath));
                }
                const outputRelativePath = parts.join('/');
                const outputAbsolutePath = path_1.default.join(config.outputFolder, ...parts);
                const result = {
                    prompt,
                    outputRelativePath,
                    outputAbsolutePath,
                    content: response,
                };
                promptResults.push(result);
                for (const publisher of publishers) {
                    await publisher.publishPromptResult(result);
                }
            }
            finally {
                core.endGroup();
            }
        }
        const summary = { promptResults };
        for (const publisher of publishers) {
            await publisher.finalize(summary);
        }
        const summaryBuilder = core.summary.addHeading('DocGen AI run').addRaw(`Processed ${prompts.length} prompt(s).\\nIncluded ${includedFiles.length} repo file(s) in context.`);
        if (promptResults.length) {
            summaryBuilder.addList(promptResults.map((result) => `${result.prompt.relativePath} -> ${result.outputRelativePath}`));
        }
        await summaryBuilder.write();
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
run();
