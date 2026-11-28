# Deploying OpenInterview

OpenInterview is provider-agnostic and gated: with no keys set, the stack runs
fully offline with mock providers and naive RAG, and observability is a no-op.
Wire a provider only when its DSN or keys are available. The topology below
describes the current fork, including the separate spoken-coach worker.

---

## 1. Why Singapore (`sin1` / SGP)

Primary launch audience is South-East Asia (incl. HCMC). Singapore is the
lowest-latency major cloud region for the region:

- **HCMC ↔ Singapore: < 50 ms** round-trip — well inside the budget for a
  natural-feeling voice turn (STT → LLM → TTS).
- Co-locating the **LiveKit media + the agent worker** in SGP keeps the
  realtime audio path short; the heavy reasoning already ran in prep (handoff
  §2 prep/live/post split), so the live loop just needs low RTT.
- Vercel `sin1`, LiveKit Cloud Singapore, and Supabase `ap-southeast-1` all live
  in the same metro, so cross-service hops stay intra-region.

Region is pinned in:

- `vercel.json` → `"regions": ["sin1"]` (web).
- `deploy.yml` → worker deploy step targets LiveKit Cloud **Singapore** (or
  Render / Fly `sin`).
- Supabase project + R2 bucket: create in / near `ap-southeast-1`.

---

## 2. Topology

| Component          | Where it runs                                   | Port | Health     |
| ------------------ | ----------------------------------------------- | ---- | ---------- |
| **web** (Next)     | Vercel (`sin1`) — or the `web` container         | 3000 | `/api/health` |
| **agent-api**      | Container (Render/Fly `sin`) — FastAPI prep/score | 8000 | `/health`  |
| **agent-worker**   | LiveKit Cloud Agents **SGP** — interviewer       | —    | LiveKit Cloud |
| **coach-worker**   | LiveKit Cloud Agents **SGP** — spoken coach      | —    | LiveKit Cloud |
| **lightrag**       | Container (`sin`) — knowledge sidecar            | 9621 | `/health`  |
| **Supabase**       | Managed (`ap-southeast-1`) — optional persistence | —  | managed    |
| **R2**             | Cloudflare (global) — CV files + recordings      | —    | managed    |

The agent ships as **one image, three run modes** (`apps/agent/Dockerfile`):
the default `CMD` runs the **API** (`uvicorn …:8000`); overriding the command to
`python -m deepinterview_agent.worker start` runs the **interviewer**; and
`python -m deepinterview_agent.worker_coach start` runs the **spoken coach**.
Both workers import `livekit.agents` at load time, so their image must be built
with the `livekit` extra and given LiveKit/STT/TTS/LLM keys. The compose `live`
profile starts only the interviewer; run the coach separately.

---

## 3. Local full stack

```bash
docker compose up                 # web + agent-api + lightrag (offline-capable)
docker compose --profile live up  # + agent-worker (needs livekit extra + keys)
```

`docker compose config -q` validates the file (also run in CI). Healthchecks use
the in-image runtime (`node` / `python` one-liners) because the slim base images
ship neither `curl` nor `wget`:

- `web` → `GET /api/health`
- `agent-api` → `GET /health`
- `lightrag` → `GET /health`

`web` and `agent-api` `depends_on` `lightrag` being **healthy** before they
start.

### Session persistence

Set `SQLITE_PATH` only for a local, single-user deployment without Supabase, for
example `SQLITE_PATH=~/.local/share/openinterview/sessions.db`. The agent creates
the parent directory and enables WAL mode. Fully configured Supabase takes
precedence; with no `SQLITE_PATH` and no Supabase, sessions stay in memory.

When running the agent in Docker, mount the directory containing `SQLITE_PATH`
as a volume. A path inside the container without a mount is lost when the
container is replaced. Session-list and saved-input-library endpoints are
disabled when Supabase is configured; the UI then uses browser-local history.

### Images

