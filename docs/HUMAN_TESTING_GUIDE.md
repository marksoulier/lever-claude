# Human Testing Guide

Walk through this as a real new user. Don't skip steps. Write your honest experience to UserJot after — not what broke, but what felt off, what surprised you, what you didn't expect.

---

## Setup (2 min)

1. Open an incognito / private window
2. Go to the app (local or production URL)
3. Sign up with a **new email** — not your existing account

---

## Step 1 — Create your first plan (2 min)

4. Click **+ New plan** on the dashboard
5. Fill in name, retirement age, monthly contribution. Skip current balance.
6. Click **Create plan**

> **Notice:** Does the projected balance feel real or like a generic placeholder? Does the page tell you what's behind the number?

---

## Step 2 — Connect Claude and onboard (10 min)

7. On the plan page, find the **"This plan has no personal context yet"** box
8. Click **Copy prompt** — does the button clearly confirm it copied?
9. Open [claude.ai](https://claude.ai) in a new tab
10. Add the **Lever connector**: left sidebar → Customize → Connectors → + → Add custom → paste your connector URL
11. Start a new conversation and paste the copied prompt
12. Answer Claude's questions honestly with your real numbers

> **Notice:** Does Claude ask income *type* before income *amount*? Does it feel like a conversation or a form dump? Does it acknowledge when you're halfway done?

---

## Step 3 — Return to the dashboard (2 min)

13. Go back to your Lever tab
14. Open the plan — projected balance should have changed
15. Click **Events in this plan** — does it list what Claude modeled?

> **Notice:** Do the dollar amounts in the events list match what you told Claude?

---

## Step 4 — Run Monte Carlo (3 min)

16. Find **"Run a real probability simulation"** below the metric cards
17. Copy that prompt, paste it into your Claude conversation
18. Wait for the result, then refresh the plan page

> **Notice:** Did the probability subtitle change to "Monte Carlo"? Does the new number feel more trustworthy?

---

## Step 5 — Test the return loop (2 min)

19. Close the tab. Come back later or tomorrow.
20. Open Claude and say: **"I just got a 10% raise — update my plan"**
21. Refresh the plan page

> **Notice:** Did the projection update? Does the plan feel alive or static?

---

## What to write in UserJot

Go to [lever.userjot.com/b/features](https://lever.userjot.com/b/features) and write one note per step:

- What surprised you (good or bad)
- Any moment you didn't know what to do next
- What one thing would make you recommend this to a friend
- At what point did the plan start feeling like *yours*

I'll read UserJot at the start of the next session and act on the findings.
