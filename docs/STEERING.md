# STEERING.md

This document steers product decisions for Lever's core planning engine — the simulator, the account model, the event library, and the AI interaction model. It is the authoritative source for what the product *is*, how the core mechanics work, and what quality means. It is not a business plan or implementation guide.

---

## Core concepts

### The financial plan

A plan is the atomic unit of the product. It contains:

- **events[]** — time-ordered life events (job, rent, purchase, loan, etc.)
- **accounts[]** — money buckets with growth characteristics
- **context** — birth date, location, occupation, goals, inflation rate

The plan is a data structure the AI reads and writes. It is the source of truth for the simulation.

### Accounts

Accounts are the atomic unit of wealth in the simulator. Everything — cash savings, a mortgage, a retirement fund, a car — is an account. Each account has:

| Field | Values |
|---|---|
| name | User-defined (e.g. "Checking", "Roth IRA", "Car Loan") |
| category | Cash · Debt · Assets · Savings · Investments · Retirement · Tax |
| growth type | None · Appreciation · Depreciation · Daily/Monthly/Yearly Compound |
| growth rate | Annual rate (e.g. 0.07 for 7%) |
| account_type | regular · system-controlled · non-networth |

All financial value in the plan lives in accounts. Events move money into, out of, and between accounts, or change their growth behavior over time.

### The event library

The event library is a curated set of 100+ modular life events. Each event is defined by a static schema entry containing:

- **type** — unique identifier (e.g. `get_job`, `buy_house`, `outflow`)
- **category** — groups related events (Income, Housing, Debt, Insurance, etc.)
- **parameters** — typed inputs (salary, pay period, interest rate, start date, target account)
- **updating_events** — sub-events that trigger at future dates (a raise 18 months in, a rate change, a bonus)
- **event_functions** — toggleable behaviors on the event (e.g. enable/disable 401k on a job event)

The AI never invents event types. It selects from the library, reads the parameter schema for the chosen type, and populates parameters based on what the user has described.

**Example events by category:**

| Category | Event types |
|---|---|
| Income | `get_job`, `get_wage_job`, `start_business`, `inflow` |
| Housing | `buy_house`, `outflow` (rent), `sell_house` |
| Debt | `loan`, `loan_amortization`, `pay_loan_early` |
| Insurance | `buy_health_insurance`, `buy_life_insurance` |
| Retirement | `roth_ira_contribution`, `change_401k_contribution` |
| Life | `marriage`, `have_kid`, `pass_away` |
| Tax | `usa_tax_system`, `federal_subsidized_loan` |
| Misc | `transfer_money`, `declare_accounts`, `manual_correction` |

### The simulator

Day-by-day deterministic simulation:

1. Initialize all accounts with starting balances from the plan
2. For each day from today to end date:
   - Apply growth to each account (compound interest, appreciation, depreciation)
   - Check each event: if triggered today, execute it (inflows, outflows, transfers, parameter changes)
   - Record a snapshot: total net worth + per-account balances
3. Output: a time series the UI visualizes as a net worth timeline

The simulator is **deterministic** — same plan always produces the same output. This is the foundation of reliable what-if analysis. Determinism is only meaningful if proven by tests (see Quality section).

**Growth models:**
- `None` — balance unchanged by growth
- `Daily Compound` — `balance × (1 + annualRate / 365)` each day
- `Monthly Compound` — equivalent daily rate derived from monthly rate, applied daily
- `Yearly Compound` — applied only on year boundaries
- `Appreciation` — same math as compound; used for assets
- `Depreciation` — balance decays; linear or compound depending on type

---

## AI interaction model

### Continuous plan building

The AI builds the plan incrementally throughout the conversation — not in one batch at the end. Each financial fact the user states is immediately translated into a plan update. The user's plan becomes more accurate in real time as the conversation progresses.

Flow per new fact:

```
User states a financial fact
  → AI identifies candidate event type(s) from the library
  → AI calls get_event_schema to confirm parameter requirements
  → AI calls update_plan to add or update the event
  → Plan is validated and simulation re-runs
  → AI incorporates the updated outlook into its next response
```

