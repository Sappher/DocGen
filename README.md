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
          enable-git: true
          prompts-folder: gen/prompts
          output-folder: gen/docs
          openai-model: gpt-4o-mini
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note:** Always provide `openai-api-key` and `github-token` via secrets. The action also respects the same values from environment variables for compatibility with workflows that prefer `env` assignments. You can omit GITHUB_TOKEN if you run the action directly from Github action, as the token is automatically injected by Github.
>
> **GitHub permissions:** Ensure the repository’s _Settings → Actions → General → Workflow permissions_ is set to “Read and write permissions” and “Allow GitHub Actions to create and approve pull requests.” Without that, the default `GITHUB_TOKEN` cannot open PRs.
>
> **Publishers:** At least one publisher must be enabled. Set `enable-git: true` (as above) or enable Confluence; otherwise the action exits early with an error reminding you to enable GitHub publishing.

## Inputs

| Input                                       | Required | Description                                                                                                                                                          |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai-api-key`                            | ✅       | OpenAI API key used for model calls. Also read from `OPENAI_API_KEY` env.                                                                                            |
| `github-token`                              | ✅       | Token used for Git and PR operations. Defaults to `secrets.GITHUB_TOKEN`.                                                                                            |
| `prompts-folder`                            |          | Path to the folder containing prompt `.md` files. Defaults to `prompts`.                                                                                             |
| `output-folder`                             |          | Destination for generated outputs. Defaults to `generated-docs`.                                                                                                     |
| `openai-model`                              |          | OpenAI model name (e.g., `gpt-4o-mini`).                                                                                                                              |
| `exclude-patterns`                          |          | Newline-separated patterns (gitignore style) to skip when building the repo context.                                                                                 |
| `max-file-size-bytes`                       |          | Maximum individual file size to include (defaults to `750000`).                                                                                                      |
| `max-repo-characters`                       |          | Maximum combined characters of repo context sent to the model (defaults to `1000000`).                                                                               |
| `context-chunk-size`                        |          | Approximate characters per repository chunk before embeddings/ranking (defaults to `4000`).                                                                          |
| `temperature`                               |          | Sampling temperature passed to OpenAI (defaults to `0`).                                                                                                             |
| `branch-name`                               |          | Branch to push results to. Defaults to `docgen/run-<runId>-<attempt>`.                                                                                               |
| `base-branch`                               |          | Base branch for the PR (defaults to the triggering ref).                                                                                                             |
| `pr-title` / `pr-body`                      |          | Customize PR metadata.                                                                                                                                               |
| `dry-run`                                   |          | When `true`, skip git pushes and PR creation while still writing files locally.                                                                                      |
| `enable-git`                                |          | Set to `true` to allow DocGen to commit files and open a PR in the current repo.                                                                                     |
| `enable-confluence`                         |          | Set to `true` to push generated outputs to Confluence in addition to the PR.                                                                                         |
| `enable-embeddings`                         |          | Set to `true` to rank repository chunks per prompt using OpenAI embeddings.                                                                                          |
| `embeddings-model`                          |          | Embeddings model (defaults to `text-embedding-3-large` when enabled).                                                                                                |
| `max-embeddings-chunks`                     |          | Optional cap on the number of top-ranked chunks per prompt.                                                                                                          |
| `system-prompt-file`                        |          | Optional path to a repository file whose contents are sent as the system prompt.                                                                                    |
| `confluence-base-url`                       |          | Base URL to your Confluence site (e.g., `https://example.atlassian.net/wiki/`). Required when Confluence publishing is enabled.                                      |
| `confluence-email` / `confluence-api-token` |          | Email + PAT used for Confluence REST authentication.                                                                                                                 |
| `confluence-space-key`                      |          | Optional space key override if the target pages should be forced into a specific space.                                                                              |
| `confluence-page-map`                       |          | JSON object or newline-separated `prompt/path.md=PAGE_ID` pairs defining which prompt maps to which Confluence page. Required when Confluence publishing is enabled. |

## Prompts and Outputs

- Place Markdown prompts anywhere under the configured prompts folder. Nested folders are supported.
- For each prompt, the action writes the AI response to the matching path inside the output folder (e.g., `gen/prompts/ARCHITECTURE.md` → `gen/docs/ARCHITECTURE.md`).
- All generated files are collected into a single branch/PR per workflow run.

## Repository Guardrails

- Binary files, archives, git internals, lockfiles, and folders such as `node_modules` are skipped automatically.
- Maximum file size and overall character budget are configurable inputs.
- Users can provide custom exclusion patterns to omit sensitive files or large directories.

## Confluence Publisher

When `enable-confluence: true`, DocGen publishes AI outputs directly to Confluence in addition to opening the PR. Supply the following inputs (usually via workflow `with:` or repository/environment secrets):

- `confluence-base-url`: Full site URL, typically `https://<site>.atlassian.net/wiki/`.
- `confluence-email` and `confluence-api-token`: Credentials for a PAT-enabled account.
- `confluence-page-map`: Mapping between prompt file paths and Confluence page IDs (either JSON or newline-separated `prompt=PAGE_ID` pairs). Each prompt must have a page ID defined.
- Optional `confluence-space-key` if you want to override the destination space (otherwise the page's existing space is used).
- Provide the mapping between prompts and page IDs via either JSON or newline-separated pairs:

  ```yaml
  confluence-page-map: |
    ARCHITECTURE.md=123456
    docs/ADR.md=789012
  ```

  or

  ```yaml
  confluence-page-map: >
    {"ARCHITECTURE.md":"123456","docs/ADR.md":"789012"}
  ```

  Paths are normalized to POSIX style, so `docs\\ADR.md` also works. If a prompt does not have a mapping, the Confluence publisher skips it.

On each run, the action updates the mapped page by incrementing the version and replacing the body with the generated Markdown converted to Confluence storage format.

## Embeddings (optional)

When `enable-embeddings: true`, DocGen generates OpenAI embeddings for each repository chunk and ranks them per prompt so the model receives the most relevant code first. You can override the embeddings model via `embeddings-model` and limit the ranked chunks with `max-embeddings-chunks`. If embeddings initialization fails, DocGen automatically falls back to the default sequential chunk order.

## Development

```bash
npm install
npm run build
npm test
```

During development you can run the compiled action locally via `node dist/index.js` after setting required env vars (`GITHUB_REPOSITORY`, `GITHUB_WORKSPACE`, etc.).

Before publishing a new release tag, run `npm run build` to refresh `dist/index.js` and commit the compiled output.
