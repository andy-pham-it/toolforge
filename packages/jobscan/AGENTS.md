# @andy-toolforge/jobscan — Freemium Job-Scan CLI

> Domain package: scan ATS job boards (Greenhouse / Lever / Ashby) against a local
> resume, report keyword gaps. Free = local heuristic (zero LLM cost).
> Pro = LLM-tuned bullets via core `LLMClient`, gated by signed license.

## Structure

```
packages/jobscan/
  bin/
    jobscan.js      — CJS CLI (commander): scan, license, dashboard, batch, update, export
  lib/
    index.js        — Entry: re-exports resume/matcher/tier/scanner + license/LLMClient/providers
    resume.js       — parseResume (.json/.yaml/.md) + validateResume + normalizeResume
    matcher.js      — heuristicMatch(resume, jobDesc) → {score, matched/missing, suggestions}
    tier.js         — tierCheck(license) → 'free'|'pro'; serialize(result, tier) strips pro when free
    scanner.js      — scan() + scanWithProvider() orchestrate fetch → matcher → tier gating
    license.js      — HMAC-SHA256 verify/sign + cache (0600) + 7-day grace (isGraceValid)
    llm.js          — LLMClient extends CoreLLMClient; tailorResume() reads skill file
    dashboard.js    — Ink-style plain renderer for last-scan JSON
    batch.js        — runBatch(file): CSV/NDJSON → sequential scan → batch-report.json/md
    update.js       — 3-way merge (base/local/remote), preserves custom, *.merge-conflict on conflict
    providers/
      index.js      — getProvider(name) / listProviders() registry
      greenhouse.js / lever.js / ashby.js — fetchJobs + parseJob, rate-limit ≥2s, Retry-After, robots.txt
  schemas/
    resume.v1.json        — Canonical resume JSON Schema
    data-contract.v1.json — core (always) vs pro (gated) field split
  skills/
    postinstall.js              — installSkills({domain:'jobscan', sourceDir:__dirname})
    jobscan-resume-matcher.md   — Pro bullet-tailoring prompt
  templates/
    resume.example.json
```

## Conventions

- Free tier NEVER calls LLM (asserted by `lib/llm.test.js` spy). Pro only via `LLMClient.tailorResume()`.
- `license.json` at `~/.config/jobscan/license.json` is cache only — signature verified
  with `JOBSCAN_LICENSE_PUBLIC_KEY`. Never commit it or plaintext secrets.
- Providers: 3 real only. Remaining ~50 boards live in `ROADMAP.md` as planned — no stubs.
- Tier gating happens in `serialize()` before export — no pro leakage in free output.

## Testing

```bash
npm test -w @andy-toolforge/jobscan   # node --test lib/*.test.js (81 tests)
```
