import type { PiCompanyConfig } from './pi-company.js';

import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

export interface PlaneCapability {
  name: 'project' | 'work_items' | 'states' | 'modules' | 'cycles';
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
  knowledgeBackend: 'vb-wiki';
  pagesAutomation: 'disabled-by-policy';
}

export interface PlaneWorkItem {
  id: string;
  name?: string;
  sequence_id?: number;
  updated_at?: string;
  state?: unknown;
  [key: string]: unknown;
}

export interface PlaneState {
  id: string;
  name: string;
  group?: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled' | string;
  sequence?: number;
  [key: string]: unknown;
}

export type PlaneLifecycleTransition
  = | 'plan_draft_visible'
    | 'ready_for_development'
    | 'execution_started'
    | 'repair_started'
    | 'review_started'
    | 'technically_ready'
    | 'acceptance_rejected'
    | 'accepted_delivery_pending';

export interface PlaneWorkItemQuery {
  stateId?: string;
  assigneeId?: string;
  cursor?: string;
  perPage?: number;
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

export interface TransitionWorkItemOptions {
  workItemId: string;
  transition: PlaneLifecycleTransition;
  operationId: string;
  summary: string;
  evidenceRefs?: string[];
}

export interface TransitionWorkItemResult {
  changed: boolean;
  adopted: boolean;
  operationId: string;
  transition: PlaneLifecycleTransition;
  previousStateId: string | null;
  targetState: PlaneState | null;
  workItem: PlaneWorkItem;
  projection: 'applied' | 'already-applied' | 'comment-only';
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

function stateId(value: unknown): string | null {
  if (typeof value === 'string')
    return value;
  if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string')
    return (value as Record<string, unknown>).id as string;
  return null;
}

const lifecycleStatePreferences: Record<PlaneLifecycleTransition, {
  names: string[];
  groups: string[];
}> = {
  plan_draft_visible: {
    names: ['Draft', 'Backlog'],
    groups: ['backlog', 'unstarted'],
  },
  ready_for_development: {
    names: ['Ready', 'Todo', 'To Do'],
    groups: ['unstarted', 'backlog'],
  },
  execution_started: {
    names: ['In Progress', 'Started'],
    groups: ['started'],
  },
  repair_started: {
    names: ['In Progress', 'Started'],
    groups: ['started'],
  },
  review_started: {
    names: ['In Review', 'Review'],
    groups: ['started'],
  },
  technically_ready: {
    names: ['Ready for Milestone', 'Pending Acceptance', 'In Review'],
    groups: ['started'],
  },
  acceptance_rejected: {
    names: ['In Progress', 'Started'],
    groups: ['started'],
  },
  accepted_delivery_pending: {
    names: ['Accepted', 'Ready to Deliver', 'Pending Delivery'],
    groups: ['started', 'unstarted'],
  },
};

export function resolvePlaneLifecycleState(
  states: PlaneState[],
  transition: PlaneLifecycleTransition,
): PlaneState | null {
  const preference = lifecycleStatePreferences[transition];
  const sorted = [...states].sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
  for (const name of preference.names) {
    const match = sorted.find(state => state.name.trim().toLowerCase() === name.toLowerCase());
    if (match && preference.groups.includes(String(match.group ?? '').toLowerCase()))
      return match;
  }
  return sorted.find(state => preference.groups.includes(String(state.group ?? '').toLowerCase())) ?? null;
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

  private workspacePath(suffix = ''): string {
    return `/api/v1/workspaces/${encodeURIComponent(this.workspaceSlug)}${suffix}`;
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
      { name: 'states', required: true, path: this.projectPath('/states/?per_page=1') },
      { name: 'modules', required: true, path: this.projectPath('/modules/?per_page=1') },
      { name: 'cycles', required: false, path: this.projectPath('/cycles/?per_page=1') },
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
      knowledgeBackend: 'vb-wiki',
      pagesAutomation: 'disabled-by-policy',
    };
  }

  async readWorkItem(workItemId: string): Promise<PlaneWorkItem> {
    if (!entityIdPattern.test(workItemId))
      throw new Error('workItemId contains unsupported characters');
    const { response, body } = await this.request(
      this.projectPath(`/work-items/${encodeURIComponent(workItemId)}/?expand=state,module,labels,assignees`),
    );
    if (!response.ok)
      throw new Error(`Plane work item read failed with HTTP ${response.status}`);
    if (!body || typeof body !== 'object')
      throw new Error('Plane returned a non-object work item');
    return body as PlaneWorkItem;
  }

  async readWorkItemByIdentifier(identifier: string): Promise<PlaneWorkItem> {
    if (!entityIdPattern.test(identifier))
      throw new Error('identifier contains unsupported characters');
    const { response, body } = await this.request(
      this.workspacePath(`/work-items/${encodeURIComponent(identifier)}/?expand=state,module,labels,assignees`),
    );
    if (!response.ok)
      throw new Error(`Plane work item identifier read failed with HTTP ${response.status}`);
    if (!body || typeof body !== 'object')
      throw new Error('Plane returned a non-object work item');
    return body as PlaneWorkItem;
  }

