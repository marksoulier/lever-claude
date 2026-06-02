# Lever — Agent Instructions

## Test accounts

| Email | Password | Role |
|---|---|---|
| `demo@lever.dev` | `demo1234` | Standard |
| `admin@lever.dev` | `admin1234` | Admin |

Phone testing: always use `demo@lever.dev` / `demo1234` (Google OAuth unreliable in Expo Go).

---

## Session direction

At the start of every session: run the startup checklist from `docs/STARTUP.md`, then the business health snapshot — Supabase user activity, Stripe revenue, UserJot feedback. Read `docs/PROGRESS.md` for the priority order.

**Pick the next task yourself.** Propose the single highest-leverage item with a one-sentence rationale. Do not wait for the user to choose.

---

## Work style

The user moves fast and values momentum over process. Match that energy.

### Decisions and questions
- **Select-then-go** — Finish a task then reccomend what should be tackled next.
- **Ask design questions** when requirements aren't fully defined — don't guess at intent and build the wrong thing.
- **"Go" / "yep" / "yes" / "do it" / "continue"** — proceed with the top/recommended option immediately. No confirmation needed.
- **Mid-task decisions** — if two valid approaches exist, stop and present them via `AskUserQuestion`. Don't pick silently.
- **Verify before big implementation** — confirm the approach for anything that touches multiple files or takes more than 10 minutes. Small fixes: just do them.

### Priorities
- Real user feedback beats synthetic personas. When a real user reports a bug or friction point, it jumps the queue.
- Fix P0 bugs before any new features. Check `docs/BUGS.md` before proposing next steps.
- Read `docs/PROGRESS.md` every session — it documents what was built, why, and what comes next. Do not repeat decisions that are already made.

### Documentation
- Update `docs/BUGS.md` when fixing a bug: mark it Fixed with the root cause and what changed.
- Update `docs/PROGRESS.md` when completing a feature or making a non-obvious architecture decision.
- Update `README.md` when routes, MCP tools, or deployment steps change.
- Document external service configuration (Supabase, Vercel, Google Cloud) immediately — it's the hardest knowledge to rediscover.

### Code
- No comments unless the WHY is non-obvious. No docstrings. No placeholders.
- Don't add error handling for scenarios that can't happen.
- Don't over-engineer. Three similar lines is better than a premature abstraction.
- Run TypeScript + visual check + MCP check (if applicable) before declaring a task done. See `docs/DONE.md`.

---

## This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

## docs/ index

What each file is for and when to read it.

| File | Purpose | Read/Write |
|---|---|---|
| `docs/STARTUP.md` | Session startup checklist — run at the start of every session | Read |
| `docs/PROGRESS.md` | Build log and next priorities — read every session, update when a feature ships or a non-obvious decision is made | Read + Write |
| `docs/BUGS.md` | Bug tracker by priority — update status when fixing; add new bugs as they're found | Read + Write |
| `docs/STEERING.md` | Authoritative product and engine decisions — what Lever is, how the simulator works, the AI interaction model | Read only |
| `docs/BUSINESSPLAN.md` | Business plan and market context | Read only — do not write |
| `docs/TESTING.md` | Test accounts, playwright sign-in procedures, full test run sequence, edge case curls | Read |
| `docs/DONE.md` | Definition of done — 5 checks every task must pass before reporting complete | Read |
| `docs/ENV.md` | Environment variable safety rules — which vars are safe where, pre-commit check | Read |
| `docs/DATABASE.md` | Supabase MCP tools reference, snake_case↔camelCase rules, common SQL patterns | Read |
| `docs/MCP.md` | MCP server testing at three levels: protocol, tool execution, conversational flow | Read |
| `docs/DATA-FETCHING.md` | Required patterns for every fetch + useEffect in the codebase | Read |
| `docs/FEEDBACK.md` | How to capture, categorize, and act on user feedback | Read |
| `docs/LAUNCH.md` | Soft launch v0.1 details and GTM context | Read |

---

@docs/STARTUP.md
@docs/TESTING.md
@docs/DONE.md
@docs/ENV.md
@docs/DATABASE.md
@docs/MCP.md
@docs/DATA-FETCHING.md
@docs/STEERING.md
@docs/BUGS.md
@docs/PROGRESS.md
