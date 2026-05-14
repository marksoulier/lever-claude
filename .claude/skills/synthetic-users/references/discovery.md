# Product Discovery

Commands and techniques for understanding an unfamiliar product before generating personas.

## Browser discovery

```bash
# Open the homepage
playwright-cli open --browser=firefox http://localhost:3000

# Read the full page structure
playwright-cli snapshot

# Check for JS errors on load
playwright-cli console

# Follow the main CTA — what does it lead to?
playwright-cli click [ref of primary button]
playwright-cli snapshot

# Check for a pricing, about, or how-it-works page
playwright-cli goto http://localhost:3000/pricing
playwright-cli goto http://localhost:3000/about
```

## File-based discovery

```bash
# Read the README
cat README.md | head -80

# Find all routes
find app -name "page.tsx" | sort

# Find API endpoints
find app/api -name "route.ts" | sort

# Check package.json for technology clues
grep -E '"name"|"description"' package.json
```

## What to look for

**On the homepage:**
- The `<h1>` — this is usually the product's pitch
- The primary CTA button — this is usually the most important user action
- Navigation labels — these name the product's sections
- Any "how it works" or "features" section — these describe the use cases

**Signals about the intended user:**
- Language complexity (technical vs plain)
- Pricing tiers and what they include
- Screenshots or demo content — what data is shown?
- Social proof — who is quoted?

**Signals about product maturity:**
- Is there a sign-up / login flow?
- Does the demo data look realistic?
- Are there empty states? Error states?
- What is intentionally left unbuilt ("coming soon")?

## Questions to answer before Phase 2

1. What does this product do in one sentence?
2. Who is the obvious intended user?
3. What is the primary action a new user takes?
4. What is NOT supported yet (obvious gaps)?
5. Is there an auth flow? If yes, is there a way to create a test account?
