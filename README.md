# Property Investment Calculator

A reusable calculator for Swedish residential property projects. It compares the
full after-tax economics of buying, renovating, optionally letting, holding and
selling a property under four ownership structures:

- **Private — equity funded**
- **Private — debt funded**
- **Existing company**
- **Separate project company**

The point is not to compare headline tax rates. The model carries the whole
capital flow: purchase taxes and fees, mortgage deeds, renovation, VAT
treatment, ROT, financing, the cost of extracting money from a company to fund a
private purchase, running costs, rental taxation, private-use benefit taxation,
sale costs, capital gains or corporate tax, the second tax layer when company
profit moves to the owners, opportunity cost of tied-up capital, and the
resulting family net worth delta.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # calculation engine + persistence tests
npm run build
```

No backend is required. Projects persist in browser local storage behind a
`ProjectRepository` interface, so a database can be substituted later without
touching the calculation engine.

## Structure

```
src/
  calculations/   pure calculation modules — no React, no I/O
    engine.ts     scenario adapter: one pipeline, four ownership structures
  config/         central versioned tax configuration
  components/     UI only; no financial formulas live here
  lib/            persistence, schema validation, migrations, formatting
  data/           example/seed project fixture
  tests/          Vitest suites
```

Calculations are pure functions and every major output carries an audit trail
that the UI exposes through a "Show calculation" toggle.

## What the app deliberately refuses to assume

The spec this was built from lists the assumptions that most often make a
property comparison wrong. The model encodes them as refusals rather than
defaults:

- The 22% effective private capital gains rate applies **only** when the user
  explicitly classifies the property as a private residential property. Any
  other classification uses a supplied rate and is flagged.
- Renovation spend is **not** assumed deductible against a future capital gain.
  The eligible share defaults to zero and is an advisor input. ROT-funded
  amounts are always excluded from the basis.
- VAT on residential renovation defaults to **0% deductible**. Claiming a
  deduction raises a red flag.
- Company profit is **not** assumed distributable at a low dividend rate. When
  profit exceeds the low-tax allowance and no above-allowance rate is supplied,
  private-cash KPIs read "needs dividend tax rate" instead of showing tax-free
  extraction — and such a structure cannot be ranked best on private outcomes.
- Benefit value for a company-owned property available to the owners is never
  inferred; it is a manual or advisor input.
- Salary taxation is an approximation and says so.
- Amortization moves cash and reduces debt but is never counted as a project
  expense.
- Money retained in a company is not treated as private cash. Family net worth
  is reported in two modes: retained (A) and fully extracted (B).
- Missing values stay missing. Nothing tax-sensitive is silently substituted,
  on entry or on import.

## Tax configuration

All rates live in `src/config/taxConfig.ts`, versioned by tax year and editable
in the app. A project may lock a snapshot so that later changes to the global
defaults leave its historical assumptions alone. Per-project overrides are
stored separately from the global config.

Values that must be supplied or advisor-verified — employer contribution rate,
personal marginal salary tax, the 3:12 allowance, the rate above it, VAT
deductibility, benefit value, property and company asset classification,
interest deduction restrictions and capital-improvement deductibility — are
tagged as such throughout the UI.

## Projects

The project library is the home screen: create, open, duplicate, rename,
archive, restore, delete, import and export. Projects export as versioned JSON
and re-import without loss; imports are validated and produce a report rather
than failing silently, and a colliding ID gets a new one. Two comparison modes
are supported and always labelled: several projects under one ownership
scenario, or one project across its ownership scenarios.

A single example project ships on first launch only. It is user data, not part
of the engine, and once deleted it stays deleted.

## Disclaimer

This is decision support, not tax advice. Classification depends on purpose,
facts and usage. Confirm the flagged assumptions with a tax advisor before
relying on any result.
