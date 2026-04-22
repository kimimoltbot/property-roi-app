# PRD: Property Cockpit (DLA-first ROI)

**Product**: Property ROI App  
**Document owner**: Product + Engineering  
**Status**: Implementation-ready draft  
**Date**: 2026-04-22

---

## 1) Product Goal

Build a dense, decision-first property investment cockpit that lets a landlord/investor:

1. **Quickly size up** a deal in under 2 minutes.
2. **Deep dive** into assumptions and stress outcomes.
3. **Compare** multiple deals and scenarios side-by-side.
4. **Track invested deals** over time with persistent state.

The core lens is **DLA-first cashflow discipline**: surplus cash repays Director’s Loan Account first; distributions only occur once DLA is cleared.

---

## 2) Non-goals

- Full CRM for brokers/agents.
- Portfolio accounting or statutory tax filing.
- Property management operations (maintenance tickets, tenant comms).
- Automated investment recommendations (“buy/sell” advice).
- Native mobile app in phase 1–2 (web app only).

---

## 3) Personas

1. **Solo Investor (Primary)**
   - 1–20 properties, needs fast go/no-go clarity.
   - Cares about cashflow resilience, refinance risk, DLA unwind speed.

2. **Analyst Partner / VA (Secondary)**
   - Prepares draft assumptions and comparisons for decision-maker.
   - Needs consistent templates, clear status, minimal ambiguity.

3. **Returning Owner (Tracking)**
   - Monitors previously “invested” deals against plan.
   - Needs variance alerts and assumption history.

---

## 4) Workflow lifecycle

## 4.1 Quick Size-Up

**Intent**: produce a credible first-pass view in <2 minutes.

Inputs:
- Postcode
- Purchase price
- Monthly rent
- Baseline costs + finance defaults

Outputs:
- Gross yield
- DLA ETA band (green/amber/red)
- Year-6 break-even rate (%), refinance alert
- Cliff badge (safe/watch/alert)
- Postcode intel summary (crime/EPC/schools/connectivity/licensing)

## 4.2 Deep Dive

**Intent**: refine assumptions and run deterministic scenario outputs.

Actions:
- Edit assumptions (rates, costs, rent growth, licensing provision)
- Run conservative and marketing modes across horizons
- View timeline of free cash, DLA remaining, distributions
- Apply stress rates (e.g., 4/6/8%)

Outputs:
- Stored scenario run with full input snapshot + result payload
- Assumption set version tagged to scenario run

## 4.3 Comparison

**Intent**: compare candidate deals and scenario modes quickly.

Actions:
- Select 2–8 deals
- Compare fixed metrics (yield, DLA ETA, repaid by horizon, break-even, cliff badge)
- Pin comparator baseline (e.g., “FOX”, “NEWCASTLE”, “GHOST”)

Outputs:
- Ranked table view
- Saved comparison snapshot (optional)

## 4.4 Invested Tracking

**Intent**: monitor live deals against planned assumptions.

Actions:
- Mark deal/scenario as “invested baseline”
- Periodically update actuals (rent, costs, debt balance/rate)
- View variance vs baseline and updated DLA ETA

Outputs:
- Trend + variance indicators
- Alert states when refinance or DLA risk worsens

---

## 5) Product invariants (must never break)

## 5.1 DLA-first invariant

For every simulated year (and for invested tracking recalculation):

1. Compute free cash.
2. If free cash > 0, repay DLA first up to remaining balance.
3. Only after DLA reaches 0 can remainder be counted as distribution.
4. If free cash < 0, DLA increases by deficit (unless explicitly modelled otherwise in future phases).

**No UI path or API path may bypass this invariant.**

## 5.2 State persistence invariant

- Any user-confirmed assumption change, run, compare set, and invested baseline must persist to Supabase and survive reload/session change.
- Client state is a cache of server truth, not source of truth.
- Runs are immutable records; edits create new run records, not silent overwrite.

---

## 6) User stories and acceptance criteria

## Story A — Quick Size-Up (Ghost deal)

As an investor, I want to enter postcode/price/rent and get an immediate first-pass verdict.

