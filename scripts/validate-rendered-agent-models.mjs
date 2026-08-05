import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function frontmatterModel(content) {
  return content.match(/^model:\s*(\S+)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, '') || null;
}

export function validateRenderedAgentModels({ root, agents, platforms, manifest }) {
  const errors = [];
  const codexModels = manifest.platformModelDefaults?.codex || {};
  const codexSlugs = new Set(Object.values(codexModels));

  for (const name of agents) {
    if (!(name in codexModels)) {
      errors.push(`${name}: missing manifest Codex model`);
      continue;
    }

    if (platforms.includes('codex')) {
      const path = resolve(root, `.codex/agents/${name}.toml`);
      if (!existsSync(path)) {
        errors.push(`${name}: missing Codex file`);
      }
      else {
        const content = readFileSync(path, 'utf8');
        const model = content.match(/^model\s*=\s*["']([^"']+)["']/m)?.[1] || null;
        if (model !== codexModels[name])
          errors.push(`${name}: Codex model ${model || '<inherit>'}, expected ${codexModels[name]}`);
      }
    }

    for (const platform of ['claude', 'cursor']) {
      if (!platforms.includes(platform))
        continue;
      const path = resolve(root, `.${platform}/agents/${name}.md`);
      if (!existsSync(path)) {
        errors.push(`${name}: missing ${platform} file`);
        continue;
      }
      const content = readFileSync(path, 'utf8');
      const model = frontmatterModel(content);
      if (model !== 'inherit')
        errors.push(`${name}: ${platform} model ${model || '<missing>'}, expected inherit`);
      for (const slug of codexSlugs) {
        if (content.includes(slug))
          errors.push(`${name}: Codex model slug leaked into ${platform}`);
      }
    }
  }

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targetRoot = resolve(valueAfter('--root') || process.cwd());
  const agents = (valueAfter('--agents') || '').split(',').filter(Boolean);
  const platforms = (valueAfter('--platforms') || 'codex,claude,cursor').split(',').filter(Boolean);
  const manifestPath = resolve(valueAfter('--manifest') || resolve(repositoryRoot, 'skills/built-in-agents/agents.manifest.json'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (agents.length === 0)
    throw new Error('--agents requires a comma-separated selected Agent list');
  const errors = validateRenderedAgentModels({ root: targetRoot, agents, platforms, manifest });
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`rendered Agent model validation passed (${agents.length} agents; ${platforms.join(', ')})`);
}
