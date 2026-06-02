# Environment variables — safety rules

**Before every commit and deployment, verify these rules. No exceptions.**

## What is safe vs. what is not

| Variable | Safe to commit? | Safe in `NEXT_PUBLIC_`? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Yes | Keep out of git |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Yes | RLS controls access |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | **Never** | Bypasses RLS entirely |
| `STRIPE_SECRET_KEY` | **Never** | **Never** | Server-only |
| `STRIPE_WEBHOOK_SECRET` | **Never** | **Never** | Signing secret |

## Pre-commit check

```bash
git diff --staged | grep -iE "(service_role|supabase_service|sbp_|eyJhbGci|sk_test_|sk_live_|whsec_)"
```
If this returns output: stop, unstage, move to `.env.local`.

## Rules

- **`.env.local` is the only place real values live.** Never rename to `.env` or `.env.development`.
- **`.env.example` is the committed template.** Placeholder values only.
- **Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_`** — it's inlined into the browser bundle.
- **Set secrets in Vercel** → Project → Settings → Environment Variables. Mark as server-only.
- **If a secret is accidentally committed**: rotate it immediately. Git history rewrite doesn't help.