**Acceptance criteria**
- Given valid postcode/price/rent, app returns draft in <= 2.5s p95 (excluding external outage).
- Output includes gross yield, DLA ETA, break-even %, cliff badge, intel source metadata.
- If intel source unavailable, fallback values are returned with explicit `status`, `confidence`, `notes`.
- Draft can be promoted to a saved deal in one action.

## Story B — Deep Dive assumptions

As an investor, I want to edit assumptions and run deterministic scenarios.

**Acceptance criteria**
- Editing assumptions creates or updates a named assumption set.
- Running scenario writes immutable `scenario_runs` record with assumption snapshot hash.
- Timeline reflects DLA-first invariant for every year.
- Conservative mode supports stress grid (4/6/8% at minimum).

## Story C — Comparison cockpit

As an investor, I want side-by-side comparisons across deals/modes/horizons.

**Acceptance criteria**
- User can compare at least 2 and up to 8 deal-scenario rows in one view.
- Table shows: yield, DLA ETA, DLA repaid by horizon, break-even %, cliff badge, refinance alert.
- Sorting by any metric is stable and deterministic.
- Comparison state can be saved/reloaded.

## Story D — Invested tracking

As an owner, I want to track actuals vs baseline after committing to a deal.

**Acceptance criteria**
- User can mark one scenario run as invested baseline.
- Actual updates are timestamped and auditable.
- Variance view displays plan vs actual for rent, costs, rate, DLA remaining.
- Alert triggers when break-even falls below threshold or DLA ETA worsens by configurable delta.

---

## 7) Data model mapping (Supabase)

Use UUID PKs, `created_at`, `updated_at` (UTC), and `user_id` ownership columns by default.

## 7.1 `deals`
- `id uuid pk`
- `user_id uuid not null`
- `name text not null`
- `postcode text not null`
- `purchase_price numeric(12,2) not null`
- `monthly_rent numeric(12,2) not null`
- `status text check (status in ('draft','candidate','invested','archived'))`
- `invested_baseline_run_id uuid null`
- `metadata jsonb`

## 7.2 `assumptions`
- `id uuid pk`
- `user_id uuid not null`
- `deal_id uuid null` (null = reusable template)
- `name text not null`
- `mode text check (mode in ('conservative','marketing'))`
- `initial_rate numeric(6,4)`
- `annual_costs numeric(12,2)`
- `annual_cashflow_conservative numeric(12,2)`
- `annual_cashflow_marketing numeric(12,2)`
- `licensing_provision jsonb` (e.g., `{y1,y6,y11}`)
- `version int not null default 1`
- `is_active boolean default true`

## 7.3 `scenario_runs`
- `id uuid pk`
- `user_id uuid not null`
- `deal_id uuid not null`
- `assumption_id uuid not null`
- `horizon int not null` (5/10/15/20)
- `mode text not null`
- `input_snapshot jsonb not null`
- `result_summary jsonb not null`
- `timeline jsonb not null`
- `input_hash text not null` (idempotency/debug)
- `created_at timestamptz not null`

## 7.4 `postcode_intel_cache`
- `id uuid pk`
- `postcode_normalized text unique`
- `bundle jsonb not null`
- `source_meta jsonb not null`
- `expires_at timestamptz not null`

## 7.5 `comparison_sets`
- `id uuid pk`
- `user_id uuid not null`
- `name text not null`
- `items jsonb not null` (deal/run references + ordering)

## 7.6 `invested_actuals`
- `id uuid pk`
- `user_id uuid not null`
- `deal_id uuid not null`
- `as_of_date date not null`
- `monthly_rent_actual numeric(12,2)`
- `annual_costs_actual numeric(12,2)`
- `loan_rate_actual numeric(6,4)`
- `loan_balance_actual numeric(12,2)`
- `notes text`

## 7.7 `audit_events` (recommended)
- `id uuid pk`
- `user_id uuid not null`
- `entity_type text`
- `entity_id uuid`
- `event_type text`
- `payload jsonb`
- `created_at timestamptz`

---

## 8) RLS & security requirements