### Conversation → event mapping

When a user describes their financial situation in natural language, the AI maps each fact to one or more events:

| User says | Event type | Notes |
|---|---|---|
| "I rent for $750/month" | `outflow` | amount=750, monthly, → housing account |
| "Moving in 3 months to $1,200 rent, utilities included" | `update_amount` (updating_event on rent outflow) + end utilities outflow | triggers at +3mo |
| "$80/month utilities right now" | `outflow` | amount=80, end_time=+3mo |
| "70K salary biweekly" | `get_job` | salary=70000, pay_period=14 |
| "$400/month rental income" | `inflow` | amount=400 |
| "$1,300/month mortgage on rental property" | `loan_amortization` | principal, rate, term (ask for missing details) |
| "Pay my own health insurance" | `buy_health_insurance` | monthly_premium (ask for amount) |
| "Employer has a 401k for me" | `change_401k_contribution` as updating_event on `get_job` | contribution%, match% (ask if not stated) |

### Iterative refinement

The AI tracks which parameters are explicitly stated vs. inferred. For critical parameters (tax rates, interest rates, contribution percentages) it asks targeted follow-up questions — one at a time, in context — rather than presenting a long intake form.

Each answer triggers `update_plan` and a re-simulation. The AI surfaces the impact of each new fact ("adding your mortgage changes your monthly net cash flow by −$X and your projected balance at retirement by −$Y").

As the plan grows, the AI continues refining:
- If the user mentions a change ("I got a raise"), the AI finds the relevant event and adds an `updating_event` at the right date
- If the user corrects a fact, the AI calls `update_plan` with `update_field` on the relevant parameter
- If a stated fact conflicts with an existing event, the AI flags it and asks which is correct

### The AI's role: guide, not builder

The AI must not build the plan silently on the user's behalf. A plan the user didn't author is a plan the user doesn't own — they won't understand it, won't trust it, and won't maintain it when life changes.

The AI's role is to guide the user into building it themselves. In practice:

- Before calling `update_plan`, the AI explains in plain language what it's about to add and why — then waits for confirmation. It does not call the tool as a silent background action.
- Critical parameters must be stated by the user, not inferred. If a required value is missing, ask for it. Do not default silently and move on.
- Each new event is an opportunity to teach. When adding a mortgage event: "A fixed-rate mortgage locks your payment for the full term — the interest rate you enter here has a large long-term impact. What rate did you get?" The user learns as they build.
- The AI never makes a financially significant assumption without surfacing it: "I assumed a 22% federal tax rate based on your salary — is that roughly right?"

The measure of a good conversation is not how fast the plan gets built. It is whether the user understands their own financial picture better at the end than they did at the start — because they built it.

---

## Value delivery

The simulation is not the product. It is a means. A precisely accurate model that a user looks at once and closes delivers zero value. Value is delivered when the user understands something they didn't know before, or takes an action they wouldn't otherwise have taken.

Once the AI has a reasonably complete picture of the user's financial life — enough events in the plan that the simulation reflects reality — it should actively surface what the user cannot find on their own.

### Gaps the user doesn't know they have

The AI knows the plan. It knows what's missing. It should name it:

- Not contributing enough to capture the full employer 401k match → flag it, quantify the annual dollar loss
- No emergency fund → flag it, explain the risk, suggest a concrete target
- No life insurance with dependents in the plan → surface the gap
- Eligible for an HSA but not using one → surface it with the tax benefit explained
- Carrying high-interest debt while also investing in low-yield savings → flag the math

These are not suggestions. They are findings — things the user's own plan makes visible that the user did not notice.

### Programs and resources they likely qualify for

The AI knows the user's income, location, life stage, and financial structure. It can surface:

- **Federal**: first-time homebuyer tax credits, IRA contribution windows, income-driven student loan repayment, EITC eligibility, CDFI loan programs
- **State-specific**: down payment assistance, state tax credits, property tax exemptions for first-time buyers
- **Employer**: benefits the user may be leaving untouched — FSA, commuter benefits, legal insurance, supplemental disability

