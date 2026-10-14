# SafeBite

**Know your kitchen before your next bite.**
Evidence-based food safety transparency for smarter food choices.

SafeBite is a local, demo-ready platform where people can discover restaurants, read the food safety evidence on record, see which claims are verified and which are self-reported, compare establishments, submit concerns for moderation, upload inspection documents for human review, and ask a grounded AI explainer questions. Everything runs on a laptop with no API keys, cloud accounts or paid services.

> **Demo data only.** All restaurants, authorities, auditors, inspection records, documents and community reports are **fictional**. Records labelled "simulated" are not genuine authority records. SafeBite is informational and is **not a government certification authority**.

---

## Status: read this first

This project was generated in an environment where the public npm registry was blocked by policy and the internal mirror could not serve the modern dependency tree. That means:

- **Not run here:** `npm install`, `prisma generate`, `prisma migrate`, `next build`, `next dev`, ESLint, the TypeScript compiler, Vitest, React Testing Library and Playwright. Their results are therefore **not claimed**. Run them on your machine (commands below) before relying on the code.
- **Run here:** the pure logic modules (scoring, discovery, comparison, moderation, document extraction and upload validation, grounding rules, guards, rate limiting, seed invariants) were executed with Node's built-in type stripping and a small `vitest`-compatible shim. Those results are described in [Verification](#verification). This is not a substitute for the real test run.
- **Generated here:** all eight sample PDFs (`public/samples/*.pdf`), checked for valid cross-reference tables.
- **Not generated:** the initial Prisma migration. Create it once with `npm run db:migrate -- --name init` (see below), then commit `prisma/migrations/`.

---

## Quick start

Requirements: **Node.js 22.9+ (24 recommended)** and npm. No Docker, Google Cloud or API keys are needed for the demo.

```bash
cd safebite
cp .env.example .env          # optional; the defaults work with no edits
npm install                   # also runs `prisma generate`
npm run db:migrate -- --name init   # first time only: creates the SQLite schema and migration
npm run fixtures:pdf          # regenerate the sample PDFs (already committed)
npm run db:seed               # loads 12 fictional restaurants and their records
npm run dev                   # http://localhost:3000
```

Open **http://localhost:3000** and follow the guided walk-through at **http://localhost:3000/demo**.

### Restart / reset

```bash
npm run dev                    # start (Ctrl+C to stop)
npm run db:reset               # wipe the database, re-apply migrations, then re-seed with: npm run db:seed
```

### Production-style run

