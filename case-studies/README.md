# Lever User Test Case Studies

Each file is one test run. Run `/user-test [persona]` to generate a new one.

| Date | Persona | Drop-off risk | Critical bugs | File |
|---|---|---|---|---|
| 2026-05-21 | Tyler — new-grad, 24 | 3/5 → **fixed** | ~~No create_plan MCP tool~~ ✅ fixed; add_account bug was false positive | [2026-05-21-tyler-new-grad.md](2026-05-21-tyler-new-grad.md) |

---

## Test methodology notes

Things that looked like bugs but were testing artifacts. Check these before filing.

| Artifact | What happened | Rule |
|---|---|---|
| `add_account` "Not authenticated" (Tyler, 2026-05-21) | Shell variable `$TOKEN_ZERO` was empty — not persisted from a prior Bash call | Always set token and curl in the same Bash block |
| Net worth graph -62.5% (Tyler, 2026-05-21) | Manual snapshots logged at $285K–$391K before the account was added at $107K | Real users following the MCP flow won't have prior manual snapshots |
| Used `71f0a49c` (real user) as test subject | Created plan + accounts on their account, had to clean up | Use `demo@lever.dev` or create a dedicated test user — never real signups |

---

## Patterns across tests

_Updated after each run. Look for confusions that appear in multiple tests — those are the highest priority fixes._

| Pattern | Appeared in | Status |
|---|---|---|
| "connector" terminology confuses non-technical users | Tyler | Open |
| Sent back to web UI mid-Claude-conversation breaks flow | Tyler | Open — needs create_plan MCP tool |
| add_account fails for users with no prior plan | Tyler | Open — auth bug |