These should be surfaced as specific findings tied to the user's actual plan, not a generic resource list.

### Concepts the user should understand but probably doesn't

The AI should teach in context, not in the abstract:

- "You're paying PMI on this mortgage. That's an extra ~$X/month that disappears once you hit 20% equity — here's when your plan projects that happening."
- "Your effective federal tax rate is around 14%, not 22%. The 22% is only on income above a threshold. This affects how you should think about a Roth vs Traditional 401k."
- "Your employer match vests over 3 years. If you left before then, you'd lose some of it — your plan currently doesn't model that risk."

Each of these is a thing the user didn't know, made visible by their own plan.

### One clear next action

Every session should produce a specific thing the user can do within the next week. Not a direction — an action:

- "Call HR and increase your 401k contribution from 4% to 6% — that's the threshold to capture your full employer match, which is worth $X/year."
- "Open a high-yield savings account for your emergency fund. Your plan shows you have $X available monthly — putting $Y of that here gets you to 3 months of expenses in Z months."

The AI has enough context at this point to give advice that is specific to this person's situation and that they would not find with a generic Google search. That specificity is the differentiator.

---

## MCP tool interface

### Design principle: modular tools

Each tool is independently registered. Tools can be added, removed, or versioned without touching other tools or the server. This keeps iteration fast — a new tool is a new file, not a refactor.

### Current tools

| Tool | Purpose | Key operations |
|---|---|---|
| `get_event_schema` | Browse the event library | No args → list of all event types with descriptions; with `event_type` → full parameter schema |
| `get_plan` | Read the current plan | Returns events[], accounts[], context fields |
| `update_plan` | Modify the plan | `add_event` · `remove_event` · `update_field` |

Additional tools are registered as the product grows (e.g. `get_simulation_results`, `run_scenario`, `get_account_history`). Each new tool is narrow and composable — it does one thing well.

### Validation on every update

Before any `update_plan` operation completes, the plan is validated:

- Unknown event type → error returned to AI
- Missing required parameter → error returned to AI
- Invalid account reference → error returned to AI
- Duplicate event ID → error returned to AI

Errors surface in the MCP tool response. The AI corrects and retries. The simulator never runs on an invalid plan.

---

## Quality requirements

### Simulator — Jest unit tests per event handler

Every event handler must have unit tests with known inputs and asserted outputs. Tests are what make "deterministic" a real claim.

**Required coverage:**

| Event | What to assert |
|---|---|
| `get_job` | Take-home pay per paycheck, 401k balance after N days, tax withholding amounts |
| `get_wage_job` | Same as get_job, plus hourly × hours/week math |
| `buy_house` | Monthly mortgage payment, account balances at close, interest paid over term |
| `loan_amortization` | Amortization schedule, payoff date, total interest |
| `outflow` (recurring) | Account balance decreases correctly over 6/12/24 months |
| `inflow` (recurring) | Account grows correctly with stated frequency |
| `buy_health_insurance` | Monthly premium deducted from correct account |
| `updating_events` | Sub-event triggers on correct day, modifies parent parameters correctly |

### Plan validation — unit tests per rule

Every validation rule in the schema checker must have a passing case and a failing case. Structural validity must be provable without running the full simulation.

### Static values for MVP — live data planned

For MVP, tax rates, contribution limits, and interest rate benchmarks are static values embedded in the event schema. The architecture must allow swapping these for live data (IRS tables, Fed rates, market indices) without rewriting event handlers. When live data is connected, the accuracy of the simulation against real-world baselines becomes a measurable standard.

---

## Modular visualization widgets

### The principle: widgets are independent units the AI composes

The UI is not a single dashboard the user passively reads. It is a library of focused, independently testable visual widgets that the AI chooses to show based on what the conversation calls for. The AI is the orchestrator — it decides which widgets are relevant, when to show them, and in what combination.

