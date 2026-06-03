# CONVERSATION.md — MCP Experience Design

How to write the action strings in `get_onboarding_status` (and other MCP tools) so users have meaningful, valuable experiences with Lever through Claude. This is a living document — revisit it whenever the onboarding or ongoing experience feels off.

The core truth: **the action strings in `app/api/mcp/route.ts` are the product.** They are the difference between Claude feeling like a form and Claude feeling like a trusted advisor. Every meaningful improvement to how users experience Lever runs through these strings.

---

## What we've learned so far

### 1. Open with the concern, not the intake

The single highest-impact change is what Claude asks first.

**Old:** "Tell me about where you're at right now — what does your work situation look like?"
**New:** "What's the biggest financial thing on your mind right now?"

The concern question is goal-first, emotionally resonant, and gives the user permission to say what's actually worrying them. Income, age, and savings come after. Whatever they say in response — debt, retirement anxiety, not knowing where to start — becomes the thread the entire conversation follows.

Source: financial advisor research. Whether a client will work with you depends on how understood they feel. Rapport before data.

### 2. Listen fully before asking the next question

One question at a time. Let them answer fully before moving on. If they mention something important (a job change, a specific fear, a life event), follow that thread before switching topics. The pattern: ask → shut up → reflect back → repeat.

Don't interrupt with follow-up data questions while they're telling you something meaningful. You can come back for the salary. You can't recreate the moment where they told you what they're actually scared of.

### 3. Reflect back before building anything

Before calling `create_plan`, Claude should pause and say back what it heard:

> "Before I build this, let me make sure I've got it right — [2–3 sentence portrait of who they are, what they earn, what they're worried about, what they're aiming for]. Does that sound right?"

Wait for confirmation. This does three things: catches errors, makes the user feel genuinely heard, and creates a moment of "yes that's me" that converts a cautious new user into someone who trusts the tool.

### 4. The narrative is the memory — write it richly

The `narrative` field in `update_plan_context` is where the full financial portrait lives. It is the only context a future Claude session has about who this person is beyond the raw numbers.

**Bad narrative** (what we had before):
> "Married with 2 kids. $95k salary. Mortgage $1,650/month."

Only her income. Husband gone. No emotional context. No behaviors. Future session starts cold.

**Good narrative** (what we want):
> "Maria (34, marketing director, $115k) and her husband David (35, $85k) — combined $200k household. Two kids, childcare $1,800/month for 4 more years. Mortgage at 6.8% with $340k remaining. Maria has a 401k with $85k saved, contributing 3% despite a 6% employer match. Moved money around during the 2022 downturn and describes market drops as stressful. Target: retire at 55. Primary worry: savings rate too low for that timeline."

The instruction to Claude: **"Write it like you're briefing a colleague who will advise this person next time."** Not a summary. Not bullets. A portrait.

Specific things that must be in a good narrative:
- Both people if it's a household, with individual incomes named
- Key constraints (debt amounts and rates, dependents, housing costs)
- Behavioral signals (how they react to market drops, have they avoided this before)
- What they're worried about, in their own framing
- The retirement target and what "financial freedom" means to them
- Any specific opportunity or gap flagged during the conversation

### 5. Joint finances = one plan, combined household

If the user mentions a partner, the plan is theirs together. Use combined household income as `annual_income`. Name both people in the narrative. Do not create separate plans per person — that splits the picture and makes the projections meaningless.

### 6. Close every session with a summary and one action

After the plan is created:

> "Here's what we set up: [one sentence]. Here's the one thing worth doing this week: [specific action, not a direction]."

The action must be concrete and doable in under 30 minutes. Not "consider increasing your 401k contribution" — instead: "Log into your benefits portal and change your 401k from 3% to 6%. It takes about 4 minutes."

### 7. Frame the ongoing relationship

At the end of setup, Claude should say something like:

> "Come back any time something changes — a new job, a raise, a big purchase, or just wanting a second opinion on a decision. I'll pick up right where we left off."

This signals that Lever is a relationship, not a one-time calculator. It's what separates recurring users from drive-bys.

### 8. After setup: proactive intelligence, not silence

When `isComplete: true`, Claude must not say "you're all set." That's a wasted moment. Instead: immediately surface 2–3 findings tied to the user's actual numbers without being asked. The format:

> "Finding 1: [what it is] — [why it applies to your specific income/age/accounts] — [what to do]."

This is the moment Lever proves its value. A generic tip (apply to anyone) is worse than silence. A finding tied to their real numbers is what makes users feel like they have an expert watching their back.

---

## Principles (from financial advisor research)

These are the underlying principles that inform everything above. Come back here when deciding how to write new action strings.

