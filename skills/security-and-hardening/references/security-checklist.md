# Security Checklist Reference

## OWASP Prevention — Code Examples

### Injection (SQL)

```typescript
// BAD: SQL injection via string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// GOOD: ORM with typed input
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### Broken Authentication

```typescript
import { hash, compare } from 'bcrypt';
const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));
```

### XSS

```typescript
// BAD
element.innerHTML = userInput;

// GOOD: React auto-escapes by default
return <div>{userInput}</div>;

// When you must render HTML
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### Access Control

```typescript
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  }
  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

### SSRF Prevention

```typescript
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_HOSTS = new Set(['hooks.example.com']);

async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.some((a) => ipaddr.parse(a.address).range() !== 'unicast')) {
    throw new Error('private/reserved IP');
  }
  return url;
}

await fetch(await assertSafeUrl(req.body.webhookUrl), { redirect: 'error' });
```

### Schema Validation at Boundaries

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', details: result.error.flatten() },
    });
  }
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
```

## Security Review Checklist

### Authentication
- [ ] Passwords hashed with bcrypt/scrypt/argon2 (salt rounds ≥ 12)
- [ ] Session tokens are httpOnly, secure, sameSite
- [ ] Login has rate limiting (≤10 attempts per 15 min)
- [ ] Password reset tokens expire

### Authorization
- [ ] Every endpoint checks user permissions (ownership, not just auth)
- [ ] Admin actions require admin role verification

### Input
- [ ] All user input validated at the boundary (schema validation)
- [ ] SQL queries are parameterized
- [ ] HTML output is encoded/escaped
- [ ] Server-side URL fetches allowlisted (no SSRF to internal services)

### Data
- [ ] No secrets in code or version control
- [ ] Sensitive fields excluded from API responses
- [ ] PII encrypted at rest (if applicable)

### Infrastructure
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] CORS restricted to known origins
- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] Error messages don't expose internals

### Supply Chain
- [ ] Lockfile committed; CI installs with `pnpm install --frozen-lockfile`
- [ ] New dependencies reviewed (maintenance, download count, postinstall scripts, typosquats)

### AI / LLM (if used)
- [ ] Model output treated as untrusted (no eval/SQL/innerHTML/shell)
- [ ] Secrets and other users' data kept out of prompts
- [ ] Tool/agent permissions scoped; destructive actions require confirmation
- [ ] Token and request rate limits in place
- [ ] RAG embeddings partitioned per tenant (if multi-tenant)