Each widget:
- Does one thing and shows one thing
- Is a standalone iframe with a clean data API (no shared state with other widgets)
- Can be added or removed from the experience without touching other widgets
- Can be tested in isolation — open its URL directly, pass it data, verify it renders correctly
- Is registered in the MCP server as a resource and an app tool (same pattern as the current `plan-widget` and `scenario-widget`)

The user never manually opens a widget. The AI opens them in context: when discussing retirement risk, show the confidence band; when discussing monthly cash flow, show the cash flow chart; when comparing two scenarios, show the comparison view. The right visualization for the question being asked, not the same dashboard every time.

### Widget registry (current and planned)

| Widget | Purpose | When the AI shows it |
|---|---|---|
| `plan-timeline` | Growth projection chart with event markers | When user asks to see their plan or projected balance |
| `scenario-comparison` | Side-by-side primary vs what-if chart | When comparing two plans or running a "what if" question |
| `cash-flow-monthly` | Bar chart of monthly income/expense for the next 1–3 years | Short-term budgeting questions; "can I afford X?" |
| `confidence-band` | Monte Carlo output: shaded 10th–90th percentile range around the expected path | Long-term retirement questions where uncertainty matters |
| `account-breakdown` | Account balances by category with growth types | When reviewing net worth composition |
| `retirement-readiness` | Scorecard: target, projected, gap, real success probability | When the user asks "am I on track?" |
| `event-calendar` | Timeline of upcoming financial events (next raise, childcare ending, loan payoff) | When planning near-term cash flow or life changes |

New widgets are added as files — one route, one purpose. They do not require changes to existing widgets or the core plan data model.

### Monte Carlo: AI-triggered, not system-triggered

The deterministic day-by-day simulator runs on every `update_plan` call. It is the primary engine — it produces the expected path, the event timeline, and the scalar outputs the UI reads.

Monte Carlo is **not** run on every update. The AI decides when it is relevant based on the conversation:

| User asks | AI decision |
|---|---|
| "Add my rent payment to the plan" | Do not run Monte Carlo. Deterministic update only. |
| "What are my chances of retiring comfortably?" | Run Monte Carlo. Show `confidence-band` widget. |
| "I'm worried about a market downturn — how bad could it get?" | Run Monte Carlo with stressed variance. Show `confidence-band`. |
| "Can I afford to move in 3 months?" | Do not run Monte Carlo. Short-term cash flow is a precision question. |
| "Should I choose Roth or Traditional 401k?" | May run Monte Carlo if the answer depends on sequence-of-returns over decades. |

Monte Carlo is exposed as its own MCP tool: `run_monte_carlo`. It wraps the deterministic simulator, runs N iterations with randomized annual returns drawn from a historical distribution (mean ≈ 7%, σ ≈ 12% for a balanced portfolio), and returns confidence intervals. The AI calls it intentionally when the user's question requires an honest uncertainty estimate.

**The output of `run_monte_carlo`:**
- `p10`, `p50`, `p90`: balance at retirement across the distribution of scenarios
- `success_rate`: % of runs where the retirement balance meets the target (replaces the current synthetic formula)
- `worst_case`: the 5th percentile outcome — the number that answers "how bad could it get?"
- `confidence_band`: the data the `confidence-band` widget renders as a shaded range on the timeline

**Why the AI decides and not the system:**
The system cannot know whether the user's question is about near-term precision or long-term probability. The AI can. Forcing Monte Carlo on every update adds ~2 seconds of compute for updates where the user is asking about rent, not retirement odds. The AI asking "what is the user trying to understand right now?" is exactly the kind of judgment that belongs in the LLM layer, not the infrastructure layer.

---

## Simulator infrastructure

This section defines how the sophisticated planning engine integrates into the app. The source material lives in two sibling projects:

- **`/home/yocto/work/lever-mcp`** — the MCP server with `event_schema.json` (100+ event definitions) and the `get_event_schema` / `update_plan` tool implementations
- **`/home/yocto/work/modal-canvas-flow`** — the React app with `simulationRunner.ts` (910-line day-by-day simulator) and `schemaChecker.ts` (plan validation)

