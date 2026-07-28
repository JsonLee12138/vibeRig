export class OAuthConfigValidationError extends Error {
  constructor(message = 'invalid OAuth configuration') {
    super(message);
    this.name = 'OAuthConfigValidationError';
    this.code = 'OAUTH_CONFIG_VALIDATION_ERROR';
  }
}

export async function saveOAuthConfig(deps, input) {
  const encrypted = await deps.encrypt(input.clientSecret);
  const saved = {
    ...input,
    ...encrypted,
    updatedAt: new Date().toISOString(),
  };
  await deps.db.config.upsert(saved);
  await deps.db.audit.append(saved);
  return saved;
}