  async listWorkItems(query: PlaneWorkItemQuery = {}): Promise<PlaneWorkItem[]> {
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 50));
    const params = new URLSearchParams({
      per_page: String(perPage),
      expand: 'state,module,labels,assignees',
    });
    if (query.stateId) {
      if (!entityIdPattern.test(query.stateId))
        throw new Error('stateId contains unsupported characters');
      params.set('state', query.stateId);
    }
    if (query.assigneeId) {
      if (!entityIdPattern.test(query.assigneeId))
        throw new Error('assigneeId contains unsupported characters');
      params.set('assignee', query.assigneeId);
    }
    if (query.cursor)
      params.set('cursor', query.cursor);
    const { response, body } = await this.request(this.projectPath(`/work-items/?${params}`));
    if (!response.ok)
      throw new Error(`Plane work item list failed with HTTP ${response.status}`);
    return collection(body) as PlaneWorkItem[];
  }

  async searchWorkItems(search: string): Promise<PlaneWorkItem[]> {
    const query = search.trim();
    if (!query || query.length > 200)
      throw new Error('search must contain 1-200 characters');
    const params = new URLSearchParams({
      search: query,
      project: this.projectId,
      expand: 'state,module,labels,assignees',
    });
    const { response, body } = await this.request(this.workspacePath(`/work-items/search/?${params}`));
    if (!response.ok)
      throw new Error(`Plane work item search failed with HTTP ${response.status}`);
    return collection(body) as PlaneWorkItem[];
  }

  async listStates(): Promise<PlaneState[]> {
    const { response, body } = await this.request(this.projectPath('/states/'));
    if (!response.ok)
      throw new Error(`Plane state list failed with HTTP ${response.status}`);
    return collection(body) as PlaneState[];
  }

  async listModules(): Promise<Array<Record<string, unknown>>> {
    const { response, body } = await this.request(this.projectPath('/modules/?per_page=100'));
    if (!response.ok)
      throw new Error(`Plane module list failed with HTTP ${response.status}`);
    return collection(body);
  }

  async listCycles(): Promise<Array<Record<string, unknown>>> {
    const { response, body } = await this.request(this.projectPath('/cycles/?per_page=100'));
    if (!response.ok)
      throw new Error(`Plane cycle list failed with HTTP ${response.status}`);
    return collection(body);
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

  async transitionWorkItem(options: TransitionWorkItemOptions): Promise<TransitionWorkItemResult> {
    if (!entityIdPattern.test(options.workItemId))
      throw new Error('workItemId contains unsupported characters');
    if (!operationIdPattern.test(options.operationId))
      throw new Error('operationId contains unsupported characters');

    const workItem = await this.readWorkItem(options.workItemId);
    const previousStateId = stateId(workItem.state);
    const states = await this.listStates();
    const targetState = resolvePlaneLifecycleState(states, options.transition);
    if (!targetState) {
      await this.appendProgress({
        workItemId: options.workItemId,
        operationId: options.operationId,
        summary: `${options.summary}\nPlane projection unavailable: no non-terminal state matches ${options.transition}.`,
        evidenceRefs: options.evidenceRefs,
      });
      return {
        changed: false,
        adopted: false,
        operationId: options.operationId,
        transition: options.transition,
        previousStateId,
        targetState: null,
        workItem,
        projection: 'comment-only',
      };
    }

    if (previousStateId === targetState.id) {
      const progress = await this.appendProgress({
        workItemId: options.workItemId,
        operationId: options.operationId,
        summary: options.summary,
        evidenceRefs: options.evidenceRefs,
      });
      return {
        changed: false,
        adopted: progress.adopted,
        operationId: options.operationId,
        transition: options.transition,
        previousStateId,
        targetState,
        workItem,
        projection: 'already-applied',
      };
    }

    const updated = await this.request(
      this.projectPath(`/work-items/${encodeURIComponent(options.workItemId)}/`),
      {
        method: 'PATCH',
        body: JSON.stringify({ state: targetState.id }),
      },
      1,
    );
    if (!updated.response.ok)
      throw new Error(`Plane work item transition failed with HTTP ${updated.response.status}`);

    const confirmed = await this.readWorkItem(options.workItemId);
    if (stateId(confirmed.state) !== targetState.id)
      throw new Error('Plane work item transition could not be confirmed by read-back');

    const progress = await this.appendProgress({
      workItemId: options.workItemId,
      operationId: options.operationId,
      summary: options.summary,
      evidenceRefs: options.evidenceRefs,
    });
    return {
      changed: true,
      adopted: progress.adopted,
      operationId: options.operationId,
      transition: options.transition,
      previousStateId,
      targetState,
      workItem: confirmed,
      projection: 'applied',
    };
  }
}
