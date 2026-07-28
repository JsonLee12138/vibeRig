export interface ProjectYamlOptions {
  projectName: string;
  outputLanguage?: string;
}

const quoteYaml = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

export function projectYaml({ projectName, outputLanguage = 'zh-CN' }: ProjectYamlOptions) {
  return `version: 1
project:
  name: ${quoteYaml(projectName)}
  root: "."
  repo_url: ""
docs:
  root: ".vibeRig/requirements"
output:
  language: ${quoteYaml(outputLanguage)}
pull_request:
  required: "true"
  provider: "auto"
  base_branch: ""
  draft: "false"
linear:
  team_id: ""
  project_id: ""
  project_document_id: ""
  project_document_title: "VibeRig Project Registration"
gate_policy:
  ci_required: "project_decides"
  required_commands: []
  manual_checks: []
subagents:
  default_research: "researcher"
  default_qa: "qa"
  default_security_audit: "security_auditor"
  default_review: "code_review"
`;
}
