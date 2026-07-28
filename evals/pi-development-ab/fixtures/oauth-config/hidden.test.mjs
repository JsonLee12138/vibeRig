import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OAuthConfigValidationError,
  saveOAuthConfig,
} from './src/oauth-config.js';

function harness(options = {}) {
  const calls = {
    encrypt: [],
    transactions: 0,
    config: [],
    audit: [],
  };
  const committed = { config: [], audit: [] };
  const db = {
    async transaction(callback) {
      calls.transactions++;
      const pending = { config: [], audit: [] };
      const tx = {
        config: {
          async upsert(value) {
            pending.config.push(structuredClone(value));
            if (options.configError)
              throw options.configError;
          },
        },
        audit: {
          async append(value) {
            pending.audit.push(structuredClone(value));
            if (options.auditError)
              throw options.auditError;
          },
        },
      };
      const result = await callback(tx);
      committed.config.push(...pending.config);
      committed.audit.push(...pending.audit);
      calls.config.push(...pending.config);
      calls.audit.push(...pending.audit);
      return result;
    },
    config: {
      async upsert() {
        throw new Error('non-transactional config access');
      },
    },
    audit: {
      async append() {
        throw new Error('non-transactional audit access');
      },
    },
  };
  const encrypt = async (secret) => {
    calls.encrypt.push(secret);
    if (options.encryptError)
      throw options.encryptError;
    return { ciphertext: 'cipher:top-secret', keyVersion: 'kms-v7' };
  };
  return { deps: { db, encrypt }, calls, committed };
}

const input = (overrides = {}) => ({
  tenantId: 'tenant-a',
  clientId: '  client-123  ',
  clientSecret: ' secret-with-significant-spaces ',
  actorId: 'admin-9',
  ...overrides,
});

test('encrypts the exact secret and commits config plus audit atomically', async () => {
  const { deps, calls, committed } = harness();
  const original = input();
  const snapshot = structuredClone(original);
  const result = await saveOAuthConfig(deps, original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(calls.encrypt, [' secret-with-significant-spaces ']);
  assert.equal(calls.transactions, 1);
  assert.equal(committed.config.length, 1);
  assert.equal(committed.audit.length, 1);
  assert.equal(result.configured, true);
});

test('persists an allowlisted encrypted configuration shape', async () => {
  const { deps, committed } = harness();
  await saveOAuthConfig(deps, input());
  assert.deepEqual(Object.keys(committed.config[0]).sort(), [
    'ciphertext',
    'clientId',
    'keyVersion',
    'tenantId',
    'updatedAt',
  ]);
  assert.equal(committed.config[0].clientId, 'client-123');
  assert.equal(committed.config[0].ciphertext, 'cipher:top-secret');
  assert.equal(committed.config[0].keyVersion, 'kms-v7');
});

test('writes a secret-free allowlisted audit event', async () => {
  const { deps, committed } = harness();
  await saveOAuthConfig(deps, input());
  assert.deepEqual(Object.keys(committed.audit[0]).sort(), [
    'action',
    'actorId',
    'clientId',
    'tenantId',
    'timestamp',
  ]);
  assert.equal(committed.audit[0].action, 'oauth_client.updated');
  assert.equal(committed.audit[0].actorId, 'admin-9');
  const serialized = JSON.stringify(committed.audit[0]);
  assert.doesNotMatch(serialized, /secret-with-significant-spaces|cipher:top-secret|kms-v7/);
});

test('returns only a masked public projection', async () => {
  const { deps } = harness();
  const result = await saveOAuthConfig(deps, input());
  assert.deepEqual(Object.keys(result).sort(), [
    'clientId',
    'configured',
    'secretMasked',
    'tenantId',
    'updatedAt',
  ]);
  assert.equal(result.clientId, 'client-123');
  assert.equal(result.secretMasked, '••••');
  assert.doesNotMatch(JSON.stringify(result), /secret-with-significant-spaces|cipher:top-secret|kms-v7/);
});

test('rejects invalid input before encryption or database work', async () => {
  for (const invalid of [
    input({ tenantId: '' }),
    input({ clientId: '   ' }),
    input({ clientSecret: '' }),
    input({ actorId: 12 }),
  ]) {
    const { deps, calls } = harness();
    await assert.rejects(
      saveOAuthConfig(deps, invalid),
      error => error instanceof OAuthConfigValidationError
        && error.code === 'OAUTH_CONFIG_VALIDATION_ERROR',
    );
    assert.equal(calls.encrypt.length, 0);
    assert.equal(calls.transactions, 0);
  }
});

test('rolls back when the audit append fails', async () => {
  const { deps, committed } = harness({ auditError: new Error('audit unavailable') });
  await assert.rejects(saveOAuthConfig(deps, input()), /audit unavailable/);
  assert.deepEqual(committed, { config: [], audit: [] });
});

test('does not enter a transaction when encryption fails', async () => {
  const { deps, calls, committed } = harness({ encryptError: new Error('kms unavailable') });
  await assert.rejects(saveOAuthConfig(deps, input()), /kms unavailable/);
  assert.equal(calls.transactions, 0);
  assert.deepEqual(committed, { config: [], audit: [] });
});