| Principle | What it means in practice |
|---|---|
| Understood ≠ processed | A user who fills out fields feels processed. A user whose concern was acknowledged, reflected back, and followed up on feels understood. The goal is understood. |
| Concern before data | Ask what's on their mind before asking for their salary. The emotional context shapes everything. |
| One question at a time | Multiple questions in one message signals interview mode. It kills the feeling of a real conversation. |
| Reflect before building | Always confirm your understanding before taking action. It catches errors and builds trust. |
| Dual success metrics | Users care about both numbers (projected balance) and feelings (confidence, clarity, not stressed). A good session delivers both. |
| Narrative is memory | The quality of the next session depends entirely on the quality of what this session records. A thin narrative wastes the conversation. |
| Close with one action | Every session should end with something the user can do in the next 7 days. Not a direction — an action. |
| Monthly touchpoints, quarterly reviews | Users disengage when they don't know if they're making progress. Lever needs a recurring reason to return. |

---

### 9. Returning users — pick up, don't restart

When a user returns to a new Claude conversation, `get_onboarding_status` now detects whether their primary plan is older than 24 hours. If so, it routes to a different action string: **"Returning user — pick up where you left off."**

The returning-user action tells Claude to:
1. Call `get_plan_data` first — read the narrative before saying anything
2. Greet them by name/situation from the narrative (not generically)
3. Ask what's changed since last time — don't assume
4. Listen before delivering any insight
5. Only then offer one proactive observation if there's a clear gap

The summary line also changes: instead of "Deliver proactive insights now," returning users see "Returning user. Plan created X day(s) ago. Read their narrative and greet them personally — do not start cold."

**The measure:** a returning user should feel like they're talking to someone who remembered them, not like they're starting over.

---

## What we haven't built yet (backlog)

These are identified improvements not yet implemented. Pick them up in future sessions.

### Session summaries
After any meaningful conversation that changes the plan — adding an event, updating an account, running a what-if — Claude should close with a brief summary:
- What changed
- What the new numbers show
- What the user should do next

Currently Claude just responds and the conversation ends. There's no persistent record of what was decided.

### Quarterly check-in prompt
A push notification or in-app nudge: "It's been 3 months. Your plan assumed a 3% raise this year — did that happen? Any life changes to add?"

Users who return are users who retain. The monitoring loop doesn't have to be fully automated — even a prompt that says "it's been a while, want to check in?" moves the needle.

### ~~"Now what?" nudge on the plan page~~ ✅ Done (2026-06-03)
`NowWhat` component at bottom of plan page. Generates 2–3 nudges based on shortfall/surplus, savings rate, and whether events are modeled. Each has a pre-written Claude prompt with real numbers. Addresses UserJot item #6.

### Multi-session continuity
When a user returns, Claude should not start from scratch. The `get_user_context` tool exists — the question is whether Claude is instructed to use it proactively at the start of returning sessions. Currently it only gets called if the user or Claude thinks to ask. It should be surfaced in the `get_onboarding_status` returning-user action.

### Variable/non-standard income
Self-employed, freelance, seasonal, stipend — the current flow forces a single annual income figure which is wrong for this demographic. The entrepreneur/variable-income segment was the first real user's use case. Need a flow that captures: base + variable split, monthly average vs peak, stability level.

---

## How to test changes

When you update an action string, test it with at least two contrasting personas before shipping:
1. **Simple case** — salaried, solo, clear goal (e.g. Jordan, 24, first job, wants to retire at 60)
2. **Complex case** — household, variable income, or competing priorities (e.g. Maria, 34, two kids, joint finances, early retirement)

For each persona:
1. Get the action string from the local dev server via the MCP endpoint (see testing section below)
2. Simulate the conversation — play both sides, one message at a time
3. After `create_plan` would be called, write out what the narrative should look like
4. Ask: does it feel like an advisor, or like a form?

```bash
# Get current action string for a fresh user
TOKEN=<fresh-user-token>
curl -s -X POST "http://localhost:3000/api/mcp?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_onboarding_status","arguments":{}}}' \
  | grep "^data:" | python3 -c "
import sys,json
for line in sys.stdin:
    raw = line.strip()[5:].strip()
    try:
        obj = json.loads(raw)
        content = obj.get('result',{}).get('content',[{}])
        if content:
            data = json.loads(content[0].get('text',''))
            for step in data.get('nextSteps',[]):
                print('=== STEP:', step['step'], '===')
                print(step['action'])
    except: pass
"
```

---

## The measure

A good onboarding session ends with:
- The user feeling like someone smart just listened to them and understood their situation
- A plan named after them with a narrative rich enough to brief a future advisor
- One specific thing they can do this week
- A reason to come back

A bad onboarding session ends with:
- The user having answered 8 questions
- A plan named "My Plan" with a 2-sentence narrative
- "You're all set!"
- No reason to return