- **web** — `apps/web/Dockerfile`, multi-stage, Next.js **standalone** output
  (`output: 'standalone'` in `next.config.ts`). Build context is the **repo
  root** (pnpm + Turborepo monorepo); `@deepinterview/shared` is built first via
  `pnpm build --filter @deepinterview/web...`. The runner is a slim
  `node apps/web/server.js` with no runtime install.
- **agent** — `apps/agent/Dockerfile`, `python:3.11-slim` + uv. Base
  `uv sync --no-dev` only (no `livekit` / `observability` extras), so the API
  runs on mock providers with zero keys.
- **lightrag** — `services/lightrag/Dockerfile`, naive RAG by default.

---

## 4. Push-to-deploy

The repository includes `.github/workflows/ci.yml` for schema parity, build,
typecheck, lint, JS + Python tests (agent and lightrag sidecar), and
`docker compose config -q`. Enable GitHub Actions in the fork to run it on
pushes and pull requests.

`.github/workflows/deploy.yml` is a gated manual workflow. Each deploy step is
skipped unless its secrets are present, and destructive CLI commands remain
commented out until explicitly enabled.

Jobs:

1. **deploy-web** → Vercel (region from `vercel.json` = `sin1`). Needs
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
2. **build-agent-image** → builds `apps/agent/Dockerfile` and pushes to GHCR.
3. **deploy-agent-worker** → deploys the worker image to **LiveKit Cloud Agents
   (Singapore)** (or Render / Fly `sin`). Needs `LIVEKIT_URL`,
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Remember the worker variant must be
   built with `--extra livekit`.

The included deploy workflow targets the interviewer worker only. Deploy the
coach worker separately with the same image, `livekit` extra, and provider keys:

```bash
uv --directory apps/agent run --extra livekit python -m deepinterview_agent.worker_coach start
```

It registers `LIVEKIT_COACH_AGENT_NAME` (default `deepinterview-coach`) and uses
the same session store as the API. The coach does not currently prewarm or
pre-import the turn-detector plugin; verify semantic end-of-turn in a live coach
session.

### Web on Vercel

`vercel.json` sets `framework: nextjs`, `regions: [sin1]`,
`installCommand: pnpm install --frozen-lockfile`, and
`buildCommand: pnpm build --filter @deepinterview/web...` (the trailing `...`
builds the `@deepinterview/shared` workspace dependency first), with
`outputDirectory: apps/web/.next`.

---

## 5. Environment & secrets

Secrets are env vars only (`.env`, never committed; see `.env.example`). Set the
same keys as **deployment secrets** on each platform:

- **Vercel** (web): `NEXT_PUBLIC_*` (Supabase URL/anon key, app URL), and any
  server keys the web token endpoint needs.
- **LiveKit Cloud** (both workers): `LIVEKIT_URL/API_KEY/API_SECRET`, STT/TTS/LLM
  provider + key (Soniox/Deepgram · Cartesia/ElevenLabs · Gemini/OpenAI),
  Supabase service-role key when used, and `LIGHTRAG_URL`.
- **Worker dispatch names:** `LIVEKIT_AGENT_NAME` for the interviewer and
  `LIVEKIT_COACH_AGENT_NAME` for spoken coaching. The web token request and
  worker registration must use the same value.
- **Cartesia tuning:** optional `CARTESIA_VOICE_ID`, `CARTESIA_SPEED`,
  `CARTESIA_EMOTION`, and `CARTESIA_BUFFER` (`sentence` for lowest latency,
  `cartesia` for phrase-buffered pacing).
- **Local persistence:** optional `SQLITE_PATH`; leave Supabase unset and mount
  the database directory when containerized.
- **agent-api / lightrag** containers: provider keys as needed; both run offline
  on mocks with none set.

With **no** keys: providers fall back to deterministic mocks, RAG falls back to
the naive backend, and observability is off. The build and tests stay green.

---

## 6. One dashboard: latency · cost · errors

**Local traces work out of the box; hosted providers are gated.** The agent
writes one JSONL file per run to `TRACE_DIR` (default `.deepinterview/`,
gitignored) — no keys, no extra install:

