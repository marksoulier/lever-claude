# Lever — User Feedback & Testing

This document defines how we capture, categorize, and act on feedback from all sources: LLM persona tests, real beta users, and internal observation. Read this before running a test or reviewing feedback.

---

## Feedback channels

| Source | Tool | What goes there |
|---|---|---|
| LLM persona tests — bugs & UX friction | This file (Test Runs section) | Full run transcripts, friction points, observations — internal only |
| LLM persona tests — post-MVP feature ideas | UserJot (`https://lever.userjot.com`) | High-level features worth real-user votes; not MVP blockers |
| Real user feature requests | UserJot (`https://lever.userjot.com`) | Feature ideas, "I wish it did X" |
| Real user bug reports | UserJot (`https://lever.userjot.com`) | Broken flows, errors, unexpected behavior |
| Blocking pre-launch issues | `PROGRESS.md` → Known issues | Must-fix before inviting real users |
| Architecture / product decisions | `PROGRESS.md` → Decision log | Non-obvious choices and why |

**Rule:** nothing lives only in chat. Every finding from a test run gets written here before the session ends.

---

## Issue severity

| Level | Meaning | Action |
|---|---|---|
| **Blocker** | User cannot complete a core flow | Fix before any real user invites |
| **High** | User gets confused or frustrated, but can continue | Fix before wide beta |
| **Low** | Polish, cosmetic, minor friction | Fix opportunistically |
| **Feature** | Something missing that users want | Log to UserJot; prioritize by vote count |

---

## LLM persona test format

Each test run follows this structure:

```
### Run <N> — <Persona name>, <date>

**Persona:** <age, income, goal, tech comfort, prior retirement knowledge>
**Flow tested:** <onboarding / plan creation / what-if / dashboard / etc.>
**Outcome:** Completed / Partially completed / Blocked

**Findings:**
- [Blocker/High/Low/Feature] <what happened and where>

**Fixes applied this session:** <list or "none">
```

Personas should cover the realistic spread of future users. Rotate through:
- First-time user with no financial accounts set up
- Mid-career user with existing savings who wants to model a scenario
- Near-retirement user anxious about whether they're on track

---

## What goes to UserJot vs. stays in this file

UserJot (`https://lever.userjot.com`) is the **public** feedback board — real users see it and can vote on items. Only post things there that are worth putting in front of real users.

| Finding type | Goes to UserJot? | Rationale |
|---|---|---|
| Bug found in LLM persona test | **No** — document here only | Fix it before real users arrive; no need to clutter the public board |
| UX friction found in LLM test | **No** — document here only | Fix it; persona observations are internal development signal |
| High-level feature idea from persona test (nice-to-have, not MVP) | **Yes** — post as a feature request | Useful long-term signal; real users can upvote or add their own context |
| Bug reported by a real user | **Yes** — post immediately | Real user bugs need tracking and may affect others |
| Feature request from a real user | **Yes** — post immediately | Real user demand is the primary input for prioritisation |

**Rule for LLM persona features:** only post to UserJot if it is genuinely post-MVP (would make the product better but is not blocking GTM). Include the persona context in the body so the idea can be weighed against real user votes later. Do not batch — post one at a time as they surface.

## Feature request process

When posting a feature request to UserJot:
1. Call `mcp__userjot__createRequest` with a clear title and description
2. Include the persona context in the body (age, goal, what they were trying to do)
3. Tag it appropriately
4. Do not post LLM-test bugs, UX friction, or MVP blockers here

---

## Test Runs

---

### Run 1 — Maya Chen, 2026-05-27

**Persona:** 28 years old. Software engineer, $85k/year. Just heard a podcast about compound interest and wants to start thinking about retirement for the first time. Has a 401k through work she's never looked at. No idea what a "target balance" is. Moderate tech comfort (uses apps daily, not a developer). Has Claude.ai Pro.

**Flow tested:** Landing page → login → sign-up toggle → dashboard → plan detail → growth projection → what-if CTA
**Outcome:** Partially completed. Core flow works; 6 friction points found (2 high, 3 medium, 1 low).

