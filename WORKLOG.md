# OpenInterview Work Log

This file is the single source of truth for transition work. Update it after every meaningful state change.

## Goals

- Turn OpenInterview into an independently maintained product fork.
- Ship the transition one work item at a time, with checks and review evidence recorded here.

## Tasks

- [x] **1. Trust and security**
  - [x] Rebuild upstream PR #113 against current dependency advisories.
  - [x] Scan the fork with Trivy and record remaining accepted risk.
  - [x] Add web Docker-image build coverage (local image build verified).
  - [x] Verify fork Actions run after push.
  - [ ] **Follow-up:** run the agent API and worker containers as non-root (`DS-0002`).
    Implemented on `transition/nonroot-agent`; awaiting independent review and merge.
- [ ] **2. Brand and conversion**
  - [ ] Replace remaining user-facing DeepInterview branding and upstream clone links.
  - [ ] Enable and configure fork Issues.
- [ ] **3. Retention instrumentation**
  - [ ] Measure completed interviews, report-to-coach clicks, repeat practice, cost, and local turn latency.
- [ ] **4. Product differentiation**
  - [ ] Ship skill-pack provenance on reports (upstream issue #54).
  - [ ] Add the missing system-design and coding-round skill packs (upstream issue #38 remainder).
- [ ] **5. Managed-cloud validation**
  - [ ] Test demand for managed hosting before building billing or team features.

## Currently doing

- **Item:** 1 follow-up — non-root agent image (accepted `DS-0002`)
- **Branch:** `transition/nonroot-agent`
- **Worktree:** `/home/keen/open_source/DeepInterview-worktrees/nonroot-agent`
- **Baseline:** main `25b998a8dc1d7efbe1d2e5b9f36cbc7a7909c31d`
- **Ship lead:** Muse 1.3
- **Implementer:** DeepSeek Flash
- **Status:** Implementation complete 2026-11-28 (DeepSeek Flash). Both agent images run as `appuser` (uid 10001); Trivy misconfig `DS-0002` is cleared; CI now builds/loads both targets and checks non-root execution, an offline baked-model load, and a real trace write. PR #8 review fix round 1 applied (removed the recursive chown layers, tightened the CI proofs). Awaiting review/merge.
- **Notes:** Close accepted `DS-0002` before moving to brand/conversion.

## Done

### 1. Trust and security — merged

- PR: https://github.com/KeentGG/OpenInterview/pull/7
- Merge commit: `89bdf76cf42abf70f9487adf765ca34750ec3f82`
- Branch: `transition/trust-security`
- Worktree: `/home/keen/open_source/DeepInterview-worktrees/trust-security` (removed after merge)
- Final CI: https://github.com/KeentGG/OpenInterview/actions/runs/46157866147
- Checks: 264 passed, 1 skipped; security, gitleaks, build, and Docker smoke all passed.
- Review: correctness, security, and test/durability reviews found no remaining issue.
- Notes: Next 16.4.6 and Python locks are current; Trivy reports 0 HIGH/CRITICAL vulnerabilities and 0 secrets. `DS-0002` remains as the next follow-up.

## Plan — Item 1 Trust/security (planning pass, no product code touched)

Rebuild upstream PR #113 against 2026-11-28 registry/advisory data (OSV + npm/PyPI),
with two corrections: Next target is 16.4.6 (not PR's stale 16.3.8), pypdf floor is
>=6.21.4 (not PR's 6.20.0). See Decisions below for evidence.

### Implementer work (DeepSeek Flash)
1. JS: `apps/web/package.json` next 16.2.11 -> 16.4.6; `pnpm-workspace.yaml`
   overrides += `sharp: ^0.35.5`, `source-map-js: ^1.2.2` (PR's floors, still
   needed: `next` pulls postcss; postcss pulls source-map-js 1.2.1).
   Regenerate: `corepack enable && pnpm install` (NOT `--lockfile-only`; allowBuilds
   covers esbuild/sharp non-interactively).
2. Agent: `cd apps/agent && uv lock --upgrade-package pyjwt --upgrade-package urllib3
   --upgrade-package langgraph-sdk` -> expect pyjwt 2.15.1, urllib3 2.8.0,
   langgraph-sdk 0.4.6. Then `uv sync`.
3. Lightrag: `cd services/lightrag && uv lock --upgrade-package starlette
   --upgrade-package fastapi --upgrade-package cryptography --upgrade-package urllib3
   --upgrade-package pypdf --upgrade-package lightrag-hku --upgrade-package transformers
   --upgrade-package sentence-transformers --upgrade-package mineru --upgrade-package gradio`
   Expect: starlette 1.7.x, fastapi 0.143.x, cryptography 50.0.x, urllib3 2.8.0,
   pypdf >=6.21.4 (REJECT 6.20.0 — still 16 OSV vulns; accept resolver's 6.21.4+/7.x),
   lightrag-hku >=1.5.7, transformers 5.19.x, sentence-transformers 6.1.x,
   mineru 4.0.x, gradio 6.30.x. Then `uv sync`.
   Do NOT `gh pr checkout/merge 113`: re-derive via the resolvers so hashes match.
4. Web image fix: `apps/web/Dockerfile` deps stage add
   `COPY packages/ee/package.json packages/ee/package.json` (currently missing ->
   `pnpm install --frozen-lockfile` fails: lockfile importers include packages/ee
   and apps/web depends on @deepinterview/ee).
5. CI: `.github/workflows/ci.yml` docker-build job += web image step
   (context `.`, file `apps/web/Dockerfile`, push false, gha cache scope=web,
   build-args mirroring compose defaults: NEXT_PUBLIC_APP_URL/SITE_URL
   http://localhost:3000, SUPABASE_URL/ANON_KEY/SENTRY_DSN empty).
6. Focused checks only: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `uv sync` + pytest in both python projects (incl. lightrag 6 tests),
   `docker compose config -q` + `--profile local --profile live` passes,
   `docker build` all three images, `trivy fs` scan per scope below.
7. Stop conditions: Trivy fs reports 0 HIGH/CRITICAL, or any remainder is recorded
   below as accepted risk with justification; all checks above green; independent
   reviewer (non-implementer, via Main) re-runs Trivy + reviews diff and records
   evidence here before merge.

### Decisions
- Decided: Next target 16.4.6, not PR #113's 16.3.8. OSV: 16.2.11 has 16 vulns,
  16.3.8 still has 9 (incl RCE GHSA-2464-fhr4-w9xw + GHSA-673q-mjm6-r5xr fixed in
  16.4.1, cookie/pinning issues fixed in 16.4.5); 16.4.6 has 0. npm stable latest
  is 16.4.6. next 16.4.6 pins postcss 8.5.23 (0 OSV vulns).
- Decided: keep PR's pnpm overrides sharp ^0.35.5 (0.34.5 has 3 libvips/libheif/
  librsvg vulns; 0.35.5 clean) and source-map-js ^1.2.2 (1.2.1 has DoS
  GHSA-68fv-2mgg-jv7q fixed in 1.2.2; still pulled via postcss + @tailwindcss/node).
- Decided: agent changes are exactly pyjwt 2.13.0->2.15.1 (=PyPI latest, fixes 29
  OSV vulns incl GHSA-ffc3, GHSA-8wjv, GHSA-9j54), urllib3 2.7.0->2.8.0 (=latest,
  fixes 6 incl GHSA-8988, GHSA-gh4c), langgraph-sdk 0.4.2->0.4.6 (minimal fixed in
  0.4.x line per GHSA-3fx2 fixed=['0.4.6','1.2.14']; 0 vulns at 0.4.6, so no jump
  to 0.4.14). Agent starlette 1.3.1, fastapi 0.140.0, cryptography 50.0.1, h2 4.4.1,
  transformers 5.14.1 all 0 OSV vulns -> no change.
- Decided: lightrag default runtime starlette 0.52.1->1.7.x (0 vulns; PR-tested),
  fastapi 0.140.0->0.143.x (PR-tested combo with starlette 1.x; fastapi 0.140 allows
  starlette>=0.46.0 unbounded so resolver may keep it — accept resolver only if
  fastapi stays on a 0-vuln version AND lightrag tests pass, else pin 0.143.x),
  cryptography 49.0.0->50.0.x (fixes GHSA-g6cj Bleichenbacher oracle, fixed 50.0.0),
  urllib3->2.8.0.
- Decided: REJECT PR's pypdf 6.20.0 (16 residual OSV vulns fixed in 6.21.1/6.21.3/
  6.21.4). Floor pypdf>=6.21.4 (0 vulns; 7.2.0 also 0). Accept whatever `uv lock`
  resolves >=6.21.4 (mineru/pdftext/pypdfium2 constraints decide 6.x vs 7.x).
- Decided: LightRAG `rag` extra stays opt-in (default image installs naive backend
  only) BUT its lockfile closure is still Trivy-scanned, so rebuild it: lightrag-hku
  ->>=1.5.7 (1.5.4 has 10 vulns incl auth bypass GHSA-f4vv, JWT confusion GHSA-8ffj;
  fixed in 1.5.5; 1.5.7/1.5.8 both 0 vulns), transformers 4.57.6->5.19.x (4.57.6 has
  11 incl RCE GHSA-29pf fixed 5.3.0; 5.19.0 has 0), sentence-transformers->6.1.x
  (5.6.1 already 0 vulns; bump is transformers-5 compat), mineru->4.0.x, gradio
  6.8.0->6.30.x (6.8.0 has 6 vulns fixed in 6.15.x/6.16.x; 6.30.0 has 0). Smoke-test
  with RAG_BACKEND=lightrag; if the rag stack fails its tests, record as known
  issue but do not block (default naive path is what ships).
- Decided: Trivy scope = `trivy fs --severity HIGH,CRITICAL
  --scanners vuln,secret,misconfig .` from worktree root, `--skip-dirs
  .git,node_modules,.venv,.next`. Same metric as PR #113 (filesystem scan). No
  `.trivyignore` pre-created; no `trivy image` required (heavy; fs covers lockfiles).
- Decided: DS-0002 (apps/agent/Dockerfile runs as root) is ACCEPTED RISK, deferred
  to a follow-up (per PR #113 reviewer note). Not in this ship. (lightrag image
  already drops to appuser; web runs as nextjs.)
- Decided: web Docker build CI uses dummy NEXT_PUBLIC args mirroring compose
  defaults (empty secrets-safe values); build-only validation, no push.
- Decided: toolchain stays Node 22 (CI + both Dockerfiles + .nvmrc) and
  python:3.11-slim. Upstream Node-25 / Python-3.15 PRs are invalid for this fork.
- Decided: planning pass edits NOTHING except WORKLOG.md (no manifest/lockfile/
  workflow/Dockerfile changes here); implementer makes all product edits.
- Decided: merge requires independent security review by a non-implementer
  (assigned via Main): re-run Trivy fs, review manifest diffs, confirm CI green,
  record evidence in WORKLOG Done section.

## Implementation evidence — 2026-11-28 (DeepSeek Flash)

- Branch: `transition/trust-security`
- Worktree: `/home/keen/open_source/DeepInterview-worktrees/trust-security`
- Implementation commits:
  - `0f82ddb` fix(deps): bump next to 16.4.6 and floor sharp/source-map-js
  - `673b8d3` fix(agent): refresh uv.lock security floors
  - `fd77435` fix(lightrag): refresh uv.lock with pypdf 7.2.0
  - `0e4e017` build(web): copy ee manifest and build web image in CI
  - `ae66eb5` style(web): apply prettier to lint-failing files
  - `903a306` ci: pin Python 3.11 and harden web/security gates
  - `f0b7f84` ci: verify Python lockfiles are fresh
- Changed files: `apps/web/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `apps/web/next-env.d.ts`, `apps/agent/pyproject.toml`, `apps/agent/uv.lock`,
  `services/lightrag/pyproject.toml`, `services/lightrag/uv.lock`,
  `apps/web/Dockerfile`, `.github/workflows/ci.yml`,
  `apps/web/app/prep/page.tsx`, `apps/web/components/prep/mastery-graph.tsx`,
  `apps/web/components/theme-toggle.tsx`, `WORKLOG.md`.

### Resolved versions

| Scope | Package | Result |
| --- | --- | --- |
| JS | next | 16.4.6 |
| JS | sharp (override) | 0.35.5 |
| JS | source-map-js (override) | 1.2.4 (floor ^1.2.2) |
| agent | pyjwt | 2.15.1 |
| agent | urllib3 | 2.8.0 |
| agent | langgraph-sdk | 0.4.14 |
| agent | aiohttp / certifi / filelock | 3.14.5 / 2026.11.20 / 4.3.2 |
| agent | pillow / pyasn1 / soupsieve | 13.0.0 / 0.6.5 / 4.1.3 |
| lightrag | starlette / fastapi | 1.10.0 / 0.165.0 |
| lightrag | cryptography / urllib3 | 50.0.2 / 2.8.0 |
| lightrag | pypdf | 7.2.0 |
| lightrag | lightrag-hku / transformers | 1.5.8 / 5.24.1 |
| lightrag | sentence-transformers / mineru / gradio | 6.3.0 / 4.2.3 / 6.32.0 |
| lightrag | aiohttp / certifi / filelock | 3.14.5 / 2026.11.20 / 4.3.2 |
| lightrag | pillow / pyasn1 / soupsieve | 13.0.0 / 0.6.5 / 4.1.3 |

### Deviations and decisions from the plan

- Lockfiles were re-resolved with `pnpm`/`uv`; PR #113 was not copied.
- Agent resolver selected `langgraph-sdk` 0.4.14 rather than the plan's expected
  0.4.6. It is the same 0.4.x line, has 0 OSV advisories, and tests pass.
- LightRAG resolver selected newer versions than the plan's PR-derived
  expectations (starlette 1.10.0, fastapi 0.165.0, mineru 4.2.3, etc.). All are
  0-vulnerability under the 2026-11-28 Trivy DB and the default test suite passes.
  `pypdf` 7.2.0 satisfies the required >=6.21.4 floor.
- Trivy's NVD data found HIGH/CRITICAL advisories in aiohttp, certifi, filelock,
  pillow, pyasn1 and soupsieve that PR #113/OSV-only checks missed. Both Python
  locks were upgraded for these packages (pillow 12.3.0 -> 13.0.0, certifi
  2026.7.22 -> 2026.11.20, etc.) to reach the 0-finding stop condition.
- soupsieve 3+ requires Python >=3.11.5, so both Python projects now declare
  `requires-python = ">=3.11.5"` (was `>=3.11`). This stays on Python 3.11;
  `python:3.11-slim` is 3.11.18 and CI resolves 3.11.15+.
- `uv lock` warns `mineru==4.2.3 does not have an extra named core` because
  raganything 1.3.1 requests `mineru[core]` and mineru 4.x (including the
  planned 4.0.12) has no `core` extra. This is not introduced by the refresh;
  the RAG extra remains opt-in and the default naive backend is what ships/tests.
- Web Docker deps stage now copies `packages/ee/package.json`; without it the
  frozen workspace install fails. CI's `docker-build` job now builds the web
  image with compose-default public build args and a separate gha cache scope.

### Focused checks (all run in this worktree)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Up to date, exit 0 |
| `pnpm build --filter @deepinterview/web...` | 3/3 tasks successful; Next.js 16.4.6 compiled |
| `pnpm --filter @deepinterview/web typecheck` | exit 0 |
| `pnpm --filter @deepinterview/web test` | 5 files, 16 tests passed |
| `uv lock --check` + `uv sync --python 3.11` (agent) | OK |
| `uv run --python 3.11 pytest -q` (agent) | 212 passed, 1 skipped |
| `uv lock --check` + `uv sync --python 3.11` (lightrag) | OK |
| `uv run --python 3.11 pytest -q` (lightrag) | 6 passed |
| `pnpm --filter @deepinterview/agent run lint` | All checks passed (ruff) |
| `docker compose config -q` | OK |
| `docker compose --profile local --profile live config -q` | OK |
| agent image build (`--target api`) | success (`openinterview-agent:verify2`) |
| lightrag image build | success (`openinterview-lightrag:verify2`) |
| web image build (`apps/web/Dockerfile`) | success (`openinterview-web:verify`) |
| `pnpm lint` | Pass — prettier all files clean; agent ruff passed. The three previously unformatted web files were formatted in `ae66eb5` (formatting only). |
| `uv sync --extra rag --python 3.11` (lightrag) | Installed the optional stack, incl. torch 2.13.0 |
| Rag import smoke | `starlette 1.10.0`, `fastapi 0.165.0`, `cryptography 50.0.2`, `urllib3 2.8.0`, `pypdf 7.2.0`, `lightrag-hku 1.5.8`, `transformers 5.24.1`, `sentence-transformers 6.3.0`, `mineru 4.2.3`, `gradio 6.32.0`, `raganything 1.3.1`; `import starlette, fastapi, cryptography, pypdf, transformers, sentence_transformers, mineru, gradio, raganything, lightrag` -> imports OK |
| `RAG_BACKEND=lightrag` construct | `LightRAGBackend` constructed OK (skeleton; ingest/query remain NotImplemented) |
| `uv run --python 3.11 pytest -q` (lightrag, rag extra installed) | 6 passed |

Resolver rationale: the parent asked to confirm the newer-than-plan LightRAG versions
rather than accept drift silently. They were selected by `uv lock` as the latest
versions allowed by the existing ranges (plan examples came from PR #113's older
lock, not from hard pins). All listed versions are 0-vulnerability under the
2026-11-28 Trivy DB, the default FastAPI/Starlette test suite passes, and the
exact extra stack imports and constructs `LightRAGBackend` with `RAG_BACKEND=lightrag`.
No compatibility failure was observed, so no pin-back to the plan's example
versions was needed.

### Trivy filesystem scan

Exact command (Docker 29.3.1; Trivy container `aquasec/trivy:0.76.2`, digest
`sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb`):

```sh
docker run --rm -v "$PWD:/repo:ro" -v /tmp/trivy-out:/out -v trivy-cache:/root/.cache/ \
  aquasec/trivy:0.76.2 fs --severity HIGH,CRITICAL \
  --scanners vuln,secret,misconfig \
  --skip-dirs .git --skip-dirs node_modules --skip-dirs .venv --skip-dirs .next \
  --format json --output /out/report.json /repo
```

Report `CreatedAt` 2026-11-28T14:28:40Z:

| Target | Type | HIGH/CRITICAL vulns | Secrets | Misconfigs |
| --- | --- | --- | --- | --- |
| `apps/agent/uv.lock` | uv | 0 | 0 | — |
| `pnpm-lock.yaml` | pnpm | 0 | 0 | — |
| `services/lightrag/uv.lock` | uv | 0 | 0 | — |
| `apps/agent/Dockerfile` | dockerfile | — | 0 | 1 HIGH (DS-0002) |
| `apps/web/Dockerfile` | dockerfile | — | 0 | 0 |
| `services/lightrag/Dockerfile` | dockerfile | — | 0 | 0 |

Accepted risk: `DS-0002` — `apps/agent/Dockerfile` runs as root. Deferred to a
follow-up per the plan and PR #113 reviewer note; not fixed in this ship. No
other HIGH/CRITICAL vulnerability, secret, or misconfiguration remains.

### CI fix round — PR #7 (2026-11-28)

- PR: https://github.com/KeentGG/OpenInterview/pull/7
- Failed run: https://github.com/KeentGG/OpenInterview/actions/runs/46155610896
- Failed job: https://github.com/KeentGG/OpenInterview/actions/runs/46155610896/job/141011471911
- Replacement run: https://github.com/KeentGG/OpenInterview/actions/runs/46156714212
  — all jobs green (`build`, `docker-build`, `gitleaks`, `security`).
- Root cause: the `build` job had no Python pin. `uv sync` selected the runner's
  `/usr/bin/python3` (CPython 3.14.4), and `onnxruntime==1.20.1` has no cp314
  wheel:
  `error: Distribution onnxruntime==1.20.1 ... doesn't have a source
  distribution or wheel for the current platform`. `setup-uv@v5` installs uv but
  does not choose the interpreter. `docker-build` and `gitleaks` passed.
- Fixes:
  - `build` job sets `UV_PYTHON: "3.11"`, runs `actions/setup-python@v7` with
    `python-version: "3.11"` before any uv command, and uses
    `astral-sh/setup-uv@v10.4.0`. Agent and lightrag uv steps can no longer
    select 3.14.
  - Corrected both pyproject comments: CI pins 3.11 via `setup-python`; the
    runtime image remains `python:3.11-slim`.
  - Web image build now uses `load: true` and a stable tag
    (`openinterview-web:ci`), then boots it and polls `/api/health` and `/` for
    up to 60s, dumping `docker logs` on failure.
  - Added a `security` job with pinned `aquasec/trivy:0.76.2`:
    `fs --severity HIGH,CRITICAL --scanners vuln,secret --exit-code 1`.
    Misconfig scanning is intentionally excluded, so accepted `DS-0002` does
    not fail this gate.
  - Added `uv lock --check` gates for `apps/agent` (before sync) and
    `services/lightrag` (before pytest), so CI rejects stale committed
    lockfiles.

Local rechecks after the fix (all in this worktree):

| Check | Result |
| --- | --- |
| Workflow YAML parse | pass (jobs: security, gitleaks, build, docker-build) |
| `rhysd/actionlint:latest -color` | pass (exit 0) |
| `UV_PYTHON=3.11 uv sync --frozen` (agent) | `.venv` uses Python 3.11.15 |
| `UV_PYTHON=3.11 uv run pytest -q` (agent) | 212 passed, 1 skipped |
| `UV_PYTHON=3.11 uv sync --frozen` + pytest (lightrag) | Python 3.11.15; 6 passed |
| `UV_PYTHON=3.11 uv lock --check` (both) | pass |
| CI lock gates: `(cd apps/agent && UV_PYTHON=3.11 uv lock --check)`; `UV_PYTHON=3.11 uv --directory services/lightrag lock --check` | both pass (`Resolved … in 2ms`) |
| CI Trivy command (`vuln,secret`, `--exit-code 1`) | exit 0; 0 vulns/secrets on all three lockfiles |
| `docker buildx build --load -t openinterview-web:ci ...` | success |
| Web image boot smoke (`/api/health`, `/`) | pass; logs show Next ready (local port 3001 because host 3000 was occupied) |
| `pnpm lint` | pass |

### Remaining risks

- `DS-0002` agent image root user (accepted, above).
- The optional `rag` extra is not installed in the default image. It was installed
  in the local venv for an import smoke: the exact stack imports and constructs
  `LightRAGBackend` with `RAG_BACKEND=lightrag`; ingest/query remain skeleton
  `NotImplementedError`s, so no end-to-end RAG query is claimed. Its lock closure
  is Trivy-clean and the default NaiveRAG path passes tests. The `mineru[core]`
  extra warning predates this refresh and remains a known opt-in risk.
- CI/Actions: the first PR #7 run failed because uv selected Python 3.14 (see
  the CI fix round above). The replacement run
  https://github.com/KeentGG/OpenInterview/actions/runs/46156714212 passes all
  jobs: `build`, `docker-build`, `gitleaks`, and `security`.

## Status

- Planning complete 2026-11-28 (Muse 1.3 ship lead). Fork pins verified against
  OSV/npm/PyPI same-day data (see Decisions). Awaiting DeepSeek Flash implementation.
- Implementation complete 2026-11-28 (DeepSeek Flash). Focused checks green,
  including `pnpm lint` after formatting `ae66eb5`; Trivy fs 0 HIGH/CRITICAL
  vulnerabilities, one accepted HIGH misconfig (DS-0002).
- CI and review complete 2026-11-28. Final reviewed head:
  `fd9046feb1f375035905a7b3fa043acf43cde7b4`.
- Final CI: https://github.com/KeentGG/OpenInterview/actions/runs/46157866147
  — all four jobs passed (`security`, `gitleaks`, `build`, `docker-build`).
- Tests: 264 passed, 1 skipped (Vitest 46, agent 212, LightRAG 6).
- Correctness review: no remaining confirmed issues.
- Security audit: pass; 0 HIGH/CRITICAL vulnerabilities, 0 secrets, one accepted
  HIGH misconfig (`DS-0002`, agent image root user) recorded above.
- Test/durability review: no remaining gaps; Python 3.11 pin, web-image boot
  smoke, Trivy vuln+secret gate, and both `uv lock --check` gates verified.

## Plan — Item 1 follow-up: non-root agent image (planning pass, no product code touched)

Goal: run the `api` and `worker` runtime stages of `apps/agent/Dockerfile` as a
non-root user, clearing accepted Trivy HIGH misconfig `DS-0002`, without breaking
installs, baked model weights, SQLite, trace writes, or LiveKit startup.
Baseline: main `25b998a8dc1d7efbe1d2e5b9f36cbc7a7909c31d`.

### Startup / writable-path evidence (why the plan is shaped this way)

- `api` stage CMD and the compose `agent-api` command both run `uv run uvicorn
  deepinterview_agent.app:app --host 0.0.0.0 --port 8000` with `WORKDIR /app`.
  `worker` CMD / compose `agent-worker` command run `uv run python -m
  deepinterview_agent.worker start`. Port 8000 is unprivileged — no caps needed.
- Runtime writes: `uv run` needs a writable project (`.venv` under `/app`) plus a
  writable uv cache (`~/.cache/uv`); traces append to `TRACE_DIR` (default
  `.deepinterview/traces`, i.e. `/app/.deepinterview`, created on first write by
  `core/tracing.py:_append_event`); SQLite is opt-in via `SQLITE_PATH` (default
  unset = in-memory) and `sqlite_repository.py` creates parent dirs on open.
- The `worker-deps` model bake (`Plugin.download_files()` for silero +
  turn-detector) currently runs as root with default `HOME=/root`, so weights
  land in `/root/.cache`. If the runtime user cannot read them, the first live
  session stalls on a re-download — so the bake must target the runtime user's
  cache dir (see Decided below).
- Healthchecks (`docker-compose.yml`) run `python -c <urllib stdlib>` — no
  curl/wget needed, works unchanged as a non-root user.
- Precedent: `services/lightrag/Dockerfile` creates `appuser --uid 10001`,
  `chown -R appuser:appuser /app`, then `USER appuser`, and avoids `uv run` at
  runtime (`.venv/bin/python -m ...`). The agent keeps `uv run` instead (see
  Decided) so `docker-compose.yml` commands need no change.

### Implementer work (DeepSeek Flash)

1. `apps/agent/Dockerfile`, `base` stage, after `WORKDIR /app` — create the
   runtime user early and point caches at its home (BEFORE any bake step):
   `RUN useradd --create-home --uid 10001 appuser`
   `ENV HOME=/home/appuser HF_HOME=/home/appuser/.cache/huggingface
   UV_CACHE_DIR=/home/appuser/.cache/uv`
   (Do NOT add `USER` in `base` or `worker-deps` — installs and the model bake
   stay root; only file placement changes via the env above.)
2. `api` stage, after the final `RUN uv sync ...` and before `EXPOSE 8000`:
   `RUN chown -R appuser:appuser /app /home/appuser`
   `USER appuser`
   Leave `CMD ["uv", "run", "uvicorn", ...]` exactly as-is.
3. `worker` stage, after the final `RUN uv sync ...` and before the `CMD` comment:
   `RUN chown -R appuser:appuser /app /home/appuser`
   `USER appuser`
   Leave `CMD ["uv", "run", "python", "-m", ...]` exactly as-is.
4. No changes to `docker-compose.yml` (commands, healthchecks, ports), no volume
   additions, no application code changes.
5. Focused checks only (all in this worktree):
   - `docker build -f apps/agent/Dockerfile --target api -t agent-api:nonroot .`
   - `docker build -f apps/agent/Dockerfile --target worker -t agent-worker:nonroot .`
   - `docker run --rm agent-api:nonroot id -u` -> `10001`; same for worker image.
   - Boot api: `docker run -d -p 8000:8000 agent-api:nonroot`, poll
     `http://127.0.0.1:8000/health` until 200 (15s start period mirrors compose);
     `docker logs` must show no `Permission denied`; then
     `docker exec <c> touch /app/.deepinterview/.writetest` (trace dir writable).
   - Worker (no live keys needed): `docker run --rm agent-worker:nonroot uv run
     python -c "import deepinterview_agent.worker"` must exit 0 as appuser, and
     the baked weights must be readable: `docker run --rm agent-worker:nonroot
     ls -l /home/appuser/.cache` shows appuser-owned model files (no re-download
     stall at first session).
   - `docker compose config -q` and
     `docker compose --profile local --profile live config -q`.
   - Trivy DS-0002 gate: `docker run --rm -v "$PWD:/repo:ro"
     aquasec/trivy:0.76.2 fs --severity HIGH,CRITICAL --scanners misconfig
     --skip-dirs .git --skip-dirs node_modules --skip-dirs .venv --skip-dirs
     .next /repo` (or `--scanners vuln,secret,misconfig`) shows 0 HIGH/CRITICAL
     misconfigs; `apps/agent/Dockerfile` row must be clean.
   - Agent unit suite unchanged: `cd apps/agent && uv sync && uv run pytest -q`
     (212 passed, 1 skipped expected).
6. Stop/rollback conditions: revert the single Dockerfile commit (root images
   rebuild identically) if ANY of these hold — api `/health` does not reach 200
   as non-root; logs show `Permission denied` on `.venv`, trace dir, or cache;
   worker import fails as appuser; baked weights are missing/root-owned and the
   worker attempts a runtime download; Trivy still flags `DS-0002`.

### Decisions

- Decided: runtime user is `appuser --uid 10001`, matching
  `services/lightrag/Dockerfile` (one convention, no new uid scheme).
- Decided: `USER appuser` appears ONLY in the final `api` and `worker` stages;
  `base` and `worker-deps` (builder) stages stay root so `uv sync` and the model
  bake need no privilege rework.
- Decided: user creation + `HOME`/`HF_HOME`/`UV_CACHE_DIR` env live in `base`
  BEFORE the `worker-deps` bake, so silero/turn-detector weights land in
  `/home/appuser/.cache` (not `/root/.cache`) and are readable at runtime.
- Decided: keep runtime invocation as `uv run` (Dockerfile CMDs and compose
  `command:` blocks unchanged). Ownership (`chown /app /home/appuser`) plus the
  writable `UV_CACHE_DIR` make `uv run` work as non-root; this is the smallest
  diff. The LightRAG `.venv/bin/python` switch is the documented fallback if
  `uv run` proves uncooperative as appuser (it would then require paired
  Dockerfile CMD + compose command edits).
- Decided: each final stage does `chown -R appuser:appuser /app /home/appuser`
  (project + venv + trace dir + all caches), covering trace writes, `uv` cache,
  and HF/torch/LiveKit plugin caches with no extra `mkdir` or volume changes.
- Decided: no `docker-compose.yml` changes in this item (ports are unprivileged,
  healthchecks are stdlib-only, commands keep working). An operator-set
  `SQLITE_PATH` outside `/app` stays the operator's responsibility (mount a
  writable volume); the default in-memory store and `/app`-relative paths need
  nothing.
- Decided: no `.github/workflows/ci.yml` edits in this planning pass. Known gap
  for the implementer to report: `docker-build` only builds the `api` target, so
  the `worker` stage change is NOT covered by CI — recommend adding a
  worker-target build step (and a non-root `/health` boot smoke mirroring the
  web smoke) as a CI follow-up, owned by the ship lead. The `security` job is
  unaffected (it scans `vuln,secret` only, and `DS-0002` stays out of that gate).
- Decided: Trivy verification for this item is the `misconfig` scanner over the
  Dockerfile/filesystem (where `DS-0002` lives), not a heavier `trivy image`
  scan; same pinned `aquasec/trivy:0.76.2` invocation shape as the trust ship.
- Decided: planning pass edits NOTHING except `WORKLOG.md` (no Dockerfiles,
  workflows, or application code here); the implementer makes all product edits.
- Decided: merge requires an independent (non-implementer, via Main) re-run of
  the Trivy misconfig gate + review of the Dockerfile diff, with evidence
  recorded in this log before the brand/conversion item starts.

## Implementation evidence — Item 1 follow-up: non-root agent image (2026-11-28)

- Branch: `transition/nonroot-agent`
- Worktree: `/home/keen/open_source/DeepInterview-worktrees/nonroot-agent`
- Baseline: main `25b998a8dc1d7efbe1d2e5b9f36cbc7a7909c31d`
- Commits:
  - `38892e2f0935bdc954815dc27a5984e312240499` docs(worklog): plan non-root
    agent image follow-up
  - `752eb5002f7bc228d54fe2f530a8da69d2e015c1` build(agent): run the api and
    worker images as non-root appuser
  - `4f2367928271b5e229cb9a7b61279eb860f95e6e` ci: gate HIGH/CRITICAL
    Dockerfile misconfigs
  - `git log 25b998a8..HEAD` lists every commit, including the docs-only
    evidence updates and the runner-disk CI step
- Changed files: `apps/agent/Dockerfile`, `.github/workflows/ci.yml`,
  `WORKLOG.md`.

### What changed

- `apps/agent/Dockerfile` `base` stage, after `WORKDIR /app`:
  `useradd --create-home --uid 10001 appuser && chown appuser:appuser /app`,
  then `HOME=/home/appuser`, `HF_HOME=/home/appuser/.cache/huggingface`,
  `UV_CACHE_DIR=/home/appuser/.cache/uv`, then `USER appuser`. Every later
  stage inherits that user, so `uv sync` and the `worker-deps` model bake run
  as appuser and the uv cache / silero+turn-detector weights land under its
  home instead of `/root/.cache`.
- `COPY --chown=appuser:appuser` on the lockfiles and `apps/agent/src` keeps
  every project file appuser-owned, so the final stages need no recursive
  `chown` layer (only `EXPOSE`/`CMD` follow their last `uv sync`). CMDs,
  `docker-compose.yml` commands, healthchecks, ports, and application code are
  unchanged; no CMD change was needed because `uv run` works as appuser once
  `/app` and the caches are owned by it.
- `.github/workflows/ci.yml` `docker-build`: the API step now uses `load: true`
  with tag `openinterview-agent-api:ci`; a new step builds/loads the `worker`
  target as `openinterview-agent-worker:ci` with its own gha cache scope. The
  smoke step boots the API, polls `/health`, fails on any `Permission denied`
  log line, then writes a real trace with the baked `.venv/bin/python` (no
  `uv run`) and asserts the JSONL exists, contains `trace_start`, and is owned
  by uid 10001. The worker step runs the baked venv with `--network none` and
  `HF_HUB_OFFLINE=1`: it imports the worker plus silero/turn-detector, calls
  `Plugin.download_files()` on every registered plugin, and calls
  `silero.VAD.load()`, all as uid 10001. Two further steps cover the real
  startup paths: offline `.venv/bin/python -m deepinterview_agent.worker
  --help`, and the compose/CMD path `uv run python -c "import
  deepinterview_agent.worker, livekit.plugins.silero"` with the network
  available. A `Free runner disk space` step
  removes unused preinstalled toolchains first. The lightrag and web steps are
  unchanged.
- `.github/workflows/ci.yml` `security`: the Trivy gate now scans
  `vuln,secret,misconfig` at HIGH/CRITICAL. With `DS-0002` fixed and the whole
  repo verified at 0 findings under that exact command, a future root-user
  regression fails CI directly; the stale "accepted DS-0002 stays out of this
  gate" comment is corrected.

### Focused checks (all run in this worktree)

| Check | Result |
| --- | --- |
| `docker build -f apps/agent/Dockerfile --target api -t openinterview-agent-api:nonroot .` | success (2m00s) |
| `docker build -f apps/agent/Dockerfile --target worker -t openinterview-agent-worker:nonroot .` | success (5m04s). A first attempt succeeded through `chown` and failed only while unpacking the image because the host disk filled; freeing old build cache and rerunning the same build (no code change) produced the image |
| `docker run --rm openinterview-agent-api:nonroot id -u` | `10001` (`id -un` = `appuser`) |
| `docker run --rm openinterview-agent-worker:nonroot id -u` | `10001` (`id -un` = `appuser`) |
| API boot (`-d --name agent-api-smoke -p 8000:8000`) + `curl /health` | `200 {"ok":true}` after 7 polls; `docker exec ... id -u` = 10001 |
| `docker logs agent-api-smoke \| grep -i "permission denied"` | no match |
| `docker exec agent-api-smoke mkdir -p /app/.deepinterview && touch .writetest` | created as `appuser:appuser` |
| App-level trace write in the API image (`start_trace` + `add_event`) | wrote `/app/.deepinterview/traces/tr_de9beb20d77c.jsonl` as `appuser:appuser` |
| `docker exec agent-api-smoke uv run python -c "import deepinterview_agent.app"` | import ok as uid 10001 |
| `docker run --rm openinterview-agent-worker:nonroot uv run python -c "import deepinterview_agent.worker"` | import ok as uid 10001 |
| Baked weights location and ownership | `HF_HOME` holds 461M of `models--livekit--turn-detector` blobs (largest 396MB) and `silero_vad.onnx` (2.3MB) is in `.venv`; `find /home/appuser ! -user appuser` = 0 entries; `/root/.cache` absent |
| Offline re-bake as appuser: `docker run --rm --network none -e HF_HUB_OFFLINE=1 ... .venv/bin/python -c "…Plugin.download_files()…"` | succeeds from the baked cache as uid 10001 — no runtime download |
| `docker compose config -q` and `docker compose --profile local --profile live config -q` | both pass |
| Trivy `fs --severity HIGH,CRITICAL --scanners vuln,secret,misconfig` (`aquasec/trivy:0.76.2`, report `2026-11-28T15:26:38Z`) | exit 0; 0 findings on all six targets; `apps/agent/Dockerfile` misconfigs = 0, so `DS-0002` is gone |
| Exact CI `security` gate command (`--scanners vuln,secret,misconfig --exit-code 1`, `--no-progress`, same skip dirs) | exit 0 |
| Trivy misconfig, all severities (agent Dockerfile only) | only `DS-0026 LOW` (No HEALTHCHECK; compose defines the healthcheck) remains |
| `cd apps/agent && UV_PYTHON=3.11 uv sync --frozen && uv run pytest -q` | 212 passed, 1 skipped (baseline unchanged) |
| Workflow YAML parse + `rhysd/actionlint:latest` | jobs `security`, `gitleaks`, `build`, `docker-build`; actionlint exit 0 |

### Review fix round 1 — PR #8 (2026-11-28)

Independent review found three issues; all fixed in this round. The checklist
below supersedes the Dockerfile/CI description and build rows above; the other
previous checks were re-run against the final images.

Findings and fixes:

1. Each final stage ran `chown -R appuser:appuser /app /home/appuser`, which
   rewrote the whole venv + baked-weights tree into a ~3.2GB layer, duplicated
   in both images, and dominated build/export time. Fix: create the user and
   chown only the empty `/app` in `base`, `USER appuser` before every install
   and the model bake, `COPY --chown=appuser:appuser` for the lockfiles and
   source, and no chown in `api`/`worker`.
2. The CI worker proof used `uv run` and asserted nothing about the baked
   weights, so it did not show the image works without network. Fix: run the
   baked `.venv/bin/python` with `--network none` and `HF_HUB_OFFLINE=1`,
   import the worker + silero + turn_detector, call `Plugin.download_files()`
   and `silero.VAD.load()`, and assert uid 10001.
3. The API smoke only checked `/health`; nothing proved the app can write
   traces as the runtime user. Fix: write a real trace with
   `.venv/bin/python` and assert the JSONL exists, contains `trace_start`, and
   is owned by uid 10001.

Evidence (final images, local host):

| Check | Result |
| --- | --- |
| `docker build --target api` | success, 1m11s (was 2m00s) |
| `docker build --target worker` | success, 1m38s (was 5m04s; no export retry) |
| image sizes | api 1.29GB (was 2.31GB), worker 3.46GB (was 6.66GB) |
| `docker history --no-trunc <img> \| grep -c 'chown -R'` | 0 for both images; the 3.2GB layer is gone |
| ownership in both images | `/app`, `/app/.venv`, `/app/src`, `pyproject.toml`, `/home/appuser` and the HF cache are `appuser`-owned; 0 files under `/home/appuser` owned by another user |
| exact CI API smoke script (tag substituted) run locally | pass: `/health` 200, no `Permission denied`, trace `/app/.deepinterview/traces/tr_44b1458ede86.jsonl` owned by uid 10001 and contains `trace_start` |
| exact CI worker script (tag substituted) run locally | pass: `worker import + offline model load ok as uid 10001` with `--network none` and `HF_HUB_OFFLINE=1` |
| `docker run --rm <worker> .venv/bin/python` with `silero.VAD.load()` offline | loads a `VAD` |
| `docker run --rm <img> id -u` | 10001 for both |
| Trivy `fs --severity HIGH,CRITICAL --scanners vuln,secret,misconfig` (`2026-11-28T15:49:23Z`) | exit 0, 0 findings on all six targets |
| `docker compose config -q` / `--profile local --profile live config -q` | both pass |
| Workflow YAML parse + `rhysd/actionlint:latest` | pass (exit 0) |
| `uv sync --frozen` + `pytest -q` (agent) | 212 passed, 1 skipped |

Notes: `uv run` still works at runtime (CMD unchanged) because `/app`, the venv
and the caches are appuser-owned from creation. The CI shell scripts were
extracted from the workflow and executed verbatim with only the local image tag
substituted; PR #8's CI run for the new head has not been observed locally —
check it after the push.

### Final review guards — startup paths (2026-11-29)

Final review found no CI proof of the two startup paths that actually run, so
two steps now run against the already-built worker image (no rebuild, no
application code change):

1. Offline CLI: `docker run --rm --network none -e HF_HUB_OFFLINE=1
   openinterview-agent-worker:ci .venv/bin/python -m deepinterview_agent.worker
   --help` — the module entrypoint must start and print its commands without
   network or a weight/dependency fetch.
2. Networked `uv run` (the compose/CMD path): `docker run --rm
   openinterview-agent-worker:ci uv run python -c "import
   deepinterview_agent.worker, livekit.plugins.silero"`.

Evidence — both scripts extracted from the workflow and run verbatim against
the existing `openinterview-agent-worker:nonroot` image (tag substituted; no
rebuild):

| Check | Result |
| --- | --- |
| offline `python -m deepinterview_agent.worker --help` | exit 0; usage banner and `console`/`start`/`dev`/`connect`/`download-files` commands printed |
| `uv run python -c "import …worker, livekit.plugins.silero"` with network | exit 0; uv synced its dev deps from PyPI, proving the online runtime path |
| workflow YAML parse + `rhysd/actionlint:latest` | pass (exit 0) |

### Deviations, observations and remaining risks

- Deviated from the plan's "the `security` job is unaffected": its Trivy gate
  now includes the `misconfig` scanner. The plan excluded it only because
  `DS-0002` was an accepted finding; with the agent image fixed and the exact
  gate command verified at exit 0, including it makes the fix durable in CI and
  removes a now-false comment. No other `security`/`gitleaks`/`build` step
  changed.
- `uv run` at runtime performs an implicit `uv sync` and installs dev
  dependencies from PyPI on first container start (observed: ruff/pygments
  downloaded in the API and worker smoke logs). This predates this item — the
  root image behaved the same — and is unchanged here; it is why the venv and
  uv cache must be writable by the runtime user. Requiring egress at boot is a
  pre-existing deployment characteristic. The plan's documented fallback
  (`.venv/bin/python` plus paired compose edits) was not needed because
  `uv run` works as appuser.
- `DS-0026` (LOW, no Dockerfile `HEALTHCHECK`) remains by design: compose
  supplies healthchecks for both agent services. The closing gate is
  HIGH/CRITICAL only.
- The worker image is 3.46GB on disk and its build takes ~1m40s locally after
  the chown-layer removal (api: 1.29GB / ~1m11s). The docker-build job frees
  unused runner toolchains before building; PR #8's CI result for this new head
  has not been observed in the worktree — check the run after the push.
- Not run here: bringing up the full compose stack (lightrag + local models)
  and any LiveKit `start` with real keys — both are outside this item and need
  external services; the module import plus the offline weight check cover the
  changed paths.
- This fix round is pushed to `fork/transition/nonroot-agent`, the head of
  PR #8 (opened by the ship lead); the implementer did not merge it. An
  independent (non-implementer) re-run of the Trivy misconfig gate and a review
  of the final diff are still required before merge.
