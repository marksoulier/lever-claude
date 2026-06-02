# Supabase — database operations

Claude Code connects to Supabase via MCP tools. **Do not run bare SQL in bash.** Use the tools below.

## Which tool to use

| Task | Tool |
|---|---|
| Create or alter tables/indexes | `mcp__supabase__apply_migration` (DDL — recorded) |
| Query or mutate data | `mcp__supabase__execute_sql` (ad-hoc — not recorded) |
| See all tables and columns | `mcp__supabase__list_tables` (pass `verbose: true`) |
| See migration history | `mcp__supabase__list_migrations` |
| Security + perf warnings | `mcp__supabase__get_advisors` — run after every schema change |
| Runtime logs | `mcp__supabase__get_logs` |
| Generate TypeScript types | `mcp__supabase__generate_typescript_types` |

## snake_case ↔ camelCase convention

Postgres uses snake_case; JavaScript uses camelCase. Translate at the boundary, once, using `planFromRow()` in `lib/supabase/mappers.ts`. Everything inside the app uses camelCase.

```
Supabase row        │  planFromRow()          │  App
────────────────────────────────────────────────────
target_balance      │  → targetBalance        │
success_probability │  → successProbability   │
```

When adding a column to `plans`:
1. Add to `DbPlanRow` in `lib/supabase/mappers.ts`
2. Add mapping line in `planFromRow()`
3. Add to `Plan` type in `lib/store.ts` if the app needs it

## Common commands

```
# Inspect schema
mcp__supabase__list_tables  schemas=["public"]  verbose=true

# Read data
mcp__supabase__execute_sql  query="select * from plans limit 5"

# Check RLS policies
mcp__supabase__execute_sql  query="select * from pg_policies where tablename = 'plans'"

# List users
mcp__supabase__execute_sql  query="select id, email, created_at from auth.users limit 20"

# Apply schema change (always use apply_migration for DDL, never execute_sql)
mcp__supabase__apply_migration  name="add_notes_to_plans"  query="alter table plans add column notes text"

# Regenerate TypeScript types
mcp__supabase__generate_typescript_types
```

## Connection config

Declared in `.mcp.json`:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=avzhlaxhopzmrjnmregc",
      "headers": { "Authorization": "Bearer <your-pat>" }
    }
  }
}
```

**Security:** the Bearer token grants access to all Supabase projects under the account. Never commit it. Keep in `~/.claude/mcp.json` (user-level), not in the project `.mcp.json`.

**VSCode note:** `mcp__supabase__*` tools don't load in VSCode extension sessions. Use the Supabase Management REST API as fallback: `POST https://api.supabase.com/v1/projects/avzhlaxhopzmrjnmregc/database/query` with the PAT.