These are the canonical references. When porting into this Next.js app, pull from those files — do not rewrite from scratch.

### The `plan_data` column

The plans table currently has scalar fields (`monthly_contribution`, `projected_balance`, `assumed_return`, etc.) computed by a simple compound-interest formula. These are the *output* of a naive model. The sophisticated simulator replaces that model.

The plans table needs one new column:

```sql
alter table plans add column plan_data jsonb;
```

`plan_data` is the full rich plan the simulator consumes. The scalar columns remain for now as a compatibility layer — they are updated by writing the simulation result back. Eventually they become derived views of `plan_data`.

### `plan_data` JSON structure

```jsonc
{
  // Personal context
  "birth_date": "1995-03-12",       // ISO date — simulator converts to days
  "location": "Austin, TX",
  "occupation": "Software Engineer",
  "goals": "Retire at 60 with $80k/year income",
  "inflation_rate": 0.03,
  "adjust_for_inflation": true,

  // Accounts — money buckets with growth characteristics
  "accounts": [
    {
      "name": "Checking",
      "category": "Cash",           // Cash | Debt | Assets | Savings | Investments | Retirement | Tax
      "growth": "None",             // None | Appreciation | Depreciation | Daily Compound | Monthly Compound | Yearly Compound
      "rate": 0,
      "account_type": "regular"     // regular | system-controlled | non-networth
    },
    {
      "name": "401k",
      "category": "Retirement",
      "growth": "Yearly Compound",
      "rate": 0.07,
      "account_type": "regular"
    },
    {
      "name": "Mortgage",
      "category": "Debt",
      "growth": "None",
      "rate": 0,
      "account_type": "regular"
    }
  ],

  // Events — time-ordered life events the simulator executes
  "events": [
    {
      "id": 1,
      "type": "get_job",
      "title": "Software Engineer",
      "description": "",
      "is_recurring": false,
      "hide": false,
      "parameters": [
        { "id": 0, "type": "start_time", "value": "2024-01-15" },
        { "id": 1, "type": "end_time",   "value": "2055-01-15" },
        { "id": 2, "type": "salary",     "value": 70000 },
        { "id": 3, "type": "pay_period", "value": 14 },
        { "id": 4, "type": "federal_income_tax", "value": 0.22 },
        { "id": 5, "type": "state_income_tax",   "value": 0.05 },
        { "id": 6, "type": "p_401k_contribution", "value": 0.06 },
        { "id": 7, "type": "p_401k_match",        "value": 0.03 },
        { "id": 8, "type": "to_key", "value": "Checking" },
        { "id": 9, "type": "p_401k_key", "value": "401k" }
      ],
      "event_functions": [
        { "type": "enable_401k", "title": "Enable 401k", "enabled": true }
      ],
      "updating_events": [
        {
          "id": 2,
          "type": "get_a_raise",
          "title": "Annual raise",
          "is_recurring": true,
          "parameters": [
            { "id": 0, "type": "start_time",     "value": "2025-01-15" },
            { "id": 1, "type": "end_time",        "value": "2055-01-15" },
            { "id": 2, "type": "frequency_days",  "value": 365 },
            { "id": 3, "type": "raise_amount",    "value": 3000 }
          ]
        }
      ]
    },
    {
      "id": 3,
      "type": "outflow",
      "title": "Rent",
      "is_recurring": true,
      "parameters": [
        { "id": 0, "type": "start_time",    "value": "2024-01-01" },
        { "id": 1, "type": "end_time",      "value": "2027-06-01" },
        { "id": 2, "type": "amount",        "value": 750 },
        { "id": 3, "type": "frequency_days","value": 30 },
        { "id": 4, "type": "from_key",      "value": "Checking" }
      ],
      "updating_events": []
    }
  ],

  // Simulation output — written back after each run; never hand-edited
  "simulation_results": [
    { "date": 10957, "value": 12400, "parts": { "Checking": 4200, "401k": 8200 } }
    // ... one entry per day
  ]
}
```

