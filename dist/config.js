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
exports.getActionInputs = getActionInputs;
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
function coalesceInput(name, envName) {
    const actionValue = core.getInput(name);
    if (actionValue) {
        return actionValue.trim();
    }
    const envValue = process.env[envName ?? name.replace(/-/g, '_').toUpperCase()];
    return envValue ? envValue.trim() : '';
}
function coalesceBooleanInput(name, envName, defaultValue = false) {
    const actionProvided = core.getInput(name);
    if (actionProvided) {
        return /^true$/i.test(actionProvided.trim());
    }
    const envValue = process.env[envName ?? name.replace(/-/g, '_').toUpperCase()];
    if (envValue) {
        return /^true$/i.test(envValue.trim());
    }
    return defaultValue;
}
function parseNumber(value, fallback) {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function getActionInputs() {
    const workspacePath = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const promptsFolderInput = coalesceInput('prompts-folder', 'PROMPTS_FOLDER') || 'prompts';
    const outputFolderInput = coalesceInput('output-folder', 'OUTPUT_FOLDER') || 'generated-docs';
    const promptsFolder = path_1.default.resolve(workspacePath, promptsFolderInput);
    const outputFolder = path_1.default.resolve(workspacePath, outputFolderInput);
    const openaiApiKey = coalesceInput('openai-api-key', 'OPENAI_API_KEY') || process.env.OPENAI_API_KEY || '';
    if (!openaiApiKey) {
        throw new Error('Missing OpenAI API key. Provide it via the openai-api-key input or env.');
    }
    const githubToken = coalesceInput('github-token', 'GITHUB_TOKEN') || process.env.GITHUB_TOKEN || '';
    if (!githubToken) {
        throw new Error('Missing GitHub token. Provide it via the github-token input or env.');
    }
    const excludePatterns = core
        .getMultilineInput('exclude-patterns', { trimWhitespace: true })
        .filter(Boolean);
    if (!excludePatterns.length) {
        const envPatterns = process.env.EXCLUDE_PATTERNS;
        if (envPatterns) {
            excludePatterns.push(...envPatterns
                .split(/\r?\n/) // newline separated
                .map((line) => line.trim())
                .filter(Boolean));
        }
    }
    const maxFileSizeBytes = parseNumber(coalesceInput('max-file-size-bytes', 'MAX_FILE_SIZE_BYTES'), 750000);
    const maxRepoCharacters = parseNumber(coalesceInput('max-repo-characters', 'MAX_REPO_CHARACTERS'), 400000);
    const temperatureRaw = coalesceInput('temperature', 'OPENAI_TEMPERATURE');
    const parsedTemp = Number(temperatureRaw);
    const temperature = Number.isFinite(parsedTemp)
        ? Math.min(Math.max(parsedTemp, 0), 2)
        : 0;
    const model = coalesceInput('openai-model', 'OPENAI_MODEL') || 'gpt-4.1-mini';
    const branchNameInput = coalesceInput('branch-name', 'BRANCH_NAME');
    const runId = github_1.context.runId ?? Date.now();
    const runAttempt = github_1.context.runAttempt ?? 1;
    const defaultBranchName = `docgen/run-${runId}-${runAttempt}`;
    const branchName = branchNameInput || defaultBranchName;
    const baseBranch = coalesceInput('base-branch', 'BASE_BRANCH') || github_1.context.ref?.replace('refs/heads/', '') || 'main';
    const prTitle = coalesceInput('pr-title', 'PR_TITLE') || 'AI-generated documentation and analysis updates';
    const prBodyTemplate = coalesceInput('pr-body', 'PR_BODY') ||
        'Automated updates generated by the docgen action. Please review the changes.';
    const dryRun = coalesceBooleanInput('dry-run', 'DRY_RUN', false);
    const repoFullName = process.env.GITHUB_REPOSITORY ?? '';
    if (!repoFullName) {
        throw new Error('GITHUB_REPOSITORY env is required when running inside GitHub Actions.');
    }
    const [repositoryOwner, repositoryName] = repoFullName.split('/', 2);
    return {
        workspacePath,
        promptsFolder,
        outputFolder,
        promptsFolderInput,
        outputFolderInput,
        openaiModel: model,
        openaiApiKey,
        githubToken,
        excludePatterns,
        maxFileSizeBytes,
        maxRepoCharacters,
        temperature,
        branchName,
        baseBranch,
        prTitle,
        prBody: prBodyTemplate,
        dryRun,
        repoFullName,
        repositoryOwner,
        repositoryName,
        runId,
        runAttempt,
    };
}