1. **RLS enabled on all user tables** (`deals`, `assumptions`, `scenario_runs`, `comparison_sets`, `invested_actuals`, `audit_events`).
2. Policies: `user_id = auth.uid()` for select/insert/update/delete.
3. `postcode_intel_cache` may be shared read for authenticated users; writes restricted to service role/backend only.
4. No service role keys in browser.
5. Validate and normalise postcode server-side.
6. Enforce numeric bounds server-side (non-negative, reasonable maxima).
7. Immutable `scenario_runs` rows: deny update/delete except admin maintenance policy.
8. Secrets (`EPC_API_KEY`, adapter URLs) server-only env vars.

---

## 9) API requirements (postcode intel)

Current required endpoints:
- `GET /api/intel?postcode=...`
- `GET /api/intel/crime?postcode=...`
- `GET /api/intel/epc?postcode=...`
- `GET /api/intel/schools?postcode=...`
- `GET /api/intel/connectivity?postcode=...`
- `GET /api/intel/licensing?postcode=...`
- `POST /api/ghost-deal`

External data source expectations:
- Geocode/postcode: `api.postcodes.io`
- Crime: `data.police.uk`
- EPC: `epc.opendatacommunities.org` (API key)
- Schools: adapter around `education.data.gov.uk` output
- Connectivity: adapter endpoint returning ultrafast + technology summary
- Licensing: local policy + override JSON

Response contract requirements:
- Every intel section includes source metadata: `provider`, `status`, `confidence`, `fetchedAt`, `ttlSeconds`, `notes?`, `cacheHit?`.
- Fallback and unavailable states must be explicit and non-breaking.

---

## 10) UI density standards

Design principles:
- **Mobile-first dense cards**: high information per viewport with clear hierarchy.
- **Target 3–5 key KPIs above fold** on small screens.
- Prefer compact badges/labels over verbose prose.
- Default number formatting: GBP (£), thousands separators, one decimal where relevant.
- Status colour semantics (consistent):
  - Green = healthy/pass
  - Amber = watch
  - Red = alert/fail
- Avoid modal-heavy flow; use inline edits where practical.

Performance UX:
- First meaningful cockpit render < 2s on warm path.
- Skeletons for async sections; never blank panels.

---

## 11) British English style guide

- Use British spelling: **optimise, behaviour, initialise, licence (noun), licensed (verb/adjective)**.
- Currency display in **GBP (£)**.
- Dates as `DD Mon YYYY` in UI (e.g., `22 Apr 2026`) unless chart axis requires compact format.
- Tone: concise, direct, non-hype, decision-oriented.
- Avoid US terminology where UK equivalent exists (e.g., “postcode”, not “zip code”).

---

## 12) Phased delivery plan

## Phase 1 — Quick Size-Up + Auth hardening
- Wire `POST /api/ghost-deal` to UI create flow.
- Persist draft deal to `deals`.
- Add source meta chips in intel panel.
- Remove hardcoded Supabase fallback anon key from client code.

**Tests**
- Unit: postcode normalisation, fallback handling.
- API: ghost-deal happy path + source failure path.
- Security: verify no secret leakage client-side.

## Phase 2 — Deep Dive + Scenario persistence
- Assumption editor + reusable templates.
- Scenario run execution + immutable `scenario_runs` writes.
- Timeline view for DLA, free cash, distribution.

**Tests**
- Unit: DLA-first invariant (positive, zero, negative free cash).
- Integration: assumption edit -> run saved -> reload consistency.
- Regression: conservative stress grid accuracy.

## Phase 3 — Comparison cockpit
- Multi-row compare table and sorting.
- Save/load `comparison_sets`.
- Comparator anchors (FOX/NEWCASTLE/GHOST) in UI model.

**Tests**
- Integration: compare 2/8 rows; sorting deterministic.
- Snapshot: badge/colour mapping consistency.

## Phase 4 — Invested tracking + variance alerts
- Baseline pinning from scenario run.
- Actual updates and variance cards.
- Alert thresholds and history audit.

**Tests**
- Integration: baseline pin -> update actuals -> alert state changes.
- Data: audit event generation for updates.
- RLS: cross-user access blocked for all invested data.

---

## 13) Definition of done

A phase is done when:
1. Acceptance criteria for included stories pass.
2. Automated tests for new behaviour are in CI.
3. RLS policies validated with positive + negative tests.
4. UI copy conforms to British English guide.
5. No invariant violations found in engine/API paths.
