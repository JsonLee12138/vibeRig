# Secure OAuth client configuration

Implement `saveOAuthConfig(deps, input)` in `src/oauth-config.js`.

Contract:

- `input` contains non-empty string `tenantId`, `clientId`, `clientSecret`, and `actorId`.
- Reject invalid input with `OAuthConfigValidationError` and code `OAUTH_CONFIG_VALIDATION_ERROR` before encryption or database work.
- Preserve `clientSecret` exactly when calling `deps.encrypt`; do not trim or normalize it.
- `deps.encrypt(secret)` returns `{ ciphertext, keyVersion }`.
- Persist only `tenantId`, trimmed `clientId`, `ciphertext`, `keyVersion`, and `updatedAt`.
- Configuration persistence and audit append must execute inside one `deps.db.transaction(...)`.
- Append an audit event containing only `action`, `tenantId`, `clientId`, `actorId`, and `timestamp`.
- The audit action is `oauth_client.updated`. Audit data must not contain the secret or ciphertext.
- Return only `{ tenantId, clientId, configured: true, secretMasked: "••••", updatedAt }`.
- The return value must not expose the secret, ciphertext, or key version.
- If encryption or either transaction operation fails, reject and do not report success.
- Do not mutate `input`, log credentials, add dependencies, or add a non-transactional fallback.
