# SELLING.md — Revenue, Growth & Marketing Activities

Living document. Add new activities, findings, and status as they happen. Claude reads this on every `s` command to pick the next highest-leverage selling activity.

---

## Product Readiness (prerequisites before pushing hard)

Before serious outreach, these must be true:
- [x] Monte Carlo prompt visible on plan page — "Run a real probability simulation" card with copyable prompt
- [x] "Open in Claude" shows plan-specific copyable prompts at all three touch points
- [ ] Onboarding to first aha moment under 5 minutes
- [ ] No P0 bugs open in BUGS.md

---

## Design & Branding

**Brand identity**
- Name: Lever. Tagline candidate: *"Your retirement plan, built with AI."* or *"Financial clarity through conversation."*
- Colors: teal (#4bbdc8 family), white, zinc. Clean. Not fintech-blue.
- Logo: wordmark only for now. Future: a lever icon (simple, mechanical, implies leverage)
- Fonts: current Next.js stack — no custom brand fonts yet
- Tone: direct, builder-to-builder, not corporate (see FOUNDER.md)

**Platform polish checklist (before any marketing push)**
- [ ] Mobile-responsive dashboard — currently desktop-first
- [ ] Empty state for brand-new users (no plans, no accounts) — currently shows demo data
- [ ] Favicon and OG image set for link previews
- [ ] Custom domain email (mark@lever.co or similar) for outreach credibility
- [ ] Landing page hero video or animated demo — text-only right now

---

## Content & Community

**Highest leverage, lowest cost — start here.**

### Reddit (r/financialindependence, r/personalfinance)
- Do NOT post until Monte Carlo button is live and "Open in Claude" works
- Post format: genuine builder story, not product announcement. "I built this because..."
- Use Mark's voice from FOUNDER.md — DIY, builder-to-builder, no corporate language
- Best time: weekdays 8–10am EST (peak r/fi traffic)
- Target post title: *"I built a financial planning tool where Claude builds your retirement plan through conversation — here's what I learned"*
- [x] Draft post ready — see REDDIT_DRAFT.md
- [ ] Post submitted
- [ ] Follow-up comments answered

### Hacker News (Show HN)
- Show HN format: "Show HN: Lever — retirement planning through conversation with Claude"
- Attach a 2-minute demo GIF or video showing the conversation → plan → chart flow
- Post on Tuesday or Wednesday morning EST
- [ ] Demo GIF created
- [ ] HN post submitted

### Twitter / X
- Account: set up @leverfinance or @lever_ai (check availability)
- Content: builder updates, "what I shipped this week", interesting financial facts from the simulator
- Not a priority until community posts land — use as amplification

### YouTube / Loom demos
- Short demo (90 seconds): open Claude → say "help me build my financial plan" → watch it build → show the dashboard
- Longer walkthrough (5 min): full persona journey (Jordan, 24, first job)
- [ ] 90-second demo recorded
- [ ] Posted to YouTube

---

## Outbound & Demo Scheduling

**Demo format:** 20-minute Zoom. Show the conversation flow live. Let them try it.
- Target: financially-minded friends, r/fi members who reply to the post, Twitter followers
- Calendar link: set up Calendly or Cal.com at lever.co/demo (when domain is live)
- Demo script:
  1. Sign in, show empty state
  2. Open Claude, connect Lever, say "help me build my plan"
  3. Answer 5 questions, watch plan appear in dashboard
  4. Show what-if scenario, run Monte Carlo
  5. Show "Open in Claude" for a follow-up question

- [ ] Calendly link set up
- [ ] Demo script written and practiced
- [ ] First 3 demo users scheduled

---

## Feedback & Surveys

**In-app**
- UserJot board: `lever.userjot.com/b/features` — linked in sidebar, guest posting enabled
- Ask Claude to surface UserJot feedback at the start of each session

**User interviews (target: 5 before any serious marketing)**
- 30-min call, record with permission
- Questions: what made you sign up, what did you expect, where did you get confused, would you pay for this, what would make you recommend it
- Offer: first 3 months free premium in exchange for the call
- [ ] 5 user interviews completed
- [ ] Key findings documented here

**Net Promoter Score**
- Simple single-question survey after 7 days of usage: "How likely are you to recommend Lever to a friend? (1–10)"
- Trigger via email at day 7 (requires email integration)
- [ ] Survey set up

---

## Competitions & Accelerators

Apply with the elevator pitch: *"Lever is the first financial planning tool built natively for AI agents — users build retirement plans through conversation with Claude, powered by a deterministic event-based simulator. No advisor, no forms, no spreadsheet."*

**High priority (AI + fintech focus)**
- [ ] **Y Combinator** — apply each cycle. Batch deadline: ~Sep/Mar. Apply early.
- [ ] **Anthropic startup program** — Claude-native products, likely receptive
- [ ] **a16z Speedrun** — early-stage, 2-week accelerator for solo founders
- [ ] **Founders Fund Angels** — smaller checks, founder-friendly
- [ ] **Betaworks** — NYC-based, AI + consumer focus

**Fintech-specific**
- [ ] **MassChallenge Fintech** — no equity taken, cash grants
- [ ] **Plug and Play Fintech** — Silicon Valley, strong network
- [ ] **FinLab EG** — fintech accelerator, global

**Competitions (prize money + visibility)**
- [ ] **Product Hunt Launch** — aim for #1 of the day. Requires preparation (hunters, pre-launch notify list). Do after Monte Carlo and deep-link fixes.
- [ ] **Anthropic hackathons / partner programs** — watch for Claude-specific contests
- [ ] **TechCrunch Disrupt Startup Battlefield** — annual, high-profile, free to enter

---

## Grants

**Non-dilutive funding — apply to all that fit**
- [ ] **SBIR/STTR (NSF)** — Phase I: up to $275k. Lever's financial literacy angle fits NSF's "societal benefit" mandate. Long timeline (6–12 months).
- [ ] **Stripe Atlas + ecosystem grants** — watch for fintech-friendly programs
- [ ] **AWS Activate** — free credits, useful for scaling infra. Easy to apply.
- [ ] **Anthropic API credits** — check if startup credit programs exist for Claude API usage
- [ ] **State-level grants** — Utah (where Mark is based) has USTAR technology grants

---

## Revenue Activities

**Subscription (primary)**
- Free tier: 1 plan, basic projections (conversion funnel top)
- Premium: $12–15/month — multiple plans, what-if, Monte Carlo, document upload
- [ ] Stripe checkout flow working
- [ ] Pricing page live on landing page
- [ ] Upgrade prompt shown at the right moment (after creating second plan or running Monte Carlo)

**Advisor tier (near-term opportunity)**
- $40–60/month per seat — manage multiple client plans
- Admin panel already 80% built
- [ ] Define advisor tier feature set
- [ ] Set up separate Stripe product
- [ ] Reach out to 3 CFPs who might pilot it

**Affiliate / referral**
- When Claude recommends a HYSA, refinance lender, or life insurance product — embed affiliate links
- Lever knows exactly which product matches each user → higher conversion than generic comparison sites
- Programs to join: Marcus HYSA (Goldman), SoFi, Betterment, Wealthfront, PolicyGenius
- [ ] First affiliate program applied for

**Lifetime deal (LTD)**
- AppSumo or similar — one-time payment for lifetime premium access
- Good for cash injection + user base. Run it once, not ongoing.
- [ ] Evaluate after reaching 100 active users

---

## Pitch Deck

For investor conversations, accelerator applications, and competitions.

**Slides needed (keep to 10):**
1. Problem — the spreadsheet that goes stale, the advisor who costs too much
2. Solution — one sentence + one screenshot
3. Product demo — 3 screenshots: conversation → plan → dashboard
4. Market — $629M AI financial planning market, 28.9% CAGR
5. Why now — MCP adoption, Claude's capabilities, Mint's death created a gap
6. Business model — subscription tiers + advisor + affiliate
7. Traction — users, demos booked, feedback quotes
8. Competition — Era (tracking), ProjectionLab (simulation). Lever: both + AI-native
9. Team — Mark Soulier, EE + robotics + software, built it for himself
10. Ask — what you're raising and what you'll do with it

- [ ] Slide deck created (Figma or Google Slides)
- [ ] Demo video embedded in deck
- [ ] One-pager version (PDF) for email attachments

---

## Calendar & Milestones

| Milestone | Target | Status |
|---|---|---|
| Monte Carlo button on plan page | — | Not started |
| Deep-link "Open in Claude" with context | — | Not started |
| Landing page demo video | — | Not started |
| First 3 user interviews | — | Not started |
| Reddit r/fi post | After MC button | Not started |
| ProductHunt launch | After Reddit validation | Not started |
| YC application | Next batch deadline | Not started |
| Advisor tier live | — | Not started |
| First paying customer | — | 🎯 |

---

## Running Log

*Add dated entries as activities happen.*

- **2026-06-02** — SELLING.md created. Synthetic user evaluation completed (t command). Two critical fixes identified before any marketing: Monte Carlo button, deep-link to Claude.
