# DocGen GitHub Action

DocGen is a reusable GitHub Action that scans a repository, feeds relevant source files and Markdown prompts into an OpenAI model, and writes the model responses back to the repo before opening a pull request. The generated artifacts can then be reviewed, iterated on, or forwarded to other systems (future "publisher" integrations such as Confluence are planned).

## Features

- Read `.md` prompts from a configurable folder and mirror the folder structure in the output directory.
- Gather repository files while respecting default guards (binary detection, size limits, ignored folders) plus optional user-supplied patterns similar to `.gitignore`.
- Generate analysis/output for each prompt via a configurable OpenAI model.
- Publish results through a pluggable pipeline (the MVP ships with the Git/PR publisher that writes files, commits them, and creates a single PR per run).
- Designed for future publishers (e.g., Confluence) without touching the core generation pipeline.

## Usage

```yaml
name: DocGen

on:
  workflow_dispatch:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run DocGen
        uses: sappher/docgen@v1
        with:
          prompts-folder: gen/prompts
          output-folder: gen/docs
          openai-model: gpt-4.1-mini
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note:** Always provide `openai-api-key` and `github-token` via secrets. The action also respects the same values from environment variables for compatibility with workflows that prefer `env` assignments.
>
> **GitHub permissions:** Ensure the repository’s *Settings → Actions → General → Workflow permissions* is set to “Read and write permissions” and “Allow GitHub Actions to create and approve pull requests.” Without that, the default `GITHUB_TOKEN` cannot open PRs.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `openai-api-key` | ✅ | OpenAI API key used for model calls. Also read from `OPENAI_API_KEY` env. |
| `github-token` | ✅ | Token used for Git and PR operations. Defaults to `secrets.GITHUB_TOKEN`. |
| `prompts-folder` |  | Path to the folder containing prompt `.md` files. Defaults to `prompts`. |
| `output-folder` |  | Destination for generated outputs. Defaults to `generated-docs`. |
| `openai-model` |  | OpenAI model name (e.g., `gpt-4.1-mini`). |
| `exclude-patterns` |  | Newline-separated patterns (gitignore style) to skip when building the repo context. |
| `max-file-size-bytes` |  | Maximum individual file size to include (defaults to `750000`). |
| `max-repo-characters` |  | Maximum combined characters of repo context sent to the model (defaults to `400000`). |
| `temperature` |  | Sampling temperature passed to OpenAI (defaults to `0`). |
| `branch-name` |  | Branch to push results to. Defaults to `docgen/run-<runId>-<attempt>`. |
| `base-branch` |  | Base branch for the PR (defaults to the triggering ref). |
| `pr-title` / `pr-body` |  | Customize PR metadata. |
| `dry-run` |  | When `true`, skip git pushes and PR creation while still writing files locally. |

## Prompts and Outputs

- Place Markdown prompts anywhere under the configured prompts folder. Nested folders are supported.
- For each prompt, the action writes the AI response to the matching path inside the output folder (e.g., `gen/prompts/ARCHITECTURE.md` → `gen/docs/ARCHITECTURE.md`).
- All generated files are collected into a single branch/PR per workflow run.

## Repository Guardrails

- Binary files, archives, git internals, lockfiles, and folders such as `node_modules` are skipped automatically.
- Maximum file size and overall character budget are configurable inputs.
- Users can provide custom exclusion patterns to omit sensitive files or large directories.

## Development

```bash
npm install
npm run build
npm test
```

During development you can run the compiled action locally via `node dist/index.js` after setting required env vars (`GITHUB_REPOSITORY`, `GITHUB_WORKSPACE`, etc.).

Before publishing a new release tag, run `npm run build` to refresh `dist/index.js` and commit the compiled output.