**Key rules:**
- `parameters` is always an array of `{ id, type, value }` — never a plain object
- `id` fields must be unique within the events array (use `max(id) + 1` for new events)
- `simulation_results` is computed by the simulator; MCP tools never write to it directly
- Date parameter values are ISO strings; the simulator converts them to days-since-birth internally

### The simulator

**Source:** `/home/yocto/work/modal-canvas-flow/src/hooks/simulationRunner.ts`

Port this file into `lib/simulator/runner.ts` in this Next.js app. It is TypeScript, runs server-side (no browser APIs), and has no external dependencies beyond the plan and schema structures.

The simulator entry point:

```ts
runSimulation(plan: Plan, schema: Schema, startDate: number, endDate: number): Promise<SimulationResult[]>
```

Where `SimulationResult` is `{ date: number; value: number; parts: Record<string, number> }`.

After any `update_plan` MCP call that modifies `plan_data.events` or `plan_data.accounts`, the server runs the simulator and writes `simulation_results` back into `plan_data`. The scalar columns (`projected_balance`, `success_probability`, `monthly_income_at_retirement`) are then derived from the last simulation result and written back to keep the existing UI working.

**Do not run the simulator on the client.** It iterates day-by-day over decades — too slow for the browser. It runs in the API route handler that processes `update_plan` calls.

### The event schema

**Source:** `/home/yocto/work/lever-mcp/event_schema.json`

Copy this file into `lib/simulator/event_schema.json`. It is the static source of truth for all valid event types. It does not change at runtime.

The schema serves two purposes:
1. **Validation** — before any event is added to `plan_data`, its type and parameters are validated against the schema (port `schemaChecker.ts` from modal-canvas-flow into `lib/simulator/schema-checker.ts`)
2. **AI browsing** — the `get_event_schema` MCP tool reads this file to tell Claude which event types exist and what parameters they require

### New MCP tools required

These sit alongside the existing tools. The existing `create_plan`, `show_financial_plan`, etc. remain and continue to work against the scalar columns. The new tools work against `plan_data`.

| Tool | What it does |
|---|---|
| `get_event_schema` | No args: returns list of all event types with display name + description. With `event_type`: returns full parameter schema for that type. Reads from `event_schema.json`. |
| `update_plan` | Modifies `plan_data.events`. Operations: `add_event` (appends a new event), `remove_event` (removes by id), `update_field` (updates a single parameter value by type). After every call: validates against schema, runs simulator, writes results back, updates scalar columns. |
| `get_plan_data` | Returns the full `plan_data` JSON so Claude can read the current event list and account configuration. |

Each tool is a separate file in `app/api/mcp/tools/`. Same modular registration pattern as existing tools.

### Scalar column bridge

While the existing UI reads scalar columns (`projected_balance`, `success_probability`, etc.), those fields must be kept in sync after every simulator run. The bridge function lives in `lib/simulator/bridge.ts`:

```ts
function simulationToScalars(results: SimulationResult[], plan: Plan): Partial<DbPlanRow>
// Derives: projected_balance, success_probability, monthly_income_at_retirement
// from the final simulation result entry
```

When the rich simulator and the old simple model diverge, the simulator wins. The scalars are its outputs, not inputs.

### What "plan is complete enough to simulate" means

Not every plan needs all 100+ event types. The minimum viable `plan_data` for a meaningful simulation:

1. At least one income event (`get_job`, `get_wage_job`, `inflow`) with a `start_time`
2. At least one account configured to receive income (`to_key` references a real account name)
3. A `birth_date` in the plan context

Without these, the simulator runs but produces a flat zero line. The `get_event_schema` MCP tool should tell Claude this explicitly in its description.

---

## What this document does not cover

- Business model, pricing, or target market → see `BUSINESSPLAN.md`
- Tech stack choices (Next.js, Supabase, Expo) → see `BUSINESSPLAN.md` and `CLAUDE.md`
- Dashboard visual design or UI component decisions → design spec (future)
- Admin panel workflow → see `AGENTS.md`
- Current sprint priorities → see `PROGRESS.md`
