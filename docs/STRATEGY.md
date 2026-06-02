# STRATEGY.md — Competitive Brainstorm & Market Analysis

Last updated: 2026-06-02. Read-only for Claude — append findings, do not rewrite.

---

## Competitor Landscape

### ProjectionLab — $0 / $129yr / $549yr (advisor)
**What it is:** DIY retirement/FIRE planning simulator. Deep scenario modeling, Monte Carlo, tax optimization (Roth conversions, capital gains harvesting), estate planning, Sankey cash flow diagrams.

**Strengths:** Best-in-class depth for power users. Privacy-first (no account linking). Loved by FIRE community (Mad Fientist endorsement). Advisor tier proves B2B revenue model works.

**Weaknesses:** No AI. No conversational interface. Static — you must manually update it when life changes. Complex UI that rewards patience. Desktop-first. No proactive monitoring. No mobile.

**Their user:** 35-55 year old spreadsheet-loving FIRE pursuer who enjoys the modeling process.

---

### Era Financial — Free + paid tiers
**What it is:** Agent-native personal finance MCP infrastructure. Connects bank accounts to Claude/ChatGPT for real read-write access. Automates categorization rules, transfers, alerts. Built by ex-Stripe/Robinhood/CashApp team.

**Strengths:** Real bank account connections via Plaid. Multi-AI platform (not locked to Claude). Read-write agent access — AI can execute transfers. Institutional team and funding. "Agent-native" narrative is the right frame for 2026.

**Weaknesses:** No financial simulator or long-term planning. No retirement/what-if modeling. It's infrastructure for tracking current money, not planning future money. No event-based life modeling. Expensive to scale (Plaid costs).

**Their user:** AI power user who already uses Claude daily, wants their finances in context.

---

### Monarch Money — $14.99/month
**What it is:** Cross-platform budgeting, expense tracking, net worth history. Supports couples/joint finances.

**Gap:** Zero long-term planning. No AI simulation. No retirement modeling. Sophisticated tracking, no forward view.

---

### Copilot — $10.99/month (Apple-only)
**What it is:** AI-powered spending categorization, adaptive budgeting. Beautiful iOS/Mac app.

**Gap:** Apple ecosystem lock-in. No planning beyond current month. No what-if scenarios.

---

### YNAB — $109/year
**What it is:** Zero-based budgeting methodology app. Strong cult following.

**Gap:** Entirely present-tense. No future modeling. No AI. No retirement planning.

---

## Where Lever Sits

**Lever occupies the gap between Era and ProjectionLab — and neither can easily close it.**

| Capability | Era | ProjectionLab | Lever |
|---|---|---|---|
| AI-native interface | ✓ | ✗ | ✓ |
| Long-term simulation | ✗ | ✓ | ✓ |
| MCP-first | ✓ | ✗ | ✓ |
| Conversational plan building | ✗ | ✗ | ✓ |
| Bank account connections | ✓ | ✗ | ✗ (gap) |
| Monte Carlo | ✗ | ✓ | ✗ (planned) |
| Proactive monitoring | partial | ✗ | planned |
| Event-based life simulator | ✗ | partial | ✓ |
| Mobile | ✓ | ✗ | partial |
| Advisor tier | ✗ | ✓ | ✗ (opportunity) |

---

## What Makes Lever Novel

1. **The conversation IS the plan.** ProjectionLab requires you to fill forms. Era gives you a financial dashboard. Lever builds a rich deterministic simulation purely through conversation — no form ever appears. This is a fundamentally different UX paradigm.

2. **Deterministic event-based simulator as MCP.** Claude can call `update_plan`, `run_what_if`, and get back precise, reproducible numbers — not hallucinated estimates. This is what makes AI-driven financial planning trustworthy. Neither Era nor ProjectionLab does this.

3. **The plan is alive.** ProjectionLab is a snapshot you manually maintain. Lever's plan updates every time the user has a conversation — life changes flow directly into the model. The vision: it also updates when the *world* changes (legislation, rates, programs) without the user doing anything.

4. **AI surfaces what users don't know to ask.** Most tools answer questions. Lever should proactively surface: unclaimed employer match, programs the user qualifies for, risks they haven't modeled. This is the STEERING.md vision — and no competitor does it today.

5. **No advisor, no judgment.** The user feels in control. The AI teaches as it builds, so the user understands their own plan. This directly addresses the problem statement: people avoid financial advisors because they feel embarrassed or exploited.

---

## Market Context