**Findings:**
- [High] Plan context card shows `update_plan_context` as a `<code>` element next to "edit with" — raw MCP tool name is visible to users. Maya has no idea what this means and no way to edit her plan context from the UI.
- [High] Onboarding "I'm done →" check uses native browser `alert()` when no plan is found — jarring, breaks the polished design, and doesn't suggest what to do.
- [High] Landing page and login page never mention Claude Pro is required. Users who don't have Claude.ai Pro cannot onboard at all — this is a hidden prerequisite that will cause silent drop-off.
- [Medium] "Use the lever MCP connector in Claude" in the plan detail what-if CTA — jargon. Should say something like "Open in Claude to run scenarios and update your plan."
- [Medium] "MONTHLY INCOME" metric card has no subtitle — unclear whether it's current income or projected retirement income (it's the latter).
- [Medium] Shortfall sign inconsistency: the metric card shows "$261K" (positive), the chart summary row shows "-$261K" — the same number with different signs. Confusing.
- [Medium] Landing page nav links (Demo, lever Education, About, Contact) all go to `#` — dead links. Looks unfinished on the marketing page.
- [Medium] Landing page copy says "sandbox for your financial what-ifs. Add life events, move things around" — doesn't reflect the actual product (retirement planning + Claude AI). Messaging mismatch that sets wrong expectations.
- [Low] User avatar shows "?" briefly on dashboard load before user data arrives — a loading flash.
- [Low] Date of birth displayed as "1983-06-15" (raw ISO format) — should be a human-readable format or just show age.
- [Low] Sign-up form has no confirm password field or password requirements hint.

**Fixes applied this session:** See "Fix blocking/high issues" section below. High findings from this run were resolved: plan context card cleaned up, `alert()` replaced with inline error, landing page copy corrected for free Claude.ai tier.

---

### Run 2 — Carlos Rivera, 2026-05-27

**Persona:** 45 years old. Operations manager, $130k/year. Has a 401k ($180k), Roth IRA ($45k), and a mortgage ($290k remaining). Knows he should be doing more. Wants to model retiring at 60 vs 65. Comfortable with technology. Has Claude.ai Pro.

**Flow tested:** Dashboard → plan detail → what-if comparison view (Retire at 60 vs primary plan)
**Outcome:** Completed. What-if comparison is the standout feature — Carlos would find it genuinely compelling.

**Findings:**
- [High] What-if plans don't inherit context from the primary plan — Carlos has to "Set up with Claude" a second time for each scenario. He already gave his age/income once; repeating it is friction.
- [Low] The +$890K difference callout in amber is clear and emotionally impactful — this is the right design. Keep it.
- [Low] Comparison chart legend appends "(primary)" to the plan name — helpful for clarity, no change needed.
- [Low] "Retire at 60" scenario in the test data shows *more* money ($2.7M) than retiring at 63 ($1.8M) — counterintuitive and likely from mismatched test data. Real users' what-ifs should reflect their actual numbers.

**Fixes applied this session:** None — no blockers.

---

### Run 3 — Sandra Park, 2026-05-27

**Persona:** 57 years old. School administrator, $95k/year. Has $320k in a 403b and $40k savings. Target retirement age 65. Worried she's behind. Less tech-comfortable — uses email and basic apps. Has Claude.ai Pro.

**Flow tested:** Landing page → dashboard → plan detail → metric cards → growth projection
**Outcome:** Key concern: Sandra would struggle most with the hidden Claude Pro requirement and the `update_plan_context` code reference. Plan detail metrics are legible but lack explanatory context for a less-technical user.

