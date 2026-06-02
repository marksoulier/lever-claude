# Data fetching rules

Apply to every `fetch` call and `useEffect` that loads data.

## fetch — handle all four failure modes

```ts
async function load() {
  try {
    const response = await fetch("/api/something");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);  // fetch does NOT throw for 4xx/5xx
    const data = await response.json();
    return data;
  } catch (err) {
    throw err;  // surface visibly — never swallow
  }
}
```

| Case | Required handling |
|---|---|
| Network failure | `try/catch` around the whole block |
| Bad status (4xx/5xx) | Check `response.ok` and throw |
| Malformed JSON | Covered by outer `try/catch` |
| Component unmounts | Cancelled flag (see below) |

## Loading states — always handle the gap

Every fetching section must handle three moments:

| Moment | What to render |
|---|---|
| Loading | Skeleton matching real content shape |
| Error | Visible error box — never console-only |
| Data | Real content |

Skeleton: `bg-zinc-100` placeholder blocks, match height/layout of real content. No spinners for list content.

Never: render nothing while loading, use loading state to gate the whole page return.

## useEffect — dependency arrays and cleanup

```ts
useEffect(() => { load(); }, []);           // ✓ run once
useEffect(() => { load(planId); }, [planId]); // ✓ run when planId changes
useEffect(() => { load(); });               // ✗ no array — infinite loop
```

## useEffect — cancel stale requests

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!cancelled) setData(data);
    } catch (err) {
      if (!cancelled) setError((err as Error).message);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  load();
  return () => { cancelled = true; };
}, []);
```