- AI financial planning software: **$629M market in 2025, 28.9% CAGR through 2033**
- 84% of financial planning firms now use AI-powered analytics (up from 55% in 2022)
- **82% of midsize companies have begun or plan agentic AI implementation in 2026**
- MCP adoption is accelerating — Era proves the connector model works for consumers
- Consumer preference shifting from dashboards to conversational/agent interfaces
- Privacy-first design (ProjectionLab model) resonates strongly post-Mint shutdown

---

## Revenue Opportunities (Prioritized)

**1. Subscription tiers — primary revenue**
- Free: 1 plan, basic projections (acquire users, no friction)
- Premium: $12-15/month — multiple plans, what-if scenarios, document upload, Monte Carlo when built
- Advisor: $40-60/month — manage multiple client plans, admin panel, white-label widget

**2. Affiliate / referral — zero-cost revenue**
When Claude recommends specific products (HYSA, refinance lenders, student loan servicers, life insurance), embed affiliate links. Lever uniquely knows *exactly* which products match each user's situation — higher conversion than generic comparison sites.

**3. Plaid / bank connections — unlock retention**
Once users connect real accounts, churn drops dramatically (Era's moat). Adds cost but creates stickiness. Could be premium-only feature.

**4. Financial coaching marketplace (longer term)**
Connect users who want human validation with CFPs. Lever provides the plan, CFP validates it. Revenue share or lead generation fee.

---

## Marketing Angles (Ranked by Effort/Return)

**1. FIRE / r/financialindependence (highest return, lowest cost)**
ProjectionLab won this community and it made them. Lever is legitimately better for conversation-first users. One well-placed post ("I built a tool where Claude builds your retirement plan through conversation") could go viral in this community. Mad Fientist, ChooseFI, and similar podcasts are distribution goldmines.

**2. "The financial plan you'll actually keep updated"**
Every competitor's plan goes stale. Lever's doesn't. This is a messaging angle that hits a real pain point — people nod when they hear it. Short-form content showing before/after (Excel doc from 3 years ago vs. Lever plan updated in a conversation).

**3. ProductHunt launch**
ProjectionLab and Era both had successful PH launches. Timing matters — launch after Monte Carlo is live (makes the demo more impressive) and after bank connections (if/when added).

**4. "Your financial advisor in Claude" — Claude.ai marketplace positioning**
As Anthropic grows the Claude.ai connector ecosystem, being featured or well-reviewed there is free distribution. Lever is a natural showcase of what MCP connectors can do.

**5. YouTube / creator partnerships**
Personal finance YouTube (Graham Stephan, Andrei Jikh, etc.) have audiences that match exactly. Sponsorship is expensive but targeted. Better: genuine reviews from smaller creators who find it themselves via communities.

---

## Critical Gaps to Close Before Serious Marketing

1. **Monte Carlo** — ProjectionLab's "probability of success" is real. Lever's is fake (linear formula). This undermines trust for the core use case. Must be real before any serious comparison.

2. **Bank account connections** — Without Plaid, users must manually enter balances. Era's moat is real-time account sync. This isn't required for v1 but limits retention long-term.

3. **Advisor tier** — ProjectionLab's $549/year advisor tier is pure margin. Lever's admin panel is 80% of the way there. This is low-hanging revenue.

4. **Onboarding to first "aha" moment** — The current flow (create account → connect Claude → build plan in conversation) has too many steps and too much friction before value is delivered. The aha moment should be: "Claude just told me something about my money I didn't know." That needs to happen faster.

---

## Novel Ideas Worth Brainstorming

- **"Financial health score"** — Single number (like a credit score) derived from the simulation: emergency fund coverage, retirement trajectory, debt-to-income ratio, employer match capture. Updated after every plan change. Shareable. Gamified.

- **"Plan milestones" notifications** — "Your mortgage will be paid off in 4 years 7 months" / "You hit $500K net worth last Tuesday." Delivered to the phone. Emotional, memorable, shareable on social.

- **Legislation scanner** — Background agent monitors IRS/Congress/Fed announcements, maps to users' plans, surfaces relevant changes. ("New 401k catch-up contribution limits were announced — your plan can capture an extra $X.") No competitor does this.

- **"Bring your financial advisor" mode** — User connects Lever to their existing human advisor. Advisor gets read-only view + can push recommendations. Lever becomes the collaboration layer between user and advisor rather than a replacement.

- **"Compare with peers" (anonymized)** — "People in your income range at age 32 have an average retirement probability of 71%. You're at 84%." Social proof + motivating.

---

## Immediate Next Actions

1. Fix Monte Carlo (credibility prerequisite for any serious positioning)
2. Build advisor tier (existing admin panel → revenue-generating product)
3. Write one genuine post for r/financialindependence when product is solid enough
4. Add financial health score concept to backlog