- **Agent work → local traces + CLI.** Every prep/score/live/coach run opens a
  trace (`prep` / `score` / `live` / `coach` + `session_id`); prep nodes,
  scoring stages, and every LLM call (mock included) become timed spans.
  Inspect with `deepinterview traces list`, replay with
  `deepinterview traces show <trace-id> [--json]`, or serve over HTTP via
  `GET /api/traces[?session_id=&limit=]` and `GET /api/traces/{id}`.
  `TRACE_ENABLED=0` disables even local tracing (the test suite sets this);
  `TRACE_INCLUDE_PROMPTS=1` additionally stores short prompt previews
  (default off — traces hold lengths/metadata only, no CV/JD text).
- **LLM tracing & cost → Langfuse (opt-in).** Set `LANGFUSE_PUBLIC_KEY` +
  `LANGFUSE_SECRET_KEY` (+ optional `LANGFUSE_HOST`) and
  `uv sync --extra observability`: spans are additionally forwarded as OTel
  spans under the same trace ids (`traces open <id>` prints the lookup).
  This is the single pane for per-interview unit cost and where you watch it
  trend down as you optimize.
- **Voice / turn latency → LiveKit Cloud metrics.** STT → LLM → TTS turn timing
  and session health, co-located in SGP.
- **Errors → Sentry.** Set `SENTRY_DSN` (server) / `NEXT_PUBLIC_SENTRY_DSN`
  (browser). Web + agent exceptions in one place.

### How the gating works (and why the build stays green)

- **Web** — `apps/web/lib/observability.ts` exposes `initObservability()` +
  `captureError()`; `apps/web/instrumentation.ts` calls it from Next's
  `register()` hook. With no DSN it returns immediately. `@sentry/nextjs` is
  **not** a dependency: the dynamic import uses a **non-literal specifier** so
  neither `tsc` nor `next build` resolves it, and a missing package is caught at
  runtime. To enable: `pnpm add @sentry/nextjs` (in `apps/web`) and set a DSN.
- **Agent** — `apps/agent/src/deepinterview_agent/core/observability.py` exposes
  `init_observability(settings)` (called once from `app.create_app()` and both
  workers' `main()`/`entrypoint`); per-call tracing lives in
  `core/tracing.py` (`start_trace` / `start_span` / `add_event` / `traced` /
  `TracedLLM` + `list_traces` / `read_trace` for the viewers).
  `sentry-sdk` / `langfuse` are the **`observability`** optional extra (not
  installed by default); imports are lazy + `try/except ImportError`, and every
  tracing path is best-effort (never raises into a prep run or live turn).

---

## 7. Cost note

Voice has real marginal cost per interview until optimized. Keep the live loop
lean (one fast model, precomputed plan, no blocking I/O on the turn path), and
watch the per-interview cost trend in Langfuse. Singapore co-location keeps RTT
— and thus session length and retry cost — down. The open-source build is
uncapped (self-host, bring-your-own-keys); per-tier interview caps and billing
are a hosted concern that lives in the private cloud fork, not here.

---

## 8. Checklist

- [ ] Supabase project in `ap-southeast-1`; R2 bucket created.
- [ ] Secrets set on Vercel + LiveKit Cloud (+ container host).
- [ ] `vercel.json` linked to the Vercel project (region `sin1`).
- [ ] Worker image built with `--extra livekit`; deployed to LiveKit Cloud SGP.
- [ ] Coach worker deployed with `LIVEKIT_COACH_AGENT_NAME`; spoken Socratic dispatch tested.
- [ ] Healthchecks green: web `/api/health`, agent-api `/health`, lightrag `/health`.
- [ ] (Optional) `SENTRY_DSN` + `LANGFUSE_*` set; uncomment deploy CLI steps.
- [ ] If using SQLite, `SQLITE_PATH` is set and its directory is mounted; otherwise accept memory-only history.
