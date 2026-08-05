export const PLANE_MCP_SERVER_NAME = 'vb-plane';
export const PLANE_MCP_PACKAGE = 'plane-mcp-server==0.2.9';
export const PLANE_MCP_ENVIRONMENT_VARIABLES = [
  'PLANE_BASE_URL',
  'PLANE_WORKSPACE_SLUG',
  'PLANE_API_KEY',
] as const;

export const PLANE_MCP_BOOTSTRAP_READ_TOOLS = [
  'list_projects',
] as const;

export const PLANE_MCP_BOOTSTRAP_WRITE_TOOLS = [
  'create_project',
] as const;

export const PLANE_MCP_READ_TOOLS = [
  'retrieve_project',
  'list_work_items',
  'retrieve_work_item',
  'list_cycles',
  'list_modules',
  'list_milestones',
  'list_states',
  'list_labels',
  'list_work_item_comments',
  'retrieve_work_item_comment',
] as const;

export const PLANE_MCP_WRITE_TOOLS = [
  'create_work_item',
  'update_work_item',
  'create_work_item_comment',
  'update_work_item_comment',
  'create_milestone',
  'update_milestone',
  'add_work_items_to_milestone',
] as const;

type PlaneMcpReadTool = typeof PLANE_MCP_READ_TOOLS[number];
type PlaneMcpWriteTool = typeof PLANE_MCP_WRITE_TOOLS[number];
type PlaneMcpBootstrapReadTool = typeof PLANE_MCP_BOOTSTRAP_READ_TOOLS[number];
type PlaneMcpBootstrapWriteTool = typeof PLANE_MCP_BOOTSTRAP_WRITE_TOOLS[number];
export type PlaneMcpTool
  = | PlaneMcpReadTool
    | PlaneMcpWriteTool
    | PlaneMcpBootstrapReadTool
    | PlaneMcpBootstrapWriteTool;

export interface PlaneMcpPolicyConfig {
  enabled: boolean;
  writes_enabled: boolean;
  allow_headless_writes: boolean;
  project_id: string;
}

export interface PlaneMcpServerConfig {
  command: 'uvx';
  args: [string, 'stdio'];
  env: Record<string, string>;
  lifecycle: 'lazy';
  requestTimeoutMs: number;
  directTools: false;
  exposeResources: false;
  includeTools: string[];
}

export interface BuiltInPlaneMcpConfig {
  settings: {
    toolPrefix: 'server';
    hostConfigDiscovery: 'off';
  };
  mcpServers: Record<typeof PLANE_MCP_SERVER_NAME, PlaneMcpServerConfig>;
}

export interface PlaneMcpToolCallResult {
  matched: boolean;
  write: boolean;
  bootstrap: boolean;
  upstreamTool?: PlaneMcpTool;
  blockReason?: string;
}

const readTools = new Set<string>(PLANE_MCP_READ_TOOLS);
const writeTools = new Set<string>(PLANE_MCP_WRITE_TOOLS);
const bootstrapReadTools = new Set<string>(PLANE_MCP_BOOTSTRAP_READ_TOOLS);
const bootstrapWriteTools = new Set<string>(PLANE_MCP_BOOTSTRAP_WRITE_TOOLS);
const projectTools = new Set<string>([...PLANE_MCP_READ_TOOLS, ...PLANE_MCP_WRITE_TOOLS]);
const bootstrapTools = new Set<string>([
  ...PLANE_MCP_BOOTSTRAP_READ_TOOLS,
  ...PLANE_MCP_BOOTSTRAP_WRITE_TOOLS,
]);
const allTools = new Set<string>([...projectTools, ...bootstrapTools]);
const projectIdTools = new Set<string>(projectTools);
export const PLANE_MCP_ALL_TOOLS = [
  ...PLANE_MCP_BOOTSTRAP_READ_TOOLS,
  ...PLANE_MCP_BOOTSTRAP_WRITE_TOOLS,
  ...PLANE_MCP_READ_TOOLS,
  ...PLANE_MCP_WRITE_TOOLS,
] as const;

function envReference(name: typeof PLANE_MCP_ENVIRONMENT_VARIABLES[number]): string {
  return `\${${name}}`;
}

function serverPrefix(serverName: string): string {
  return serverName.replace(/-/g, '_');
}

function originalToolName(serverName: string, input: Record<string, unknown>): string | null {
  if (typeof input.tool !== 'string')
    return null;

  const tool = input.tool.replace(/-/g, '_');
  const prefix = serverPrefix(serverName);
  const serverSelected = input.server === serverName;
  const prefixes = [`${prefix}_`, `mcp__${prefix}_`];

  for (const candidate of prefixes) {
    if (tool.startsWith(candidate))
      return tool.slice(candidate.length);
  }
  return serverSelected ? tool : null;
}

function parseArgs(input: Record<string, unknown>): {
  args: Record<string, unknown>;
  serialized: boolean;
  error?: string;
} {
  if (input.args === undefined || input.args === '')
    return { args: {}, serialized: false };
  if (typeof input.args === 'string') {
    try {
      const parsed = JSON.parse(input.args) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return { args: {}, serialized: true, error: 'Plane MCP args must be a JSON object' };
      return { args: parsed as Record<string, unknown>, serialized: true };
    }
    catch {
      return { args: {}, serialized: true, error: 'Plane MCP args contain invalid JSON' };
    }
  }
  if (input.args && typeof input.args === 'object' && !Array.isArray(input.args))
    return { args: input.args as Record<string, unknown>, serialized: false };
  return { args: {}, serialized: false, error: 'Plane MCP args must be an object' };
}

