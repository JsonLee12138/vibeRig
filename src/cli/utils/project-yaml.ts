import { parse, stringify } from 'yaml';

export interface ProjectYamlOptions {
  projectName: string;
}

type YamlRecord = Record<string, unknown>;

function asRecord(value: unknown): YamlRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as YamlRecord
    : {};
}

function mergeSection(defaults: YamlRecord, existing: unknown): YamlRecord {
  return { ...defaults, ...asRecord(existing) };
}

export function defaultProjectProfile({ projectName }: ProjectYamlOptions): YamlRecord {
  return {
    version: 2,
    project: {
      name: projectName,
      root: '.',
      repo_url: '',
      architecture: 'ARCHITECTURE.md',
    },
    documents: {
      mode: 'discover',
      requirement_root: '.vibeRig/requirements',
      exec_plan_root: 'docs/exec-plans',
      runbook_index: 'docs/runbooks/index.md',
      context_routes: '.vibeRig/context-routes.yaml',
    },
    environment: {
      manifest: '.vibeRig/environments.yaml',
      default_profile: 'local',
    },
    commands: {
      bootstrap: '',
      start: '',
      reset: '',
      health: '',
      targeted_test: '',
      smoke: '',
    },
    evidence: {
      root: 'artifacts/viberig',
      retention: 'accepted_only',
    },
    tracking: {
      provider: 'linear',
      mode: 'adapter',
    },
    output: {
      language: 'zh-CN',
    },
    pull_request: {
      required: 'true',
      provider: 'auto',
      base_branch: '',
      draft: 'false',
    },
    linear: {
      team_id: '',
      project_id: '',
      project_document_id: '',
      project_document_title: 'VibeRig Project Registration',
    },
    gate_policy: {
      hooks_enabled: false,
      ci_required: 'project_decides',
      required_commands: [],
      manual_checks: [],
    },
    subagents: {
      default_research: 'researcher',
      default_qa: 'qa',
      default_security_audit: 'security_auditor',
      default_review: 'code_review',
    },
  };
}

export function projectYaml(options: ProjectYamlOptions): string {
  return stringify(defaultProjectProfile(options), { lineWidth: 0 });
}

export function projectProfileVersion(source: string): number | null {
  let parsed: unknown;
  try {
    parsed = parse(source);
  }
  catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    return null;
  return typeof (parsed as YamlRecord).version === 'number' ? (parsed as YamlRecord).version as number : null;
}

export function reconcileProjectYaml(source: string, options: ProjectYamlOptions): string {
  const parsed = parse(source);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError('project.yaml must contain a YAML object');

  const current = parsed as YamlRecord;
  const defaults = defaultProjectProfile(options);
  const legacyDocs = asRecord(current.docs);
  const documents = mergeSection(asRecord(defaults.documents), current.documents);

  if (documents.requirement_root === asRecord(defaults.documents).requirement_root && typeof legacyDocs.root === 'string')
    documents.requirement_root = legacyDocs.root;

  const reconciled: YamlRecord = {
    ...current,
    version: 2,
    project: mergeSection(asRecord(defaults.project), current.project),
    documents,
    environment: mergeSection(asRecord(defaults.environment), current.environment),
    commands: mergeSection(asRecord(defaults.commands), current.commands),
    evidence: mergeSection(asRecord(defaults.evidence), current.evidence),
    tracking: mergeSection(asRecord(defaults.tracking), current.tracking),
    output: mergeSection(asRecord(defaults.output), current.output),
    pull_request: mergeSection(asRecord(defaults.pull_request), current.pull_request),
    linear: mergeSection(asRecord(defaults.linear), current.linear),
    gate_policy: mergeSection(asRecord(defaults.gate_policy), current.gate_policy),
    subagents: mergeSection(asRecord(defaults.subagents), current.subagents),
  };

  delete reconciled.docs;
  delete reconciled.workspace;

  return stringify(reconciled, { lineWidth: 0 });
}
