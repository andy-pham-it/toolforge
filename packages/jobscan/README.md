# @andy-toolforge/jobscan

Freemium job-scan CLI — scan ATS boards (Greenhouse / Lever / Ashby / SmartRecruiters / Workable / Recruitee / Pinpoint / Personio / RemoteOK) against a local resume, report keyword gaps. Local heuristic in free, LLM-tuned bullets in pro.

## Install

```bash
npm i -g @andy-toolforge/jobscan
# or inside monorepo
npm install
```

## Quick start

```bash
# example resume
cp packages/jobscan/templates/resume.example.json ./resume.json

# free scan (no LLM, zero cost)
jobscan scan --provider greenhouse --company datadog --resume ./resume.json

# free -> pro placeholder
# [Pro: run with --pro to see tailored bullets]

# with license
export JOBSCAN_LICENSE_PUBLIC_KEY="your-server-hmac-secret"
jobscan license verify <key> --sig <hmac> --tier pro --expires 2026-12-31T00:00:00.000Z
jobscan license status
jobscan scan --provider greenhouse --company datadog --resume ./resume.json --pro
```

## Free vs Pro

| Feature | Free | Pro (`--pro` + valid license) |
|---------|------|-------------------------------|
| Heuristic match (score, matched/missing, suggestions) | ✓ | ✓ |
| `tailoredBullets`, `coverLetterHint`, `llmSuggestions` | — (placeholder) | ✓ via `@andy-toolforge/core` LLMClient |
| `export --format md` pro section | stripped | included |
| Batch (`jobscan batch`) | ✓ | ✓ (pro adds LLM fields when licensed) |

Pro uses Groq/Gemini via `@andy-toolforge/core` `LLMClient` adapter chain. Cost ~$0.01–0.03 per scan (depends on provider/model). Free never calls LLM — verified by `lib/llm.test.js` spy.

## Providers (9 real, verified live — no stubs)

- Greenhouse (`boards-api.greenhouse.io`)
- Lever (`api.lever.co`)
- Ashby (`api.ashbyhq.com`)
- SmartRecruiters (`api.smartrecruiters.com` — list + N+1 detail fetch; IDs case-sensitive, e.g. `BoschGroup`)
- Workable (`apply.workable.com` widget API, `?details=true` for inline descriptions)
- Recruitee (`{company}.recruitee.com/api/offers/` — no-auth Careers Site API)
- Pinpoint (`{slug}.pinpointhq.com/postings.json` — e.g. `workwithus`)
- Personio (`{company}.jobs.personio.de/xml` — official XML feed, regex-parsed with zero new deps)
- RemoteOK (`remoteok.com/api` — board-wide feed, no company slug; `--company` acts as optional company-name filter, use `all` for newest)

Each honors `User-Agent: jobscan/0.3.0`, ≥2s gap + `Retry-After` / exponential backoff (3 retries). Greenhouse additionally checks `robots.txt` (best-effort). Research notes for the remaining ATS platforms live in `ROADMAP.md` — no stub files shipped. Workday and Jobvite are deferred (see ROADMAP).

## Data attribution

RemoteOK data requires a dofollow backlink attribution when displayed publicly. CLI matching and local reports are fine, but any public rendering of RemoteOK job descriptions (exported dashboard, website) must credit RemoteOK with a link.

## Commands

```
jobscan scan --provider <greenhouse|lever|ashby|smartrecruiters|workable|recruitee|pinpoint|personio|remoteok> --company <slug> [--resume <path>] [--pro]
jobscan license verify <key> [--sig <sig>] [--tier pro|free] [--expires <iso>]
jobscan license status
jobscan dashboard [--last]
jobscan batch <file>        # CSV (provider,company) or NDJSON {provider, company}
jobscan update --resume <path>   # 3-way merge, preserves custom, writes *.merge-conflict on conflict
jobscan export --format json|md  # tier-gated via DATA_CONTRACT
```

Batch is pure Node (no `batch-runner.sh`) — works on Windows/macOS/Linux.

Dashboard is Ink-style plain renderer (`lib/dashboard.js`); fallback when Ink ESM not installed.

## Data contract

`schemas/data-contract.v1.json` splits `core` (always) vs `pro` (gated):

- core: `score`, `matchedKeywords`, `missingKeywords`, `suggestions`, `provider`, `url`, `fetchedAt`, `jobTitle`, `jobId`
- pro: `llmSuggestions`, `tailoredBullets`, `coverLetterHint`

`scanner.serialize(result, tier)` strips `pro` keys when `tier !== 'pro'`.

## License grace

`~/.config/jobscan/license.json` (0600, gitignored) is cache only — signature verified with `JOBSCAN_LICENSE_PUBLIC_KEY` (HMAC-SHA256 `tier|expiresAt|key`). Expired within 7 days + valid sig → still pro with warning; expired + 8 days → free. `XDG_CONFIG_HOME` overrides path for tests. Never commit `license.json` or plaintext secrets — hygiene check: `grep -r JOBSCAN_LICENSE_KEY packages/jobscan --include="*.json" --include="*.md"` must be empty (tested in CI).

## Update / 3-way merge

```
jobscan update --resume ./resume.json
```

- base = `resume.base.json` (last pulled)
- local = current `resume.json` (user edits, `custom` preserved)
- remote = latest scan suggestions

On conflict writes `resume.json.merge-conflict` (`<<<<<<<` markers) + `resume.json.merge-conflict.json` sidecar, does not overwrite original.

## Roadmap

See `ROADMAP.md` — provider research notes, deferred Workday/Jobvite, rejected Breezy (HTML-scrape), + Next.js dashboard v2 (deferred).

## Publish

Root `.github/workflows/publish.yml` checks `npm view @andy-toolforge/jobscan version` and publishes only on version bump. No per-package workflow.

## Testing

```bash
npm test -w @andy-toolforge/jobscan   # node --test lib/*.test.js
```
