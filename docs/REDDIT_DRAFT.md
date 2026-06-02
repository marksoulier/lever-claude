# Reddit Post Draft — r/financialindependence

**Status:** Ready to post. Review and personalise before submitting.
**Target subreddit:** r/financialindependence (primary), r/personalfinance (secondary, same week)
**Best time to post:** Tuesday or Wednesday, 8–10am EST
**Account:** Use personal account, not a brand account. Authenticity matters here.

---

## Title options (pick one)

**A (recommended):**
> I got tired of spreadsheets going stale so I built a financial planning tool that works through conversation with Claude — here's what I learned

**B:**
> Built a retirement simulator where you just talk to Claude — it builds the event model for you

**C:**
> Show r/fi: I built a DIY financial planning tool powered by Claude MCP — conversation-first, no forms

---

## Post body

---

I'm a software engineer. A few months ago I was trying to figure out some real financial decisions — job offers, renting vs. buying, what my retirement looked like if I started contributing seriously now — and I kept running into the same problem.

The tools that existed were either too simple (plug in salary, get a number, doesn't account for anything real) or too complex to actually maintain. I'd open my retirement spreadsheet, update two cells, feel good for a day, and then not touch it for six months. The plan went stale. Life kept changing. The spreadsheet didn't.

So I built something for myself. I'm calling it **Lever**.

**The core idea:**

Instead of filling out forms, you open Claude and just talk. "I make $78k a year, I'm renting at $1,400/month, I've got $22k in a Roth IRA, I want to retire at 62." Claude has a connector to a financial simulator I built — it takes what you say and builds a real event-based model. Salary events, rent outflows, mortgage amortization, childcare costs, 401k contributions, all of it. The model reruns every time you add something.

The result shows up on a dashboard: projected balance at retirement, probability of success (real Monte Carlo — 500 scenarios with randomized annual returns, not a fake percentage), what-if scenarios if you retire earlier or save more.

**What it's not:**

Not a financial advisor. Not investment advice. It's a sandbox for running numbers on your own life. Think of it like ProjectionLab but you build the model through conversation instead of forms.

**What I've learned building this:**

The deterministic simulator is the thing I'm most proud of. Events are modular — buy_house, have_kid, outflow for rent, loan amortization for an existing mortgage. Same inputs always produce the same outputs, so you can trust the what-if comparisons. I started with a simple compound-interest formula and replaced it with a day-by-day simulation that handles variable income, amortization schedules, and inflation-adjusted expenses.

The Monte Carlo component was interesting. Rather than running it on every update (too slow), the AI decides when it's relevant — when you ask "what are my real chances" vs. "add my rent payment." I use historical market distribution: 7% mean, 12% standard deviation. It gives you p10 through p90 and a real success rate.

The onboarding friction is real and I'm still working on it. You have to connect Claude to the app yourself. The r/fi crowd handles that, but it's a barrier for less technical users.

**Current state:**

It's live and free to try. Event library has 40+ life event types including existing mortgages, childcare costs, student loans, job changes, salary schedules. The dashboard shows net worth history, plan projections, and what-if comparisons.

If anyone wants to try it or give feedback I'd genuinely appreciate it — especially from people who already use ProjectionLab or have built their own spreadsheet models. I want to know where the numbers feel wrong or where the model doesn't match your situation.

Happy to answer questions about how the simulator works, the MCP setup, or anything else.

**Link:** [lever.co](https://lever.co) *(update with real URL before posting)*

---

*Edit: to clarify how the Claude connector works — you go to claude.ai, add the Lever connector (takes about 2 minutes), and then you just talk to Claude normally. The conversation is stored as a structured plan you can come back to. You don't interact with the app directly to build the plan — Claude does that for you.*

---

## Comment responses to prepare

**"How is this different from ProjectionLab?"**
> ProjectionLab is excellent — I use it as a benchmark. The difference is the interface. PL has you filling forms. Lever lets you describe your situation conversationally and Claude extracts the structure. The math underneath is similar (day-by-day deterministic simulation, Monte Carlo). Where PL wins: tax optimization, estate planning, Roth conversions. Where Lever is different: the conversation builds the plan incrementally, so if you say "I'm moving to a cheaper city next year" it figures out what events that touches without you knowing the data model.

**"Why Claude specifically?"**
> Claude's MCP (Model Context Protocol) lets external apps register as tools Claude can call. My simulator runs as an MCP server — Claude calls it with structured event data and gets back precise numbers it can report back to you. It means the AI is working from a real deterministic model, not hallucinating projections.

**"Is this open source?"**
> Not yet, but I'm considering it. The event schema and simulator are the interesting parts.

**"What's the business model?"**
> Free tier for one plan. Premium for $12-15/month unlocks multiple plans, full what-if comparison, and document upload (tax forms, pay stubs — Claude can read them for context). Still early.

**"The Monte Carlo assumptions seem arbitrary"**
> Fair. I'm using 7% mean / 12% std dev based on long-run US blended portfolio data. You can override both in the tool call. Happy to discuss the assumptions in more detail — this is exactly the kind of feedback I want.

---

## Pre-post checklist

- [ ] Real URL is live at lever.co (or update with actual URL)
- [ ] Signed up for an account yourself recently and the flow works end-to-end
- [ ] Onboarding takes under 10 minutes for a technical user
- [ ] Monte Carlo shows up correctly on at least one plan
- [ ] Respond to every comment in the first 2 hours (critical for r/fi algorithm)
- [ ] Have a second tab open with the app to demo things people ask about
- [ ] Don't post during a big market news day (attention goes elsewhere)

---

## Cross-post timing

Post r/financialindependence first. Wait 48 hours. Then post a modified version to r/personalfinance with less FIRE-specific language — swap "FIRE" references for "retirement planning" and lead with the practical use case (renting vs. buying, first job) rather than early retirement angle.