```bash
npm run build && npm start     # http://localhost:3000
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` then production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (Next.js rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and component tests |
| `npm run test:e2e` | Playwright browser flow (starts the dev server unless `SAFEBITE_BASE_URL` is set) |
| `npm run db:migrate` | Create or apply a migration (`prisma migrate dev`) |
| `npm run db:deploy` | Apply existing migrations without prompts (`prisma migrate deploy`) |
| `npm run db:seed` | Load fictional demo data (idempotent) |
| `npm run db:reset` | Drop and recreate the local database |
| `npm run fixtures:pdf` | Regenerate the fictional sample PDFs |

Playwright needs its browser once: `npx playwright install chromium`.

---

## What you can do in the demo

| Page | Path | What to try |
| --- | --- | --- |
| Landing | `/` | Live preview of the transparency breakdown and featured restaurants |
| Explore | `/restaurants` | Search, filter by coverage, inspection status and indicators, sort, paginate; switch to the schematic map; add restaurants to compare |
| Restaurant profile | `/restaurants/[slug]` | Evidence confidence and its components, unresolved official violations, timeline, hygiene categories, documents with provenance, community reports, missing information, AI explainer |
| Compare | `/compare?slugs=a,b,c` | Side-by-side evidence for 2–3 restaurants; no ranking |
| Document intelligence | `/documents` | Upload a PDF (or use the sample), run extraction, review every field, publish with confirmation |
| Community reports | `/community` | Submit an unverified concern; see how reports are handled |
| Moderation (demo) | `/moderation` | Start a review, corroborate or reject with a note |
| Analytics | `/analytics` | Charts computed from stored records; CSV / JSON Lines exports |
| Methodology | `/methodology` | Tiers, weights, formulas and limitations |
| Demo guide | `/demo` | Guided steps and clickable sample questions |

### Demo restaurants (all fictional)

Copperleaf Kitchen · Saffron & Stone · Tidewater Taqueria · Lantern Noodle Bar · Maple & Mortar Bakery · Oakline Pizzeria · Harvest Table · Juniper Grill · Bluefin Sushi House · Ember & Oak BBQ · Padma Dosa Corner · Crumb & Cask Brewpub

Each one is designed to show a different evidence state (see `src/lib/demo/seed-data.ts`), for example an unresolved critical violation, a resolved critical violation verified by a follow-up inspection, a self-report that conflicts with an open finding, a stale inspection, and no official record at all.

---

## Trust model: how evidence is labelled

| Label | Meaning | Counts toward evidence confidence? |
| --- | --- | --- |
| **Official verified** | Record from a food safety authority. Demo copies are *simulated*. | Yes, full weight |
| **Independently checked** | Audit by a party other than the restaurant or the authority | Yes, 0.8 |
| **Self-reported** | Submitted by the restaurant | Yes, 0.4 |
| **Unverified allegation** | Customer report. Only corroborated reports are shown, as allegations | No |
| **AI-inferred signal** | Machine interpretation | No. Never a rating or certification |

**Evidence confidence** (0–100) is a deterministic, explained number built from coverage, freshness, source quality and consistency. It measures how much verifiable information exists. It is **not a safety score**. Unresolved official violations are listed separately and are never averaged away. Full specification: [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

---

## AI explainer and document extraction

SafeBite can use **Gemini on Vertex AI** through Google's official `@google/genai` SDK. The app shows which source produced each answer:

| Badge | Meaning |
| --- | --- |
| **Gemini gemini-2.5-flash on Vertex AI** (green) | Real model output, validated and cited |
| **DEMO EXPLAINER (deterministic template, not Gemini)** (grey) | Demo mode. No model was called |
| **Vertex AI did not answer (CODE)** (red) | Vertex AI was selected but failed. The template answer is shown, with the error code and reason |

Nothing falls back silently. A Vertex failure is always shown with its error code. Model output must parse against a schema, cite only sources the app supplied, and must not state dates or certifications that the cited records don't contain.

Document extraction follows the same rules. Gemini proposes fields, each one must appear in the document's text, and a human still reviews everything before publication. If Gemini fails, rule-based extraction runs and the review screen says why.

### Set up real Gemini on Vertex AI (Windows PowerShell or macOS/Linux)

1. **Install the Google Cloud CLI** from https://cloud.google.com/sdk/docs/install.
2. **Sign in and choose a project** that you are allowed to use and that has billing enabled:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_PROJECT_ID>
   ```
3. **Enable the Vertex AI API:**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```
4. **Grant your user the Vertex AI User role** on the project (or ask an admin to):
   ```bash
   gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> --member="user:<your-email>" --role="roles/aiplatform.user"
   ```
5. **Create Application Default Credentials** for local development. This is what the SDK uses instead of a token you paste in:
   ```bash
   gcloud auth application-default login
   ```
6. **Set the variables in `.env`:**
   ```
   SAFEBITE_AI_MODE="VERTEX"
   VERTEX_PROJECT_ID="<YOUR_PROJECT_ID>"
   VERTEX_LOCATION="us-central1"
   GEMINI_MODEL="gemini-2.5-flash"
   ```
7. **Run one real request** (this uses a small amount of Vertex AI quota):
   ```bash
   npm run ai:smoke
   ```
   A success prints `Live response received from Vertex AI:` followed by JSON. A failure prints an error code, such as `AUTH_FAILED` (step 5 or 4 is missing) or `MODEL_ERROR` (the model isn't available in your location or project).
8. **Restart `npm run dev`** and open `/restaurants/copperleaf-kitchen`, then ask a question in the AI explainer. A green badge that says "on Vertex AI" means the answer came from Gemini.

Keep `SAFEBITE_AI_MODE="DEMO"` if you don't want any Vertex calls.

## Configuration

Copy `.env.example` to `.env`. Every variable is optional. See the file for descriptions. The important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite database (relative to `prisma/`) |
| `SAFEBITE_AI_MODE` | `DEMO` | `DEMO` or `VERTEX` |
| `VERTEX_PROJECT_ID` | empty | Required for `VERTEX` |
| `VERTEX_LOCATION` | `us-central1` | Vertex AI region |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model name |
| `AI_TIMEOUT_MS` | `15000` | Per-request timeout |
| `UPLOAD_DIR` | `data/uploads` | Must resolve inside the project |
| `MAX_UPLOAD_BYTES` | `5242880` | 5 MB |
| `SAFEBITE_ENABLE_DEMO_ADMIN` | `true` | In production, must be `true` **and** sit behind an auth layer |
| `ANALYTICS_SINK` | `LOCAL` | `LOCAL` or `BIGQUERY` (BigQuery is inactive unless fully configured) |
| `SAFEBITE_AS_OF` | now | Override the "as of" date used for freshness (ISO-8601) |

---

## Architecture (summary)

- **Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS v4.** Server components read the database directly; route handlers serve the same logic to APIs.
- **SQLite + Prisma 6.** Relational schema with foreign keys, unique constraints and indexes; enumerations validated in code.
- **Zod** validates every API input. **Errors** use one envelope: `{ "error": { "code", "message", "details?" } }`. Internal errors are logged on the server and never returned.
- **Pure domain modules** under `src/lib` (scoring, discovery, comparison, moderation, extraction) hold the business rules and are independently tested.
- **Recharts** for analytics; **lucide-react** for icons; hand-built UI primitives (see deviations).

Full detail with diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Google Cloud path: [`docs/GOOGLE_CLOUD.md`](docs/GOOGLE_CLOUD.md).

### API

All list endpoints paginate. Mutation and admin endpoints require the demo-admin gate.

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/api/health` | Status and AI mode (no secrets) | public |
| GET | `/api/restaurants?q&cuisine&neighborhood&coverage&inspection&indicator&sort&page&pageSize` | Discovery | public |
| GET | `/api/restaurants/[slug]` | Full profile | public |
| GET | `/api/compare?slugs=a,b,c` | Side-by-side comparison | public |
| POST | `/api/ai/explain` | Grounded explainer (rate limited) | public |
| GET | `/api/reports` | Corroborated reports and counts only | public |
| POST | `/api/reports` | Submit an unverified report (rate limited, honeypot) | public |
| GET | `/api/moderation` | Moderation queue | demo admin |
| PATCH | `/api/moderation/[id]` | Change report status (state-machine guarded) | demo admin |
| GET | `/api/documents` | Document list | demo admin |
| POST | `/api/documents` | Upload (multipart; magic-byte check; rate limited) | demo admin |
| GET | `/api/documents/[id]` | Document, machine output and reviewed output (kept separate) | demo admin |
| GET | `/api/documents/[id]/file` | Stream a file (samples and published documents are public) | public / demo admin |
| POST | `/api/documents/[id]/extract` | Run extraction (Gemini if configured and grounded, else rules) | demo admin |
| PUT | `/api/documents/[id]/review` | Save review; publish only with explicit confirmation | demo admin |
| GET | `/api/analytics` | Dashboard aggregates | demo admin |
| GET | `/api/analytics/export?table=&format=csv\|jsonl` | Export tables | demo admin |
| POST | `/api/analytics/export` | Write tables through the configured sink | demo admin |

---

## Security notes

- Uploads are checked by size, declared type **and** file signature. Stored under random names. Display names are sanitised and never used in paths.
- Storage keys are allow-listed; resolved paths are checked to stay inside `public/samples` or the upload folder. No endpoint fetches arbitrary URLs (no SSRF surface).
- Output rendering is React-escaped. No `dangerouslySetInnerHTML`. Security headers (CSP, frame denial, nosniff) are set in `next.config.ts`.
- Community reports store a salted hash of the client address, not the address. No names or contact details.
- CSV exports neutralise spreadsheet formula injection.
- Rate limits: AI 20/min, reports 5/hour, uploads 20/hour per visitor (in-memory; see GOOGLE_CLOUD.md for multi-instance).
- **Production authentication is not implemented.** Demo-admin endpoints are open in development. In production they are disabled unless `SAFEBITE_ENABLE_DEMO_ADMIN=true`, and that flag should only be set behind a real authentication layer (for example, an identity-aware proxy) before deployment.

---

## Tests

Test files live beside the code (`*.test.ts`, `*.test.tsx`) plus `e2e/demo-flow.spec.ts`.

| Area | Files |
| --- | --- |
| Transparency score (deterministic, missing evidence, critical violations, contradictions) | `src/lib/scoring/transparency.test.ts` |
| Search, filter, sort, pagination | `src/lib/discovery/discovery.test.ts` |
| Comparison (no ranking, unknown ≠ unsafe) | `src/lib/compare/compare.test.ts` |
| Moderation state machine and visibility | `src/lib/moderation/moderation.test.ts` |
| Document extraction (valid, missing fields, invalid, prompt injection) and upload validation | `src/lib/documents/extract.test.ts` |
| AI grounding, deterministic answers, Gemini output validation, provider fallback | `src/lib/ai/*.test.ts` |
| Request validation (report, review, explain, query) | `src/lib/api/schemas.test.ts` |
| API error envelope, JSON parsing, no leakage | `src/lib/api/errors.test.ts` |
| Rate limiting, storage-key traversal, admin gate, client-address hashing | `src/lib/api/rate-limit.test.ts`, `src/lib/security/guards.test.ts` |
| Seed invariants (fictional, covers every state, files exist) | `src/lib/demo/seed-data.test.ts` |
| Comparison picker component (React Testing Library) | `src/components/compare-toggle.test.tsx` |
| Full browser journey (Playwright) | `e2e/demo-flow.spec.ts` |

---

## Verification

| Check | Result in this environment |
| --- | --- |
| `npm install`, `prisma generate`, `next build`, `next dev` | **Not run** (registry blocked; see Status) |
| ESLint, `tsc --noEmit` | **Not run** |
| Vitest suite (real runner) | **Not run** |
| Playwright E2E | **Not run** |
| Pure-logic test cases through a Vitest-compatible shim | **80 of 80 passed** (scoring, discovery, comparison, moderation, extraction, upload validation, AI grounding, rate limiting, guards, seed invariants) |
| TypeScript syntax (strip-only parse, `.ts` files) | Passed, except two files using constructor parameter properties, which strip-only mode rejects but TypeScript accepts |
| Sample PDF cross-reference tables | All 8 valid |

Known gaps: tests for zod-backed modules, route handlers, React pages, and the Gemini/Vertex paths were written but not executed.

---

## Deviations from the brief (and why)

- **shadcn/ui CLI not used.** Components are hand-built with Tailwind tokens and Lucide icons, to keep the dependency set small and reviewable.
- **No remote restaurant photos.** Records are fictional and remote images would add licensing and availability risk. Each restaurant gets an illustrated tile in its accent colour.
- **Map is schematic.** A coordinate-based SVG of the fictional city, with no tiles and no paid mapping API.
- **Community evidence is a text note,** not a file upload. Reports don't fetch links or accept attachments in this MVP.
- **Extraction works on PDF text only.** Image uploads (PNG/JPEG) are accepted, but extraction reports that OCR is unavailable. Scanned PDFs without a text layer fail the same way.
- **Pub/Sub is not implemented.** It's described as an optional future path in `docs/GOOGLE_CLOUD.md`.
- **BigQuery sink is implemented but inactive** unless `ANALYTICS_SINK=BIGQUERY` plus project, dataset and token are set. It has not been exercised against a real dataset.

---

## Project layout

```
prisma/            schema, seed script (migrations are created on first run)
public/samples/    fictional sample PDFs (generated by scripts/generate-sample-pdf.mjs)
scripts/           PDF fixture generator (no dependencies)
src/app/           pages and API route handlers
src/components/    UI components (client components are marked "use client")
src/lib/           domain, scoring, discovery, compare, moderation, documents, ai, api, data, storage, cloud, demo
docs/              architecture, methodology, Google Cloud guide
e2e/               Playwright browser flows
```

## Licence and data

Demo content is fictional and created for this project. Do not replace it with real establishments or real inspection outcomes.
