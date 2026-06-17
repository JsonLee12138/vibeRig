# Testing Patterns Reference

## The Prove-It Pattern — Bug Fix Example

```typescript
// Bug report: "Completing a task doesn't update completedAt"

// Step 1: Write the reproduction test (it should FAIL)
it('sets completedAt when task is completed', async () => {
  const task = await taskService.createTask({ title: 'Test' });
  const completed = await taskService.completeTask(task.id);

  expect(completed.status).toBe('completed');
  expect(completed.completedAt).toBeInstanceOf(Date);  // FAILS → bug confirmed
});

// Step 2: Fix the bug
export async function completeTask(id: string): Promise<Task> {
  return db.tasks.update(id, {
    status: 'completed',
    completedAt: new Date(),  // was missing
  });
}

// Step 3: Test passes → bug fixed, regression guarded
```

## TDD Cycle Example

```typescript
// RED: This test fails because createTask doesn't exist yet
it('creates a task with title and default status', async () => {
  const task = await taskService.createTask({ title: 'Buy groceries' });
  expect(task.id).toBeDefined();
  expect(task.title).toBe('Buy groceries');
  expect(task.status).toBe('pending');
  expect(task.createdAt).toBeInstanceOf(Date);
});

// GREEN: Minimal implementation
export async function createTask(input: { title: string }): Promise<Task> {
  const task = {
    id: generateId(),
    title: input.title,
    status: 'pending' as const,
    createdAt: new Date(),
  };
  await db.tasks.insert(task);
  return task;
}

// REFACTOR: Now extract helpers, improve naming, etc. while tests stay green.
```

## Test State, Not Interactions

```typescript
// Good: Tests what the function does (state-based)
it('returns tasks sorted by creation date, newest first', async () => {
  const tasks = await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tasks[0].createdAt.getTime())
    .toBeGreaterThan(tasks[1].createdAt.getTime());
});

// Bad: Tests how the function works internally (interaction-based)
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC')
  );
});
```

## Arrange-Act-Assert

```typescript
it('marks overdue tasks when deadline has passed', () => {
  // Arrange
  const task = createTask({ title: 'Test', deadline: new Date('2025-01-01') });
  // Act
  const result = checkOverdue(task, new Date('2025-01-02'));
  // Assert
  expect(result.isOverdue).toBe(true);
});
```

## Test Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Testing implementation details | Breaks on refactor even if behavior is unchanged | Test inputs and outputs |
| Flaky tests (timing, order-dependent) | Erodes trust in the suite | Use deterministic assertions, isolate test state |
| Mocking everything | Tests pass but production breaks | Prefer real > fake > stub > mock |
| No test isolation | Tests pass individually but fail together | Each test sets up and tears down its own state |
| Large snapshots | Nobody reviews them; break on any change | Snapshots sparingly; review every change |

## Mock Preference Order

```
1. Real implementation  → Highest confidence, catches real bugs
2. Fake (in-memory)     → Fast, deterministic substitute (e.g., fake DB)
3. Stub                 → Returns canned data, no behavior
4. Mock (interaction)   → Verifies method calls — use sparingly, only at true external boundaries
```

Use mocks only when the real implementation is too slow, non-deterministic, or has side effects you can't control (external APIs, email sending, payment processors).