**Findings:**
- [High] Same as Maya finding #3: Claude Pro requirement is never surfaced. Sandra signs up, hits the onboarding gate, reads "Add the Lever connector to Claude" — she may not have Claude Pro and has no idea how to get it.
- [High] Same as Maya finding #1: `update_plan_context` code in the plan context card. Sandra would assume she can't change anything.
- [Medium] "PROBABILITY OF SUCCESS: 85%" — success at what? There's no tooltip or subtitle explaining this is the probability of reaching her retirement balance target. For Sandra who is anxious about being on track, a bare percentage without context is unsettling.
- [Medium] "SHORTFALL / SURPLUS" label — Sandra might not immediately understand the sign convention. A negative shortfall (she's behind) vs a positive surplus (she's ahead) should be visually differentiated.
- [Low] Growth projection chart starts the x-axis at current age (42 in test data) — for Sandra at 57, the chart would compress the critical last 8 years before retirement. Worth verifying the x-axis scaling works well for users close to retirement age.
- [Low] No "what do I do next?" nudge after Sandra views her plan. She has a 85% probability of success — good! But no "here's what to tell Claude to explore next" suggestion.

**Fixes applied this session:** Onboarding gate copy rewritten — "Add the Lever connector" replaced with plain-English copy explaining free Claude.ai works; "connector" jargon removed. "Give feedback" link to lever.userjot.com added to sidebar.

---

### Run 4 — Priya Sharma, 2026-05-27

**Persona:** 38 years old. Senior marketing manager, $115k/year. Two kids (7 and 9). Has a 401k ($95k) she's never actively managed. Main concern: balancing college savings vs. retirement. Has Claude.ai free. Tech-comfortable but not technical.

**Flow tested:** Landing page → sign-up form → dashboard → plan detail → what-if plan comparison → documents page
**Outcome:** Core flow works well after recent fixes. Three new friction points found.

**Findings:**
- [Medium] Sidebar plan list shows "No primary plan set" for ~2 seconds on every page load before the `/api/plans` response arrives. On a slow connection this looks broken — Priya would wonder if she lost her plan. Plans section should show a loading skeleton rather than the "No primary plan set" empty state while the request is in-flight.
- [Medium] Plan detail "This plan has no personal context yet" CTA reads "Set up with Claude →" and links to `https://claude.ai` root — no prompt, no context. Priya would open Claude.ai and not know what to say. Either provide a copyable starter prompt in a modal, or deep-link to a Claude conversation with the onboarding prompt pre-filled (if Claude supports that URL scheme).
- [Low] Sign-up form has no confirm-password field and no password hint. Low friction but decreases trust on a financial app.
- [Low] Dashboard "Plans" section body text: "Select a plan from the sidebar to view its detail" — breaks when sidebar is collapsed or on small viewports.

**Fixes applied this session:** None.

---

### Run 5 — James Thornton, 2026-05-27

**Persona:** 52 years old. Self-employed consultant, $200k/year variable. SEP-IRA ($340k). Wants to retire at 58. Has tried multiple planning tools, finds them too rigid. Has Claude Desktop. Technically sophisticated.

**Flow tested:** Dashboard → new plan (retirement age 55) → plan detail → what-if section → documents page
**Outcome:** Core creation flow works. Two issues that directly undermine trust for a sophisticated user.

**Findings:**
- [High] "What-if scenarios" heading is present on the plan page but `WhatIfPanel` returns `null` when `isPremium && scenarios.length === 0` (the `scenariosByRetirementAge` map only covers ages 60 and 65; age 55 produces an empty array). Premium users with any other retirement age see an orphaned heading and empty space below it — looks like a bug. Fix: when premium but no scenarios, render a placeholder ("No curated scenarios yet — ask Claude to model one for this plan") rather than returning `null`.
- [Medium] "Retire at 60" what-if shows $2.7M projected vs primary plan's $1.8M — more money by retiring *earlier*. This is because the what-if plan has a higher monthly contribution in the test data ($5k vs $2.5k), not the retirement age. James would flag this immediately as a data integrity problem and lose confidence in all projections.
- [Medium] Documents page explains "Claude reads each file and extracts the key financial details." No feedback after upload, no indication of how the extracted data connects to the plan. James wants to know: does this update my income? Does Claude automatically pull from it next conversation? The loop is invisible.
- [Low] "Give feedback" sidebar link — James would use this immediately. Good placement.

**Fixes applied this session:** None — documenting only.
