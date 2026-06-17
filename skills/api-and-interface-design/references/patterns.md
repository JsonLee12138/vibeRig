# API & Interface Patterns

Reference patterns for REST APIs, TypeScript contracts, and common interface design decisions.

## REST Resource Design

```
GET    /api/tasks              → List tasks (query params for filtering/pagination)
POST   /api/tasks              → Create a task
GET    /api/tasks/:id          → Get a single task
PATCH  /api/tasks/:id          → Update a task (partial)
DELETE /api/tasks/:id          → Delete a task (idempotent)

GET    /api/tasks/:id/comments → Sub-resource list
POST   /api/tasks/:id/comments → Add to sub-resource
```

**Rules**: plural nouns, no verbs, nested sub-resources for owned collections.

## Pagination

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response shape
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

Always add pagination from the start — retrofitting it is a breaking change.

## Filtering

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

Use query parameters for filters; keep filter names matching field names.

## Partial Updates (PATCH)

Accept partial objects — only update provided fields:

```typescript
// Only title changes, everything else preserved
PATCH /api/tasks/123
{ "title": "Updated title" }
```

Prefer PATCH over PUT. PUT requires the full object and forces clients to fetch before updating.

## Consistent Error Shape

One error format across all endpoints:

```typescript
interface APIError {
  error: {
    code: string;      // Machine-readable: "VALIDATION_ERROR"
    message: string;   // Human-readable: "Email is required"
    details?: unknown; // Additional context when helpful
  };
}
```

HTTP status mapping:
| Code | Meaning |
|------|---------|
| 400 | Client sent invalid data |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate, version mismatch) |
| 422 | Validation failed (semantically invalid) |
| 500 | Server error — never expose internal details |

## Boundary Validation Example

```typescript
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }
  // Internal code trusts types after this point
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

Validation belongs at: API route handlers, form submission handlers, external service response parsing, env var loading.

Validation does NOT belong at: internal function calls, utility functions called by already-validated code, data from your own database.

## TypeScript: Contract First

```typescript
interface TaskAPI {
  createTask(input: CreateTaskInput): Promise<Task>;
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;
  getTask(id: string): Promise<Task>;           // throws NotFoundError
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;        // idempotent
}
```

## TypeScript: Input/Output Separation

```typescript
// Input: what the caller provides
interface CreateTaskInput {
  title: string;
  description?: string;
}

// Output: what the system returns (includes server-generated fields)
interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

## TypeScript: Discriminated Unions for Variants

```typescript
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };
```

Consumers get type narrowing — no runtime `if status === 'x'` without exhaustive checking.

## TypeScript: Branded IDs

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };

function getTask(id: TaskId): Promise<Task> { ... }
// Compiler prevents: getTask(userId) — catches category errors at compile time
```

## Prefer Addition Over Modification

```typescript
// Good: add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high'; // added later, optional
}

// Bad: change field types or remove fields — breaks existing consumers
```

## Naming Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| REST endpoints | Plural nouns, no verbs | `GET /api/tasks` |
| Query params | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response fields | camelCase | `{ createdAt, taskId }` |
| Boolean fields | is/has/can prefix | `isComplete`, `hasAttachments` |
| Enum values | UPPER_SNAKE | `"IN_PROGRESS"`, `"COMPLETED"` |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document the API later" | The types ARE the documentation. Define them first. |
| "We don't need pagination for now" | Add it from the start — retrofitting is a breaking change. |
| "PATCH is complicated, let's just use PUT" | PUT requires the full object. PATCH is what clients actually want. |
| "Nobody uses that undocumented behavior" | Hyrum's Law: if it's observable, somebody depends on it. |
| "Internal APIs don't need contracts" | Internal consumers are still consumers. Contracts prevent coupling. |
