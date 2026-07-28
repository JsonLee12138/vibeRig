import type { PiCompanyConfig } from './pi-company.js';

import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

export interface PlaneCapability {
  name: 'project' | 'work_items' | 'modules' | 'cycles' | 'pages';
  required: boolean;
  supported: boolean;
  status: number | null;
  detail: string;
}

export interface PlaneProbeResult {
  ok: boolean;
  baseUrl: string;
  workspaceSlug: string;
  projectId: string;
  capabilities: PlaneCapability[];
  pagesAutomation: 'available' | 'disabled';
}

export interface PlaneWorkItem {
  id: string;
  name?: string;
  sequence_id?: number;
  updated_at?: string;
  state?: unknown;
  [key: string]: unknown;
}

export interface AppendProgressOptions {
  workItemId: string;
  operationId: string;
  summary: string;
  evidenceRefs?: string[];
}

export interface AppendProgressResult {
  adopted: boolean;
  operationId: string;
  comment: Record<string, unknown>;
}

type FetchLike = typeof fetch;

const operationIdPattern = /^[A-Z0-9][\w.:-]{0,127}$/i;
const entityIdPattern = /^[A-Z0-9][\w-]{0,127}$/i;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

function collection(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value))
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['results', 'data', 'items']) {
      if (Array.isArray(record[key]))
        return collection(record[key]);
    }
  }
  return [];
}

export class PlaneGateway {
  readonly baseUrl: string;
  readonly workspaceSlug: string;
  readonly projectId: string;
  readonly apiKeyEnv: string;
  readonly fetcher: FetchLike;

  constructor(config: PiCompanyConfig['plane'], fetcher: FetchLike = fetch) {
    if (!config.base_url)
      throw new Error('Plane base URL is not configured');
    const base = new URL(config.base_url);
    if (base.username || base.password)
      throw new Error('Plane base URL must not contain credentials');
    if (!config.workspace_slug || !config.project_id)
      throw new Error('Plane workspace_slug and project_id must be configured');
    if (!entityIdPattern.test(config.workspace_slug))
      throw new Error('Plane workspace_slug contains unsupported characters');
    if (!entityIdPattern.test(config.project_id))
      throw new Error('Plane project_id contains unsupported characters');

    this.baseUrl = stripTrailingSlashes(base.toString());
    this.workspaceSlug = config.workspace_slug;
    this.projectId = config.project_id;
    this.apiKeyEnv = config.api_key_env;
    this.fetcher = fetcher;
  }

  private projectPath(suffix = ''): string {
    return `/api/v1/workspaces/${encodeURIComponent(this.workspaceSlug)}/projects/${encodeURIComponent(this.projectId)}${suffix}`;
  }

  private apiKey(): string {
    const key = process.env[this.apiKeyEnv];
    if (!key)
      throw new Error(`${this.apiKeyEnv} is not set`);
    return key;
  }

  private async request(
    path: string,
    init: RequestInit = {},
    attempts = 3,
  ): Promise<{ response: Response; body: unknown }> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'X-API-Key': this.apiKey(),
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
          },
        });
        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? await response.json()
          : await response.text();
        if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
          await delay(150 * attempt);
          continue;
        }
        return { response, body };
      }
      catch (error) {
        lastError = error as Error;
        if (attempt < attempts) {
          await delay(150 * attempt);
          continue;
        }
      }
      finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`Plane request failed: ${lastError?.message ?? 'unknown error'}`);
  }

  async probe(): Promise<PlaneProbeResult> {
    const checks: Array<{ name: PlaneCapability['name']; required: boolean; path: string }> = [
      { name: 'project', required: true, path: this.projectPath('/') },
      { name: 'work_items', required: true, path: this.projectPath('/work-items/?per_page=1') },
      { name: 'modules', required: true, path: this.projectPath('/modules/?per_page=1') },
      { name: 'cycles', required: false, path: this.projectPath('/cycles/?per_page=1') },
      { name: 'pages', required: false, path: this.projectPath('/pages/?per_page=1') },
    ];

    const capabilities: PlaneCapability[] = [];
    for (const check of checks) {
      try {
        const { response, body } = await this.request(check.path, {}, 1);
        capabilities.push({
          name: check.name,
          required: check.required,
          supported: response.ok,
          status: response.status,
          detail: response.ok
            ? 'available'
            : typeof body === 'string'
              ? body.slice(0, 160)
              : `HTTP ${response.status}`,
        });
      }
      catch (error) {
        capabilities.push({
          name: check.name,
          required: check.required,
          supported: false,
          status: null,
          detail: (error as Error).message,
        });
      }
    }

    return {
      ok: capabilities.every(capability => !capability.required || capability.supported),
      baseUrl: this.baseUrl,
      workspaceSlug: this.workspaceSlug,
      projectId: this.projectId,
      capabilities,
      pagesAutomation: capabilities.find(item => item.name === 'pages')?.supported ? 'available' : 'disabled',
    };
  }

  async readWorkItem(workItemId: string): Promise<PlaneWorkItem> {
    if (!entityIdPattern.test(workItemId))
      throw new Error('workItemId contains unsupported characters');
    const { response, body } = await this.request(this.projectPath(`/work-items/${encodeURIComponent(workItemId)}/`));
    if (!response.ok)
      throw new Error(`Plane work item read failed with HTTP ${response.status}`);
    if (!body || typeof body !== 'object')
      throw new Error('Plane returned a non-object work item');
    return body as PlaneWorkItem;
  }

  async appendProgress(options: AppendProgressOptions): Promise<AppendProgressResult> {
    if (!entityIdPattern.test(options.workItemId))
      throw new Error('workItemId contains unsupported characters');
    if (!operationIdPattern.test(options.operationId))
      throw new Error('operationId contains unsupported characters');
    const summary = options.summary.trim();
    if (!summary || summary.length > 4_000)
      throw new Error('summary must contain 1-4000 characters');
    const evidenceRefs = options.evidenceRefs ?? [];
    if (evidenceRefs.length > 20 || evidenceRefs.some(item => item.length > 512))
      throw new Error('evidenceRefs exceeds the allowed count or length');

    const commentsPath = this.projectPath(`/work-items/${encodeURIComponent(options.workItemId)}/comments/`);
    const existing = await this.request(`${commentsPath}?per_page=100`, {}, 1);
    if (!existing.response.ok)
      throw new Error(`Plane comment lookup failed with HTTP ${existing.response.status}`);
    const adopted = collection(existing.body).find(item => item.external_id === options.operationId);
    if (adopted)
      return { adopted: true, operationId: options.operationId, comment: adopted };

    const evidenceHtml = evidenceRefs.length
      ? `<ul>${evidenceRefs.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
    const payload = {
      comment_html: `<p>${escapeHtml(summary).replaceAll('\n', '<br>')}</p>${evidenceHtml}`,
      access: 'INTERNAL',
      external_source: 'viberig',
      external_id: options.operationId,
    };
    const created = await this.request(commentsPath, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 1);
    if (!created.response.ok)
      throw new Error(`Plane comment append failed with HTTP ${created.response.status}`);
    if (!created.body || typeof created.body !== 'object')
      throw new Error('Plane returned a non-object comment');

    const readBack = await this.request(`${commentsPath}?per_page=100`, {}, 1);
    const confirmed = collection(readBack.body).find(item => item.external_id === options.operationId);
    if (!confirmed)
      throw new Error('Plane comment write could not be confirmed by read-back');
    return { adopted: false, operationId: options.operationId, comment: confirmed };
  }
}
