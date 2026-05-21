# User Test — Tyler (new-grad)

**Date:** 2026-05-21
**Persona:** Tyler, 24 — first real job ($72k), untouched employer 401k, no savings habit, wants to know if he's "on track"
**Tech comfort:** Daily app user, comfortable with Google login, does NOT know what MCP is
**Patience:** 5 minutes before deciding it's "not for him"
**App state at test time:** Onboarding gate visible (0 plans), accounts empty, net worth snapshots present from earlier manual testing

---

## Predicted outcome (before running)

Tyler pastes the onboarding prompt → Claude calls `get_onboarding_status` → Claude asks him questions one at a time → Claude calls `update_plan_context` + `create_plan` (or similar) → Claude calls `add_account` for his 401k and checking account → Tyler clicks "I'm done →" → Dashboard shows his plan and accounts.

Expected: smooth end-to-end in ~10 minutes without leaving Claude.

---

## What actually happened

### Onboarding gate
The gate rendered correctly — blurred app behind is a strong visual hook. 3-step layout is readable.

**Step 1 friction:** The word "connector" and "Settings → Connectors → +" means nothing to Tyler. He'd probably click around and find it, but this is the highest drop-off point in the entire flow. Estimated 30–40% of Tylers would give up here.

**Step 2:** Copying the prompt and pasting it into Claude works fine. No issues.

### Claude conversation (MCP tool calls)

**`get_onboarding_status`:** ✅ Returned exactly the right instructions. Claude correctly knows to ask for DOB, income, target retirement income, risk tolerance — and to create a plan first.

```json
{
  "authenticated": true,
  "isComplete": false,
  "summary": "Setup 0% complete. Next: Create first plan.",
  "nextSteps": [
    {
      "step": "Create first plan",
      "action": "Ask the user: their name, date of birth (YYYY-MM-DD), current annual income..."
    }
  ]
}
```

**`update_plan_context` (after collecting Tyler's answers):** ❌ Returned `"No plan found. Create a plan first."` — because there is no `create_plan` MCP tool. Claude must tell Tyler to go back to the web UI to click "New plan." This **breaks the pure Claude onboarding flow completely.**

Tyler's expected experience: "Just tell Claude what I want and it handles it."
Tyler's actual experience: "Go back to the website and fill out a form." → Likely quits.

**`add_account`:** ✅ Works for new users. The "Not authenticated" in initial testing was a **test methodology error** — shell variable `$TOKEN_ZERO` was not persisted between separate bash calls, so the token was empty. Re-tested in a single shell call: account added and net worth snapshot logged correctly.

---

## Screenshots

- First impression: `tyler-first.png` — shows demo user's dashboard (post-onboarding reference)
- Onboarding gate: `onboarding-gate.png` — the actual gate Tyler would see

---

## Bugs found

| # | Bug | Severity | Repro |
|---|---|---|---|
| 1 | No `create_plan` MCP tool — `update_plan_context` fails with "No plan found" on new users | **Critical** | Call `update_plan_context` with any zero-plans user token |
| ~~2~~ | ~~`add_account` auth bug~~ | ~~High~~ | **FALSE POSITIVE** — test methodology error (shell var not persisted). `add_account` works correctly. |
| 2 | Net worth graph can show false drops if user logs manual snapshots before adding all accounts | **Low** | Rare edge case; real users who follow the MCP flow won't hit this |

---

## Confusion points

1. **"Connector" terminology** — Step 1 of the gate uses "Settings → Connectors → +" which is Claude.ai-specific jargon. Tyler doesn't know this exists. Fix: replace with "Settings → Connectors → +" **with a screenshot**, or rename to "Add Lever to Claude" and link directly to Claude settings if a deep link becomes available.

2. **Being sent back to the web UI mid-conversation** — After asking Tyler 4 questions, Claude has to say "now go back to the website and create a plan." This is a trust-breaking interruption. Fix: add `create_plan` MCP tool so Claude handles the full flow without leaving the chat.

3. **"Your MCP URL is unique to you — keep it private"** — Tyler might be scared by this. Implies there's something sensitive happening. No explanation of what the URL does or who could misuse it. Fix: add a one-sentence tooltip — "This URL links Claude to your Lever data. Anyone with this URL can read your financial plan."

---

## What the first page promises vs what happened

| Promise (from gate) | Reality |
|---|---|
| "Connect once, then Claude walks you through everything" | Claude walks you through ~4 questions then sends you back to the web UI to create a plan |
| 3-step process | Actually 5+ steps because step 2 (create plan) is split between Claude and the web UI |
| "I'm done →" checks for plan | ✅ This works correctly |

---

## Drop-off risk: 3/5

Tyler would complete it with friction. The connector step and the mid-conversation web UI redirect are the two most likely quit points. A technical user (Sarah, Marcus) would power through. Tyler is right on the edge.

---

## Recommended fixes (priority order)

1. ~~**Add `create_plan` MCP tool**~~ ✅ **Fixed 2026-05-21** — Tool added. Full flow tested end-to-end: `get_onboarding_status` → `create_plan` (with context in one call) → `add_account` → `get_onboarding_status` shows `isComplete: true`. Tyler never leaves Claude.

2. **Fix `add_account` for new users** — Guard `upsertNetWorthSnapshot` with a check: if no accounts exist yet after insert, skip the snapshot or handle gracefully.

3. **Add a visual to step 1 of the gate** — Screenshot or short GIF showing Settings → Connectors → + in Claude.ai. 30 seconds of visual context.

4. **Clarify the "keep it private" footer** — Add one sentence explaining what the URL actually does.

---

## Follow-up tests to run

- [ ] Re-run Tyler after fixing bugs 1 and 2 — did the flow complete end-to-end in Claude?
- [ ] Run `mid-career` (Sarah) — different expectations, higher tolerance, care about accuracy
- [ ] Run `skeptic` (Dana) — lowest patience, most likely to refuse the MCP connection entirely
