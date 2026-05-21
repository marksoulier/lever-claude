# /user-test — Lever User Experience Test Skill

---

## ⚠️ Test environment vs real user — know the difference

These are artifacts of the test environment that will look like bugs but aren't. Check this list before filing a bug.

| Symptom | Looks like | Actually is |
|---|---|---|
| MCP tool returns "Not authenticated" | Auth bug | Shell variable `$TOKEN` not set — shell vars don't persist between Bash tool calls. Always set the token AND curl in the **same** Bash block. |
| Net worth graph shows a big historical drop | Data bug | Test data pollution — manual snapshots logged before accounts were added. A real new user starts fresh; their first snapshot comes from adding accounts. |
| `get_onboarding_status` shows accounts but no plan (or vice versa) | Broken state | Test leftover data from a previous run on a shared user account. Check DB state before starting a test. |
| Tool works for demo user but fails for zero-plans user | User-specific bug | More likely the zero-plans user's token wasn't set correctly in the shell. Re-test in a single bash block with the token hardcoded. |
| Dashboard shows someone else's data | Multi-user RLS bug | Dev RLS policies allow all reads. Not a real bug for real users — but means test users can see each other's data. |

### Rules for clean tests

1. **Shell variables don't persist between Bash calls.** Set `TOKEN=...` and `curl ...` in the same block, every time. Never reference a variable set in a previous block.
2. **Clean up test data after each run.** If you created plans, accounts, or snapshots on a real user's account during a test, delete them when done. Use the DB query tool.
3. **Don't use real user accounts as test subjects.** The zero-plans user (`71f0a49c`) is a real signup. Use the demo account (`demo@lever.dev`) or create a dedicated test user.
4. **Note the app state before you start.** Existing snapshots, plans, and accounts in the DB affect what the test sees. Always describe the starting state in the case study.
5. **"Works for demo user, fails for new user" is the most important class of bug.** The demo user has existing data that masks bugs. Always re-test critical paths with a truly empty account.

---

Run a full end-to-end user test from the perspective of a target persona. Tests both the web UI AND the MCP conversation flow. Reports what worked, what confused the persona, and where they would drop off.

## Usage

```
/user-test
/user-test [persona-type]
```

**Persona types:** `new-grad` (default), `mid-career`, `anxious-saver`, `skeptic`

If no persona is given, use `new-grad` — the primary target customer from the business plan.

---

## How to run the test

You are the test runner AND the persona. Do both in a single session:

### Phase 1 — First impression (as the persona, via playwright)

Sign in as the test user and see the app exactly as the persona would:

```bash
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
playwright-cli snapshot --depth=3
playwright-cli console  # must be 0 errors
playwright-cli screenshot --filename=user-test-first-impression.png
```

Before doing anything else — **write down what the persona would think on first contact.** Use only what is visible on screen. Do not use developer knowledge.

### Phase 2 — Onboarding gate (as the persona, via playwright)

If the gate is visible, document the experience:
- Is the 3-step instruction clear to someone non-technical?
- Is the MCP URL explanation confusing?
- Would the persona know what "Claude connector" means?
- Screenshot: `playwright-cli screenshot --filename=user-test-gate.png`

### Phase 3 — Claude conversation (as the persona, via MCP tools)

This is the core test. You ARE the persona having a conversation with Claude. Claude's responses are the actual MCP tool outputs.

**IMPORTANT — shell variable scoping:** Shell variables do NOT persist between separate Bash tool calls. Always set the token AND make the curl call in the SAME Bash block, or hardcode the token value directly. A missing token returns "Not authenticated" which looks like a bug but isn't.

Use the zero-plans test token OR the demo token depending on what state you need:

```bash
# What Claude sees at the start of the conversation
curl -s -X POST "http://localhost:3000/api/mcp?token=TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_onboarding_status","arguments":{}}}'
```

Then simulate the conversation step by step:
1. Paste the onboarding prompt (what the persona would do)
2. Call each MCP tool in the sequence Claude would call them
3. Record what each tool returned
4. Write what the persona would think/feel at each step
5. Note any moment the persona would be confused, bored, or ready to quit

Use the actual tool calls:
```bash
# Claude calls this, returns what it tells Claude to ask next
get_onboarding_status

# Claude collects answers and calls this
update_plan_context  -- with the persona's real answers

# Claude adds accounts
add_account -- for each account the persona mentions

# Claude creates what-if scenarios
create_what_if_plan -- if persona asks
```

### Phase 4 — Return to app (as the persona, via playwright)

After the simulated conversation, check the dashboard reflects the changes:
```bash
playwright-cli reload
playwright-cli screenshot --filename=user-test-post-conversation.png
playwright-cli console  # must be 0 errors
```

### Phase 5 — Save the case study (REQUIRED)

Before writing anything to the user, save the full findings to a dated file:

**Filename format:** `case-studies/YYYY-MM-DD-[persona-slug].md`
Examples: `case-studies/2026-05-21-tyler-new-grad.md`, `case-studies/2026-06-03-sarah-mid-career.md`

**Then update the index:** `case-studies/README.md` — add a row to the table and update the "Patterns across tests" section if you spotted a confusion or bug that appeared before.

Do this with Write/Edit tools before outputting the report summary to the user.

### Phase 6 — Report to user

After saving, output a concise summary using this structure:

---

The case study file should contain the full detail. The summary to the user should be shorter:

---

## User Test — [Persona name] — [Date]

**Drop-off risk:** X/5 — [one sentence why]

**Bugs found:**
- [Critical/High/Medium] — [one-line description]

**Top confusion points:**
- [what confused them and where]

**What the first page promises vs what happened:**
- Promised: "[quote from gate/landing]"
- Reality: "[what actually happened]"

**Top recommended fix:** [most impactful single change]

**Full case study saved to:** `case-studies/YYYY-MM-DD-[persona].md`

---

---

## Persona definitions

### new-grad (default)
- **Name:** Tyler, 24
- **Situation:** First real job, $72k salary, renting, has a 401k through employer he's never touched, no savings habit yet
- **Goal:** Figure out if he's on track and what "on track" even means
- **Tech comfort:** Uses apps daily, comfortable with Google login, does NOT know what MCP is
- **Patience:** Will give the app 5 minutes before deciding it's "not for him"
- **What he'd think seeing "connect to Claude":** Curious but suspicious — is this just an AI gimmick?

### mid-career
- **Name:** Sarah, 38
- **Situation:** $140k salary, owns a home, has 401k + Roth IRA, two kids, feels behind on retirement
- **Goal:** Get a real number — am I actually behind or does it just feel that way?
- **Tech comfort:** Comfortable with finance apps, knows what an API is, has used ChatGPT
- **Patience:** High — she'll follow instructions if they make sense
- **What she'd think seeing "connect to Claude":** Skeptical about privacy but intrigued

### anxious-saver
- **Name:** Marcus, 31
- **Situation:** $95k salary, maxes his Roth IRA, obsessively checks balances, scared of market crashes
- **Goal:** Reassurance that his plan is good, what-if scenarios for bad years
- **Tech comfort:** Power user — will read every word, will test edge cases
- **Patience:** High, but zero tolerance for wrong numbers
- **What he'd think seeing "connect to Claude":** Immediately asks "where is my data stored?"

### skeptic
- **Name:** Dana, 27
- **Situation:** $88k salary, no retirement savings yet, always meant to start but hasn't
- **Goal:** Just got spooked by a podcast about retirement — wants to see how bad it actually is
- **Tech comfort:** Average
- **Patience:** Very low — any friction = gone
- **What she'd think seeing "connect to Claude":** "I'm not connecting my financial data to some AI"
