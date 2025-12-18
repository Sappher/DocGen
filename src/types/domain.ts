export interface ActionInputs {
  workspacePath: string;
  promptsFolder: string;
  outputFolder: string;
  promptsFolderInput: string;
  outputFolderInput: string;
  openaiModel: string;
  openaiApiKey: string;
  githubToken: string;
  excludePatterns: string[];
  maxFileSizeBytes: number;
  maxRepoCharacters: number;
  temperature: number;
  branchName: string;
  baseBranch: string;
  prTitle: string;
  prBody: string;
  dryRun: boolean;
  repoFullName: string;
  repositoryOwner: string;
  repositoryName: string;
  runId: number;
  runAttempt: number;
  gitPublisherEnabled: boolean;
  confluence?: ConfluenceSettings;
}

export interface PromptFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

export interface RepositoryFile {
  relativePath: string;
  size: number;
  content: string;
}

export interface PromptResult {
  prompt: PromptFile;
  outputRelativePath: string;
  outputAbsolutePath: string;
  content: string;
}

export interface RunSummary {
  promptResults: PromptResult[];
}

export interface Publisher {
  prepare(): Promise<void>;
  publishPromptResult(result: PromptResult): Promise<void>;
  finalize(summary: RunSummary): Promise<void>;
}

export interface ConfluenceSettings {
  enabled: boolean;
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey?: string;
  pageMap: Record<string, string>;
}
