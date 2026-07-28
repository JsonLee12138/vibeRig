import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = await mkdtemp(join(tmpdir(), 'viberig-pi-agent-dir-'));

try {
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
  assert.ok(names.includes('viberig-company'), 'VibeRig extension command was not loaded');
  assert.ok(names.includes('agents'), 'tintinweb pi-subagents extension was not loaded');
  assert.ok(names.includes('skill:viberig-company'), 'VibeRig package skills were not loaded');
  assert.doesNotMatch(stderr, /extension.*error|failed to load/i);
  console.log('pi package load validation passed (VibeRig extension, tintinweb subagents, package skills)');
}
finally {
  await rm(agentDir, { recursive: true, force: true });
}
