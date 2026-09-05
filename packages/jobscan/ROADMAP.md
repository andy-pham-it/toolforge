# jobscan Roadmap

## Supported providers (9 — all verified live, no stubs)

| Provider | Endpoint | Notes |
|----------|----------|-------|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` | robots.txt check (best-effort) |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | |
| Ashby | `api.ashbyhq.com` | |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{id}/postings` | List carries no description → N+1 detail fetch per job; IDs case-sensitive (`BoschGroup`, `Equinox`) |
| Workable | `apply.workable.com/api/v1/widget/accounts/{slug}?details=true` | `details=true` required for inline description |
| Recruitee | `{company}.recruitee.com/api/offers/` | No-auth Careers Site API (per official docs); bare array or `{offers}` |
| Pinpoint | `{slug}.pinpointhq.com/postings.json` | `{data:[...]}` with inline description HTML (verified `workwithus`, 2026-09-06) |
| Personio | `{company}.jobs.personio.de/xml?language=en` | Official XML feed; regex-parsed, zero new deps; apply URL `/job/{id}?display=en` (verified `personio`, 2026-09-06) |
| RemoteOK | `remoteok.com/api` | Board-wide (no company slug); element [0] is legal notice, skipped; `--company` = client-side company-name filter (`all` = newest). Public display requires dofollow backlink attribution |

All: `User-Agent: jobscan/0.3.3`, ≥2s gap, 429 → `Retry-After` (3 retries).

## Deferred providers

### Workday

- **Status**: requires Playwright + legal review, deferred
- **Reason**: enterprise HR platform behind anti-bot; headless browser automation plus legal review of scraping policy needed. Revisit after core CLI stabilizes and Playwright dependencies are validated in the monorepo.

### Jobvite

- **Status**: deferred — no reliable public surface
- **Reason**: REST API is per-customer authenticated; the public Job Feed is opt-in per employer (off by default, extra cost). No unauthenticated JSON endpoint found (researched 2026-09-05). No stub shipped.

## Rejected (researched, will not implement without HTML scraping or API keys)

### Breezy

- `GET {slug}.breezy.hr/json` returns a live job array (verified `rhynocare`, 32 jobs, 2026-09-05) but items carry **no description** and posting pages are HTML — would require HTML scraping. Recruitee (inline description, no-auth) chosen instead.

### Teamtailor

- Official API is fully authenticated (per-tenant `X-Api-Key`, token issued per ATS account) — no public JSON surface. Public career pages (`jobs.teamtailor.com`, `careers.*`) are JS-rendered and would need HTML scraping. Deferred unless a no-auth feed is found (researched 2026-09-06).

## Future considerations

- AI-powered resume scoring and ranking
- Multi-language resume tailoring
- Integration with personal career coaching bots
- Real-time market salary data integration
- Next.js dashboard v2 (deferred; current dashboard is Ink-style plain renderer in `lib/dashboard.js`)
