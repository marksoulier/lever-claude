---
name: synthetic-users
description: Simulate a panel of realistic customer personas discovering and testing a web product end-to-end. Discovers what the product does, generates relevant personas, walks through the app as each one in a real browser, and reports what worked, what confused them, and where they would drop off. Generic — works on any web product.
allowed-tools: Bash(playwright-cli:*) Read Bash(find:*) Bash(grep:*) Bash(curl:*)
---

# Synthetic Users

Simulate a panel of realistic first-time customers using a product. Each persona has a different background, goal, and level of patience. You stay in character — reporting observations as the persona, not as a developer. The goal is to find the gap between what the product does and what a real user experiences.

## How to invoke

```
/synthetic-users
/synthetic-users http://localhost:3000
/synthetic-users https://your-product.vercel.app
/synthetic-users --personas=3
/synthetic-users http://localhost:3000 --personas=7
```

Default: 5 personas, auto-detect URL from project.

---

## Phase 1 — Discover the product

Before generating a single persona, understand what the product is and who it is for. A persona generated without this context will be irrelevant.

**Steps:**
1. If a URL was given, open it with `playwright-cli open` and take a snapshot of the homepage
2. If no URL was given, check for a `README.md` at the project root, then try `http://localhost:3000`, then `http://localhost:3001`
3. Read the homepage — headings, taglines, CTAs, nav labels
4. Check for a pricing page, about page, or onboarding flow if visible

**You must be able to answer all three before continuing:**
- What does this product do in one sentence?
- Who is the obvious intended user?
- What is the primary action a new user is supposed to take?

Do not guess. If the homepage does not make these clear, that is itself a finding — note it and use what you can infer.

See [references/discovery.md](references/discovery.md) for discovery commands.

---

## Phase 2 — Generate personas

Generate personas relevant to this specific product. Do not use the same set every time — derive them from what you learned in Phase 1.

**Number of personas:** use the `--personas` argument if given, otherwise default to 5.

**Persona dimensions to vary across the panel:**
- Technical ability (beginner / intermediate / expert)
- Urgency (browsing vs. has a specific problem to solve right now)
- Scepticism (ready to sign up vs. needs convincing)
- Use case (common case vs. edge case the product may not have considered)
- Context (personal use vs. professional / team use)
- Device expectation (desktop power user vs. mobile-first mindset)

**Every persona must have:**
```
Name: [first name only]
One-liner: [who they are and why they landed here — one sentence]
Goal: [the specific thing they want to accomplish in this session]
Patience: low | medium | high
Technical ability: beginner | intermediate | expert
Key assumption: [one thing they believe about the product that may or may not be true]
Success condition: [what "this worked" looks like for them]
```

**Rules:**
- No two personas should have the same Goal
- At least one persona should be sceptical (patience: low, here to evaluate not commit)
- At least one persona should be a beginner who will not read documentation
- At least one persona should have an edge case goal the product might not handle well

See [references/persona-templates.md](references/persona-templates.md) for examples across product types.

---

## Phase 3 — Run each persona

Run a complete browser session for each persona. Use playwright-cli throughout.

**Session structure for each persona:**

### 3a. Announce the persona
State the persona's name, goal, and key assumption before opening the browser. This keeps your observations grounded in their perspective.

### 3b. Start from the entry point
Open the URL fresh. Do not carry over cookies or state from the previous persona unless you are explicitly testing a return-user flow.

### 3c. Navigate as they would
- Read what is visible — headings, buttons, labels
- Click what looks clickable to someone with their background
- Do not look for things a developer would know to look for
- Do not use keyboard shortcuts unless the persona is technical
- If something is unclear to the persona, note it — do not silently figure it out

### 3d. Report in character
Use first-person. Write what the persona notices, not what you observe as Claude:

> ✓ "I can see a dashboard with my two plans listed. The percentages make sense."
> ✗ "The dashboard correctly fetches from /api/plans and renders two PlanRow components."

Add a `[DEV NOTE]` below any observation where the technical cause is worth recording:
> "I clicked Create and nothing happened for a few seconds — I'd probably click again."
> `[DEV NOTE]` The POST to /api/plans takes ~800ms with no loading indicator.

### 3e. Attempt the goal
Actively try to complete the persona's `Success condition`. Do not give up on first friction — a real user with medium patience tries a few times.

### 3f. Record the result
End every session with one of:
- **✅ Goal completed** — describe how
- **⚠️ Partially completed** — describe what worked and where it stalled
- **❌ Goal failed** — describe the exact point of failure

### 3g. Check console errors
After each session: `playwright-cli console`. Every JS error is a bug the persona experienced as invisible broken behaviour. List them.

### 3h. Close the browser
`playwright-cli close` before starting the next persona.

---

## Phase 4 — Synthesise findings

After all personas have finished, produce the following report. Do not skip sections.

---

### Product summary
One paragraph: what the product does, who it seems designed for, and what the primary flow is.

### Session results

| Persona | Goal | Result | Key friction point |
|---|---|---|---|
| [name] | [goal] | ✅ / ⚠️ / ❌ | [one phrase] |

### What worked for everyone
Flows and content that every persona navigated without confusion. Keep this brief — it is validation, not the main finding.

### Persona-specific friction
For each persona: the specific moment they struggled and why. Name the page, the element, and the persona's mental model that caused the mismatch.

### Common failure points
Steps where more than one persona struggled, ranked by number of personas affected. These are your highest-leverage fixes.

### Console errors found
List every JS error encountered across all sessions. Each error is a bug that real users hit silently.

### Recommended fixes
The 3–5 changes that would help the most personas. Format each as:

```
Fix: [what to change]
Affects: [which personas, how many]
Effort: low | medium | high
Page/file: [where the change goes]
```

---

## Rules — do not break these

- **Every persona runs.** Do not skip one because the product "obviously works" for them.
- **Stay in character.** Never break into developer voice mid-session. Finish the session as the persona, then add `[DEV NOTE]`s below.
- **Never fix bugs during a run.** Observe and report. Fix after all personas are done.
- **Console errors are findings.** Every error counts, even if the page looks fine.
- **Dead ends are findings.** A 404, a blank page, a form that submits to nothing — describe what the persona experiences, not what broke technically.
- **Auth blockers must be named.** If the product requires login and no test account exists, record it as a blocker, describe what the persona would do (leave, look for sign-up, etc.), and continue with remaining personas.
- **Do not assume the happy path.** At least one persona must try something the product might not expect — a name with special characters, an age that's out of range, submitting a form twice.

---

## Reference docs

- [references/discovery.md](references/discovery.md) — commands for understanding an unfamiliar product
- [references/persona-templates.md](references/persona-templates.md) — example personas across product types
- [references/report-format.md](references/report-format.md) — full report template with examples