export function planeMcpTools(writesEnabled: boolean, projectBound = true): string[] {
  if (!projectBound)
    return [...PLANE_MCP_BOOTSTRAP_READ_TOOLS, ...PLANE_MCP_BOOTSTRAP_WRITE_TOOLS];
  return writesEnabled
    ? [...PLANE_MCP_READ_TOOLS, ...PLANE_MCP_WRITE_TOOLS]
    : [...PLANE_MCP_READ_TOOLS];
}

export function createBuiltInPlaneMcpServer(): PlaneMcpServerConfig {
  return {
    command: 'uvx',
    args: [PLANE_MCP_PACKAGE, 'stdio'],
    env: {
      PLANE_BASE_URL: envReference('PLANE_BASE_URL'),
      PLANE_API_KEY: envReference('PLANE_API_KEY'),
      PLANE_WORKSPACE_SLUG: envReference('PLANE_WORKSPACE_SLUG'),
    },
    lifecycle: 'lazy',
    requestTimeoutMs: 30_000,
    directTools: false,
    exposeResources: false,
    includeTools: [...PLANE_MCP_ALL_TOOLS],
  };
}

export function createBuiltInPlaneMcpConfig(): BuiltInPlaneMcpConfig {
  return {
    settings: {
      toolPrefix: 'server',
      hostConfigDiscovery: 'off',
    },
    mcpServers: {
      [PLANE_MCP_SERVER_NAME]: createBuiltInPlaneMcpServer(),
    },
  };
}

export function enforcePlaneMcpToolCall(
  config: PlaneMcpPolicyConfig,
  input: Record<string, unknown>,
): PlaneMcpToolCallResult {
  const upstreamTool = originalToolName(PLANE_MCP_SERVER_NAME, input);
  if (!upstreamTool)
    return { matched: false, write: false, bootstrap: false };

  if (!config.enabled) {
    return {
      matched: true,
      write: false,
      bootstrap: false,
      blockReason: 'Plane MCP is disabled in .pi/viberig.yaml',
    };
  }
  if (!allTools.has(upstreamTool)) {
    return {
      matched: true,
      write: false,
      bootstrap: false,
      blockReason: `Plane MCP tool is outside the VibeRig allowlist: ${upstreamTool}`,
    };
  }

  const bootstrap = bootstrapTools.has(upstreamTool);
  if (bootstrap && config.project_id) {
    return {
      matched: true,
      write: bootstrapWriteTools.has(upstreamTool),
      bootstrap,
      upstreamTool: upstreamTool as PlaneMcpTool,
      blockReason: 'Plane project bootstrap tools are disabled after project binding',
    };
  }
  if (!bootstrap && !config.project_id) {
    return {
      matched: true,
      write: writeTools.has(upstreamTool),
      bootstrap,
      upstreamTool: upstreamTool as PlaneMcpTool,
      blockReason: 'Plane project discovery must complete before project-scoped tools can run',
    };
  }

  if (bootstrap) {
    const write = bootstrapWriteTools.has(upstreamTool);
    const parsed = parseArgs(input);
    if (parsed.error) {
      return {
        matched: true,
        write,
        bootstrap,
        upstreamTool: upstreamTool as PlaneMcpTool,
        blockReason: parsed.error,
      };
    }
    if (bootstrapReadTools.has(upstreamTool)) {
      return {
        matched: true,
        write,
        bootstrap,
        upstreamTool: upstreamTool as PlaneMcpTool,
      };
    }
    parsed.args.page_view = false;
    input.args = parsed.serialized ? JSON.stringify(parsed.args) : parsed.args;
    return {
      matched: true,
      write,
      bootstrap,
      upstreamTool: upstreamTool as PlaneMcpTool,
    };
  }

  const write = writeTools.has(upstreamTool);
  if (write && !config.writes_enabled) {
    return {
      matched: true,
      write,
      bootstrap,
      upstreamTool: upstreamTool as PlaneMcpTool,
      blockReason: 'Plane writes are disabled in .pi/viberig.yaml',
    };
  }
  if (!write && !readTools.has(upstreamTool)) {
    return {
      matched: true,
      write,
      bootstrap,
      blockReason: `Plane MCP tool is not enabled: ${upstreamTool}`,
    };
  }

  const parsed = parseArgs(input);
  if (parsed.error) {
    return {
      matched: true,
      write,
      bootstrap,
      upstreamTool: upstreamTool as PlaneMcpTool,
      blockReason: parsed.error,
    };
  }

  if (projectIdTools.has(upstreamTool)) {
    if (!config.project_id) {
      return {
        matched: true,
        write,
        bootstrap,
        upstreamTool: upstreamTool as PlaneMcpTool,
        blockReason: 'plane.project_id is required before calling Plane MCP',
      };
    }
    if (parsed.args.project_id !== undefined && parsed.args.project_id !== config.project_id) {
      return {
        matched: true,
        write,
        bootstrap,
        upstreamTool: upstreamTool as PlaneMcpTool,
        blockReason: 'Plane MCP project_id does not match the project-bound VibeRig configuration',
      };
    }
    parsed.args.project_id = config.project_id;
    input.args = parsed.serialized ? JSON.stringify(parsed.args) : parsed.args;
  }

  return {
    matched: true,
    write,
    bootstrap,
    upstreamTool: upstreamTool as PlaneMcpTool,
  };
}
