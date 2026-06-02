# LAUNCH.md — Lever Soft Launch v0.1

## What this is

Lever's first real users. Not a public launch — a controlled soft launch with 2-5 people who fit the target demographic. The goal is to validate the core loop: connect Claude → build a plan → get personal insights → feel like the tool understood your situation.

This is not about metrics yet. It's about learning.

---

## Launch date

2026-05-29

## Version

v0.1 — simulator infrastructure + event-based planning + modular widgets

---

## What's live at launch

**URL:** https://lever-claude.vercel.app

**Core flow:**
1. User signs up at lever-claude.vercel.app (Google or email)
2. The onboarding gate shows them how to connect Lever to Claude.ai as an MCP connector
3. In Claude, they describe their financial situation in plain language
4. Claude builds a plan from the event library (jobs, rent, mortgage, 401k, etc.)
5. The plan dashboard shows: growth projection (event-based simulation), metric cards, dynamic what-if scenarios
6. Claude surfaces gaps, programs they qualify for, and one clear next action

**What's working:**
- Google + email/password auth
- MCP connector (Claude.ai web + Claude Desktop `.mcpb` download)
- Event-based simulator: 100+ life events (get_job, buy_house, outflow, inflow, etc.)
- Deterministic day-by-day simulation with 401k, mortgage amortization, tax withholding
- Growth projection chart driven by simulation results
- Dynamic what-if scenarios (savings increase, market headwind, early/late retirement)
- Financial accounts + net worth tracking
- Document upload with AI summarization
- Push notifications (admin → user)
- Admin panel for manual recommendation workflow

**Known limitations at launch (honest):**
- "Probability of success" is a formula, not a real Monte Carlo probability (tooltip explains this)
- No existing mortgage event — users can model payments but not an already-owned home with a loan balance
- Mobile app is basic (auth + plan list only; native push works on iOS via Expo Go)

---

## Who to invite first

Target: 2-5 people who match the beachhead customer profile.

**Profile:**
- Age 21-35
- Recently started a job, or thinking about buying, or have a retirement account they're not sure about
- Semi-techy — comfortable with apps, willing to try something new
- Would Google "how much should I be saving for retirement" or "is my 401k contribution enough"

**Do NOT invite:**
- Anyone who expects a polished, fully-documented product
- Anyone who would be harmed by incorrect financial projections (remind everyone: sandbox only, not financial advice)
- Anyone with highly complex financial situations (equity comp, self-employment, multiple businesses) — the event library doesn't cover these well yet

---

## How to onboard each user

Walk them through this yourself the first time. Don't just send a link.

### Step 1 — Create account
Send them to: **https://lever-claude.vercel.app**

Have them sign up with Google or email. Takes 30 seconds.

### Step 2 — Connect Lever to Claude.ai
The onboarding gate will show instructions. Two options:

**Claude.ai (easiest):**
1. In Claude.ai → Settings → Connectors → Add custom connector
2. Paste their Lever MCP URL (shown on the gate)
3. Done

**Claude Desktop:**
1. Download the `.mcpb` file from the onboarding gate
2. Double-click to install
3. Done

**Prerequisite:** they need a Claude.ai account (free tier works — free users get 1 custom connector). If they don't have one, have them sign up first.

### Step 3 — Build their plan with Claude
Open Claude, say: *"I just connected Lever. Help me set up my financial plan."*

Claude will ask about their situation — salary, rent or mortgage, retirement accounts, savings. It will build the plan event by event. The dashboard updates in real time.

### Step 4 — Show them the dashboard
After the plan is built, open lever-claude.vercel.app. They should see:
- Their plan in the sidebar
- The growth projection chart with their actual numbers
- What-if scenarios based on their contribution amount
- Metric cards: projected balance, monthly income at retirement, success score

### Step 5 — Send a recommendation
Once they've built their plan, use the admin panel to generate a personalized recommendation:
1. Go to `/admin/users/[their-user-id]`
2. In this Claude Code conversation: call `get_user_context` with their email
3. Run the opportunity scan prompt from PROGRESS.md
4. Review and approve the notification
5. They receive it as a push notification on mobile (if they have the mobile app) or can see it in their account

---

## How to collect feedback

Direct users to UserJot: **https://lever.userjot.com**

After their first session, ask them directly:
1. What did you expect that wasn't there?
2. Did the numbers feel realistic for your situation?
3. What would make you open this again tomorrow?
4. Would you recommend this to a friend?

Log their answers in UserJot as feature requests or bugs. Every session's findings go into BUGS.md and PROGRESS.md.

---

## Disclaimer to give every user

> Lever is a sandbox for financial planning. It is not a licensed financial advisor, does not provide investment advice, and is not a substitute for professional financial guidance. All projections are estimates based on the assumptions you enter. Do not make major financial decisions based solely on what you see here.

Say this out loud or in a message before they use it. It matters.

---

## What success looks like for v0.1

At the end of 2-5 user sessions:
- At least 3 users completed onboarding and have a plan
- At least 1 user received a notification they found useful
- We have specific, actionable feedback on what confused them
- We know which event types were missing for their real situations
- We have at least 2 UserJot entries from real (non-synthetic) users

That's it. Revenue, retention, virality — none of that is the v0.1 metric. The v0.1 metric is: did a real person feel like Lever understood their financial situation and helped them think more clearly?

---

## How to deploy

The app is on Vercel with continuous deployment from the `main` branch.

**To deploy a change:**
```bash
git add <files>
git commit -m "description"
git push origin main
```

Vercel builds and deploys automatically. Takes 1-3 minutes. Check at: https://vercel.com/dashboard

**Production URL:** https://lever-claude.vercel.app
**MCP endpoint:** https://lever-claude.vercel.app/api/mcp

**Database:** Single Supabase project (`avzhlaxhopzmrjnmregc`) shared between dev and prod. All migrations run against this project.

**Environment variables on Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL` — project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS (never in client bundle)
- `STRIPE_SECRET_KEY` — server-only Stripe API key
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks
- `ANTHROPIC_API_KEY` — for document summarization and `read_document` tool
- `EXPO_PUBLIC_API_URL` — mobile app API base URL (set to `https://lever-claude.vercel.app`)
- `ADMIN_EMAILS` — comma-separated list of admin email addresses

---

## After the soft launch — what comes next

Based on what we learn from the first 2-5 users:
1. Fix what confused them (add to BUGS.md, prioritize)
2. Add missing event types they needed (existing mortgage, equity comp, etc.)
3. Improve the insights Claude surfaces (more specific to their situation)
4. Iterate on the onboarding (reduce steps, improve clarity)
5. Consider submitting to the Claude connectors directory when the loop is proven

Do not build new features until real user feedback tells you what to build.
