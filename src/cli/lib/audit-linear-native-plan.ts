import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'

export interface Check {
  name: string
  passed: boolean
  evidence: string
}

// Only the fields this audit inspects; the manifest has more, left untyped via passthrough.
const pluginManifestSchema = z.object({
  interface: z.object({
    defaultPrompt: z.array(z.string()).optional(),
  }).optional(),
  keywords: z.array(z.string()).optional(),
  skills: z.string().optional(),
}).passthrough()

const IGNORED_DIR_PARTS = new Set(['.git', '.worktrees', '__pycache__', 'node_modules'])

function noMatchingFile(root: string, name: string): boolean {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(dir)
    }
    catch {
      continue
    }
    for (const entry of entries) {
      if (IGNORED_DIR_PARTS.has(entry))
        continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory())
        stack.push(full)
      else if (entry === name)
        return false
    }
  }
  return true
}

export function runLinearNativePlanAudit(cwd = '.'): { checks: Check[], failed: Check[] } {
  const root = resolve(cwd)

  const read = (path: string) => readFileSync(join(root, path), 'utf-8')
  const exists = (path: string) => existsSync(join(root, path))
  const contains = (path: string, ...needles: string[]) => needles.every(n => read(path).includes(n))
  const notContains = (path: string, ...needles: string[]) => needles.every(n => !read(path).includes(n))

  const manifest = pluginManifestSchema.parse(JSON.parse(read('.codex-plugin/plugin.json')))
  const prompts = manifest.interface?.defaultPrompt ?? []

  const removedPaths = [
    '.mcp.json',
    'api',
    'dashboard',
    'schemas/tasks.schema.json',
    'scripts/validate_tasks.py',
    'scripts/render_linear_children.py',
    'scripts/generate_insights_report.py',
    'scripts/apply_learning_candidates.py',
    'scripts/find_free_port.py',
    'scripts/record_runtime_port.py',
    'tests/test_viberig_codex_runner.py',
    'tests/test_viberig_task_engine.py',
  ]

  const checks: Check[] = [
    {
      name: 'plugin is skill-only',
      passed: !('mcpServers' in manifest) && manifest.skills === './skills/',
      evidence: '.codex-plugin/plugin.json has no mcpServers and points at ./skills/',
    },
    {
      name: 'manifest advertises Linear-native workflow',
      passed: (manifest.keywords ?? []).includes('linear') && (manifest.keywords ?? []).includes('subagents'),
      evidence: '.codex-plugin/plugin.json keywords include linear and subagents',
    },
    {
      name: 'manifest has VibeRig default prompts',
      passed: [
        'Brainstorm a VibeRig requirement',
        'Create Linear issues from this VibeRig requirement',
        'Run the next VibeRig Linear task',
        'Generate accepted-work insights',
      ].every(prompt => prompts.includes(prompt)),
      evidence: 'interface.defaultPrompt includes brainstorm, Linear issue creation, task run, and insights prompts',
    },
    {
      name: 'removed local runtime paths are absent',
      passed: removedPaths.every(path => !exists(path)),
      evidence: 'MCP file, api, dashboard, local task scripts, and old runner/task-engine tests are absent',
    },
    {
      name: 'tasks.yaml is not a repository artifact',
      passed: noMatchingFile(root, 'tasks.yaml') && noMatchingFile(root, 'tasks-yaml-template.md'),
      evidence: 'no tasks.yaml or tasks-yaml-template.md outside ignored folders',
    },
    {
      name: 'init script writes Linear-native project config',
      passed: contains(
        'scripts/init_project.py',
        'DEFAULT_DOCS_ROOT = ".vibeRig/requirements"',
        'DEFAULT_WORKTREES_ROOT = ".worktrees"',
        'DEFAULT_PR_REQUIRED = "true"',
        'linear_project_id',
        'linear_project_document_id',
        'worktrees_root: {quote_yaml(worktrees_root)}',
        'pull_request:',
        'subagents:',
      ),
      evidence: 'scripts/init_project.py writes docs root, worktrees root, PR policy, Linear ids, and subagents',
    },
    {
      name: 'project worktrees stay inside ignored .worktrees directory',
      passed: contains('.gitignore', '.worktrees/')
        && contains('skills/task-runner/SKILL.md', 'workspace.worktrees_root', '<project-root>/.worktrees/<issue-key>-<short-slug>'),
      evidence: 'task worktrees default to <project-root>/.worktrees/ and the directory is gitignored',
    },
    {
      name: 'init skill uses project.yaml plus Linear Project Document',
      passed: contains(
        'skills/init-viberig/SKILL.md',
        'Use the `linear` skill/plugin',
        '_list_teams',
        '_get_team',
        '_search',
        '_list_projects',
        '_save_project',
        '_list_documents',
        '_save_document',
        'Use both `.vibeRig/project.yaml` and the Linear Project Document',
        'partial local initialization',
      ),
      evidence: 'init-viberig requires concrete Linear project/document search and save tools',
    },
    {
      name: 'brainstorm uses staged Docs as Code',
      passed: contains(
        'skills/brainstorm/SKILL.md',
        'brief.md',
        'contract.schema.json',
        'acceptance.schema.json',
        'Adversarial Review',
        'diagrams/*.mmd',
      ),
      evidence: 'brainstorm emits brief, schemas, acceptance, adversarial review, and Mermaid diagrams',
    },
    {
      name: 'write-plan maps local contracts to Linear issues',
      passed: contains(
        'skills/write-plan/SKILL.md',
        'Linear is the task source of truth',
        'Language Policy',
        'user\'s current working language',
        'Do not translate stable IDs',
        '_list_issue_statuses',
        '_list_issue_labels',
        '_create_issue_label',
        '_list_issues',
        '_save_issue',
        '_save_comment',
        'Do not write `.vibeRig/requirements/{requirement-id}/tasks.yaml`',
      ),
      evidence: 'write-plan creates/updates Linear issues with concrete Linear tools and user-language policy',
    },
    {
      name: 'task-runner uses subagents and forbids old runners',
      passed: contains(
        'skills/task-runner/SKILL.md',
        'Every Linear task execution must declare and use a suitable subagent',
        'Default to an isolated git worktree',
        '<project-root>/.worktrees/',
        '<project-root>/.worktrees/<issue-key>-<short-slug>',
        'Worktree Policy',
        'Pull Request Policy',
        'submit the PR',
        'PR URL',
        'Linear Status Policy',
        'Human Acceptance',
        'stop before implementation and report the missing capability',
        '_get_issue',
        '_list_issues',
        '_list_comments',
        '_save_comment',
        '_save_issue',
        'Do not call `codex-cli-mcp`',
        'Do not call VibeRig dashboard/task-engine MCP tools or HTTP routes',
      ),
      evidence: 'task-runner requires subagent delegation, worktree preflight, PR submission, human acceptance boundary, and concrete Linear tools',
    },
    {
      name: 'human-acceptance is manual, merges accepted PRs, finalizes Linear, learns, and archives docs',
      passed: exists('skills/human-acceptance/SKILL.md')
        && contains(
          'skills/human-acceptance/SKILL.md',
          'Manual Trigger Only',
          'Do not use this skill automatically',
          'Git And PR Requirements',
          'merge the linked PR',
          'move the Linear issue to `Done`',
          'before running insights',
          'invoke `skill-builder`',
          'Requirement Document Archival',
          '.vibeRig/archive/requirements/',
          'Archive only docs tied to the accepted issue or requirement',
          'Do not overwrite existing archived requirement docs',
          'git worktree remove <path>',
          'Do not merge PRs for partial, rejected, blocked, or unverified acceptance',
          'Do not remove worktrees outside the configured project `.worktrees/` directory',
          '_get_issue',
          '_list_comments',
          '_list_issue_statuses',
          '_save_comment',
          '_save_issue',
          'post-acceptance insights',
        ),
      evidence: 'human-acceptance records explicit user sign-off, merges accepted PRs, writes Linear terminal status before insights, routes skill updates through skill-builder, archives accepted docs, and cleans task worktrees',
    },
    {
      name: 'blocker and insights use concrete Linear tools',
      passed: contains(
        'skills/blocker-resume/SKILL.md',
        '_list_projects',
        '_search',
        '_list_issues',
        '_get_issue',
        '_list_comments',
        '_save_comment',
        '_save_issue',
      )
        && contains(
          'skills/insights/SKILL.md',
          '_get_issue',
          '_list_comments',
          '_save_comment',
          '_save_document',
        ),
      evidence: 'blocker-resume and insights read/write Linear through concrete app tools',
    },
    {
      name: 'subagent-routing enforces boundaries',
      passed: contains(
        'skills/subagent-routing/SKILL.md',
        'Every Linear task execution must use a subagent',
        'must not update Linear or project status',
        'must not make final acceptance decisions',
      ),
      evidence: 'subagent-routing forbids Linear updates and final acceptance for subagents',
    },
    {
      name: 'proof packets stay in Linear comments',
      passed: contains(
        'skills/task-runner/SKILL.md',
        'Proof packets are Linear comments',
        'Do not duplicate the proof packet into `.vibeRig/`',
      )
        && contains('skills/insights/SKILL.md', 'Do not write proof packets into `.vibeRig/`'),
      evidence: 'task-runner and insights keep proof packets out of local long-term directories',
    },
    {
      name: 'tests cover local Linear-native initialization',
      passed: contains(
        'tests/test_init_project.py',
        'test_plugin_is_skill_only_without_viberig_mcp_server',
        'test_init_writes_linear_native_project_yaml_and_keeps_codex_config_unmanaged',
        'test_existing_project_yaml_is_migrated_with_required_sections',
      ),
      evidence: 'tests validate skill-only manifest, project.yaml output, and migration sections',
    },
    {
      name: 'old architecture references are only negative guardrails',
      passed: notContains('README.md', 'SQLite', 'codex-cli-mcp', '.vibeRig/proof')
        && notContains('README.zh-CN.md', 'SQLite', 'codex-cli-mcp', '.vibeRig/proof'),
      evidence: 'README files no longer recommend SQLite, codex-cli-mcp, or local proof directories',
    },
  ]

  return { checks, failed: checks.filter(c => !c.passed) }
}
