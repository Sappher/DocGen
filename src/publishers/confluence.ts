import * as core from '@actions/core';
import { marked } from 'marked';
import fetch, { RequestInit } from 'node-fetch';

import { ConfluenceSettings, PromptResult, Publisher, RunSummary } from '../types/domain';

interface ConfluencePageResponse {
  id: string;
  title?: string;
  type?: string;
  version?: { number?: number };
  space?: { key?: string };
}

export class ConfluencePublisher implements Publisher {
  private readonly authHeader: string;

  constructor(private readonly settings: ConfluenceSettings) {
    this.authHeader = `Basic ${Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64')}`;
  }

  async prepare(): Promise<void> {
    core.info('Confluence publisher enabled. Outputs mapped via confluence-page-map.');
  }

  async publishPromptResult(result: PromptResult): Promise<void> {
    const pageId = this.settings.pageMap[result.prompt.relativePath];
    if (!pageId) {
      core.warning(
        `No Confluence mapping found for ${result.prompt.relativePath}; skipping Confluence publish.`,
      );
      return;
    }

    await this.updatePage(pageId, result);
  }

  async finalize(_summary: RunSummary): Promise<void> {
    // no-op
  }

  private async updatePage(pageId: string, result: PromptResult): Promise<void> {
    try {
      const existing = (await this.request(`/rest/api/content/${pageId}?expand=version,space`)) as ConfluencePageResponse;
      const version = (existing?.version?.number ?? 0) + 1;
      const title = existing?.title || result.prompt.relativePath;
      const pageType = existing?.type || 'page';
      const spaceKey = this.settings.spaceKey || existing?.space?.key;

      const payload = {
        id: pageId,
        type: pageType,
        title,
        space: spaceKey ? { key: spaceKey } : undefined,
        body: {
          storage: {
            value: this.renderMarkdown(result.content),
            representation: 'storage',
          },
        },
        version: { number: version },
      };

      await this.request(`/rest/api/content/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      core.info(`Updated Confluence page ${pageId} for ${result.prompt.relativePath}.`);
    } catch (error) {
      throw new Error(
        `Failed to update Confluence page ${pageId} for ${result.prompt.relativePath}: ${
          (error as Error).message
        }`,
      );
    }
  }

  private renderMarkdown(markdown: string): string {
    return (marked.parse(markdown) as string).trim();
  }

  private async request(pathname: string, init?: RequestInit): Promise<unknown> {
    const url = this.buildUrl(pathname);
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Confluence API responded with ${response.status} ${response.statusText}: ${message}`);
    }

    if (response.status === 204) {
      return undefined;
    }

    return response.json();
  }

  private buildUrl(pathname: string): string {
    const base = this.settings.baseUrl.endsWith('/')
      ? this.settings.baseUrl
      : `${this.settings.baseUrl}/`;
    const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    return new URL(normalizedPath, base).toString();
  }
}
