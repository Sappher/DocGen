# DocGen GitHub Action

DocGen is a reusable GitHub Action that reads Markdown prompts from your repository, invokes the Codex CLI once per prompt, and writes the generated Markdown back into the repo before optionally opening a pull request or publishing to Confluence.

Instead of pre-building a large repository context and sending it to a single model call, DocGen lets Codex inspect the repository directly from the checked-out workspace.

## Features

- Read `.md` prompts from a configurable folder and mirror the folder structure in the output directory.
- Run one isolated Codex task per prompt for better retryability, debugging, and cleaner PR diffs.
- Keep publishing separate from generation through pluggable publishers.
- Publish generated outputs through Git/PR or Confluence.

## Usage

DocGen expects the `codex` CLI to already be installed and authenticated on the runner. If you use a custom path, set `codex-executable`.

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

      - name: Install Codex CLI
        run: |
          npm install -g @openai/codex

      - name: Run DocGen
        uses: sappher/docgen@v1
        with:
          enable-git: true
          prompts-folder: gen/prompts
          output-folder: gen/docs
          codex-api-key: ${{ secrets.OPENAI_API_KEY }}
          codex-model: gpt-5-codex
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Codex CLI:** The runner must have a working `codex` binary. For CI, the simplest setup is to pass `codex-api-key` so DocGen can run `codex login --with-api-key` automatically. Existing `openai-api-key` / `OPENAI_API_KEY` values are also accepted as a compatibility fallback.
>
> **GitHub permissions:** Ensure the repository’s _Settings → Actions → General → Workflow permissions_ is set to “Read and write permissions” and “Allow GitHub Actions to create and approve pull requests.” Without that, the default `GITHUB_TOKEN` cannot open PRs.
>
> **Publishers:** At least one publisher must be enabled. Set `enable-git: true` or enable Confluence; otherwise the action exits early with an error reminding you to enable publishing.

## Inputs

| Input                                       | Required | Description                                                                                                                                                          |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompts-folder`                            |          | Path to the folder containing prompt `.md` files. Defaults to `prompts`.                                                                                            |
| `output-folder`                             |          | Destination for generated outputs. Defaults to `generated-docs`.                                                                                                     |
| `codex-executable`                          |          | Codex CLI executable name or absolute path. Defaults to `codex`.                                                                                                     |
| `codex-api-key`                             |          | Optional API key used to authenticate the Codex CLI via `codex login --with-api-key` before prompt execution.                                                        |
| `openai-api-key`                            |          | Deprecated alias for `codex-api-key`, kept for compatibility with older workflows and `OPENAI_API_KEY`.                                                              |
| `codex-model`                               |          | Optional model override passed to `codex exec --model`.                                                                                                              |
| `codex-profile`                             |          | Optional profile passed to `codex exec --profile`.                                                                                                                   |
| `codex-sandbox`                             |          | Sandbox mode passed to `codex exec --sandbox`. Defaults to `read-only`.                                                                                             |
| `codex-config`                              |          | Newline-separated `codex exec --config` overrides.                                                                                                                   |
| `github-token`                              |          | Token used for Git and PR operations. Required only when `enable-git: true`.                                                                                         |
| `branch-name`                               |          | Branch to push results to. Defaults to `docgen/run-<runId>-<attempt>`.                                                                                               |
| `base-branch`                               |          | Base branch for the PR (defaults to the triggering ref).                                                                                                             |
| `pr-title` / `pr-body`                      |          | Customize PR metadata.                                                                                                                                               |
| `dry-run`                                   |          | When `true`, skip git pushes and PR creation while still writing files locally.                                                                                      |
| `enable-git`                                |          | Set to `true` to allow DocGen to commit files and open a PR in the current repo.                                                                                     |
| `enable-confluence`                         |          | Set to `true` to push generated outputs to Confluence in addition to the PR.                                                                                         |
| `system-prompt-file`                        |          | Optional path to a repository file whose contents are prepended to every Codex task.                                                                                 |
| `confluence-base-url`                       |          | Base URL to your Confluence site (e.g., `https://example.atlassian.net/wiki/`). Required when Confluence publishing is enabled.                                     |
| `confluence-email` / `confluence-api-token` |          | Email + PAT used for Confluence REST authentication.                                                                                                                 |
| `confluence-space-key`                      |          | Optional space key override if the target pages should be forced into a specific space.                                                                              |
| `confluence-page-map`                       |          | JSON object or newline-separated `prompt/path.md=PAGE_ID` pairs defining which prompt maps to which Confluence page. Required when Confluence publishing is enabled. |

## Prompt and Output Contract

- Place Markdown prompts anywhere under the configured prompts folder. Nested folders are supported.
- For each prompt, DocGen runs a separate `codex exec` task rooted at the repository workspace.
- Codex is instructed to inspect the repo directly and return only the Markdown content for the matching output file.
- The action writes that final message to the matching path inside the output folder (e.g., `gen/prompts/ARCHITECTURE.md` → `gen/docs/ARCHITECTURE.md`).
- All generated files are collected into a single branch/PR per workflow run.

## Confluence Publisher

When `enable-confluence: true`, DocGen publishes generated outputs directly to Confluence in addition to opening the PR. Supply the following inputs:

- `confluence-base-url`: Full site URL, typically `https://<site>.atlassian.net/wiki/`
- `confluence-email` and `confluence-api-token`: Credentials for a PAT-enabled account
- `confluence-page-map`: Mapping between prompt file paths and Confluence page IDs
- Optional `confluence-space-key` to override the destination space

Example mapping:

```yaml
confluence-page-map: |
  ARCHITECTURE.md=123456
  docs/ADR.md=789012
```

Paths are normalized to POSIX style, so `docs\\ADR.md` also works. If a prompt does not have a mapping, the Confluence publisher skips it.

## Development

```bash
npm install
npm run build
npm test
```

During development you can run the compiled action locally via `node dist/index.js` after setting required env vars such as `GITHUB_REPOSITORY` and `GITHUB_WORKSPACE`, and ensuring the `codex` CLI is installed and authenticated.

Before publishing a new release tag, run `npm run build` to refresh `dist/index.js` and commit the compiled output.
