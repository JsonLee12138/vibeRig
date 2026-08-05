import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = await mkdtemp(join(tmpdir(), 'viberig-pi-agent-dir-'));

try {
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.pi.skills, [
    './skills/vb-init',
    './skills/vb-company',
    './skills/vb-wiki',
  ]);
  assert.ok(
    !manifest.pi.extensions.some(extension => extension.includes('pi-mcp-adapter')),
    'pi-mcp-adapter must be owned by the VibeRig company extension, not loaded separately',
  );
  const skillDirectories = (await readdir(resolve(root, 'skills'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  assert.ok(skillDirectories.length > 0, 'No Pi skills were packaged');
  assert.ok(
    skillDirectories.every(name => name.startsWith('vb-')),
    `Only vb-* skills are allowed on the Pi branch: ${skillDirectories.join(', ')}`,
  );

  const child = spawn('pi', [
    '--mode',
    'rpc',
    '--no-session',
    '--offline',
    '--approve',
    '--no-context-files',
  ], {
    cwd: root,
    env: {
      ...process.env,
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  child.stdin.write('{"id":"commands","type":"get_commands"}\n');

  const response = await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Pi RPC package load timed out\n${stderr}`));
    }, 20_000);

    const poll = setInterval(() => {
      const lines = stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'response' && event.id === 'commands') {
            clearTimeout(timeout);
            clearInterval(poll);
            resolvePromise(event);
            return;
          }
        }
        catch {
          // Wait for the current JSONL record to complete.
        }
      }
    }, 25);

    child.once('exit', (code) => {
      clearTimeout(timeout);
      clearInterval(poll);
      reject(new Error(`Pi RPC exited before responding (${code})\n${stderr}`));
    });
  });

  child.kill('SIGTERM');
  assert.equal(response.success, true);
  const names = response.data.commands.map(command => command.name);
  assert.ok(names.includes('vb-company'), 'VibeRig extension command was not loaded');
  assert.ok(names.includes('mcp'), 'pi-mcp-adapter extension command was not loaded');
  assert.ok(names.includes('agents'), 'tintinweb pi-subagents extension was not loaded');
  assert.ok(names.includes('skill:vb-company'), 'VibeRig package skills were not loaded');
  assert.ok(names.includes('skill:vb-init'), 'VibeRig init skill was not loaded');
  assert.ok(names.includes('skill:vb-wiki'), 'VibeRig wiki skill was not loaded');
  assert.doesNotMatch(stderr, /extension.*error|failed to load/i);
  console.log('pi package load validation passed (VibeRig, Plane MCP adapter, tintinweb subagents, package skills)');
}
finally {
  await rm(agentDir, { recursive: true, force: true });
}
