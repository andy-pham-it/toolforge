#!/usr/bin/env node
'use strict';

const { program } = require('commander');

program
  .name('jobscan')
  .description('Freemium job-scan CLI for resume analysis and job matching')
  .version('0.3.1');

program
  .command('scan')
  .description('scan jobs and match against resume')
  .option('--provider <name>', 'provider: greenhouse|lever|ashby|smartrecruiters|workable|recruitee|pinpoint|personio|remoteok')
  .option('--company <slug>', 'company slug')
  .option('--resume <path>', 'path to resume file (json/yaml/md)')
  .option('--pro', 'enable pro features (requires valid license)')
  .action(async (opts) => {
    const { scanWithProvider, scan } = require('../lib/scanner');
    const { parseResume } = require('../lib/resume');
    const { tierCheck } = require('../lib/tier');
    const { loadCache } = require('../lib/license');
    const path = require('node:path');
    const fs = require('node:fs');
    try {
      // remoteok is board-wide: --company optional, defaults to 'all' (newest jobs)
      if (!opts.provider) throw new Error('--provider is required (try --provider remoteok --company all)');
      if (!opts.company) {
        if (String(opts.provider).toLowerCase() === 'remoteok') opts.company = 'all';
        else throw new Error('--company is required (e.g. --provider greenhouse --company datadog; for RemoteOK use --provider remoteok --company all)');
      }
      if (String(opts.company).toLowerCase() === 'all' && String(opts.provider).toLowerCase() !== 'remoteok') {
        throw new Error("--company all chỉ áp dụng cho --provider remoteok (board tổng, không lọc theo công ty). Các provider khác cần slug công ty cụ thể, ví dụ: --provider greenhouse --company datadog hoặc --provider lever --company lever");
      }
      let resume = null;
      if (opts.resume) resume = parseResume(opts.resume);
      else {
        // try default locations
        const defaults = ['resume.json', 'resume.yaml', 'resume.yml', 'resume.md'];
        for (const f of defaults) if (fs.existsSync(f)) { resume = parseResume(f); break; }
        if (!resume) throw new Error('No resume found. Use --resume <path>');
      }
      const lic = loadCache();
      const tier = tierCheck(lic);
      if (opts.pro && tier !== 'pro') {
        console.error('LICENSE_REQUIRED: pro license required. Run `jobscan license status` or set JOBSCAN_LICENSE_PUBLIC_KEY.');
        process.exit(1);
      }
      let result;
      if (opts.pro && tier === 'pro') {
        // Pro: enrich with LLM tailored bullets per job
        const LLMClient = require('../lib/llm');
        const client = new LLMClient({ provider: process.env.JOBSCAN_LLM_PROVIDER || 'groq', apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || 'test' });
        const { getProvider } = require('../lib/providers');
        const mod = getProvider(opts.provider);
        const jobs = await mod.fetchJobs({ companySlug: opts.company, limit: 5 });
        result = [];
        for (const job of jobs) {
          const jd = job.description || job.title || '';
          let proData = null;
          try { proData = await client.tailorResume(resume, jd); } catch (_) { proData = null; }
          result.push(scan({ resume, jobDescription: jd, license: lic, provider: opts.provider, url: job.url, jobTitle: job.title, jobId: job.id, proData }));
        }
      } else {
        result = await scanWithProvider({ provider: opts.provider, company: opts.company, resume, license: lic, limit: 5 });
      }
      // persist last scan for dashboard
      try {
        const os = require('node:os');
        const dir = path.join(os.homedir(), '.config', 'jobscan');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'last-scan.json'), JSON.stringify(result, null, 2));
      } catch (_) {}
      console.log(JSON.stringify(result, null, 2));
      if (tier !== 'pro' && !opts.pro) console.log('\n[Pro: run with --pro to see tailored bullets]');
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  });

const license = program.command('license').description('license management');
license.command('verify <key>')
  .description('verify and cache a license key (expects sig via JOBSCAN_LICENSE_SIG or derived)')
  .option('--sig <sig>', 'HMAC signature for the license')
  .option('--tier <tier>', 'tier pro|free', 'pro')
  .option('--expires <iso>', 'expiry ISO date')
  .action((key, opts) => {
    const licMod = require('../lib/license');
    const tier = opts.tier || 'pro';
    const expiresAt = opts.expires || new Date(Date.now() + 30*24*60*60*1000).toISOString();
    const sig = opts.sig || process.env.JOBSCAN_LICENSE_SIG || '';
    const lic = { key, tier, expiresAt, sig };
    // if sig not provided, try to compute with current secret (for testing)
    if (!lic.sig) lic.sig = licMod.sign(lic);
    if (!licMod.verify(lic)) {
      console.error('License verification failed: invalid signature');
      process.exit(1);
    }
    licMod.saveCache(lic);
    console.log(`License verified: tier=${tier} expires=${expiresAt}`);
  });

license.command('status')
  .description('show cached license status')
  .action(() => {
    const licMod = require('../lib/license');
    const { tierCheck } = require('../lib/tier');
    const lic = licMod.loadCache();
    if (!lic) { console.log('No cached license (free tier)'); return; }
    const ok = licMod.verify(lic);
    const tier = tierCheck(lic);
    const grace = licMod.isGraceValid(lic);
    console.log(`tier: ${tier} verify:${ok ? 'ok' : 'fail'} graceValid:${grace} expires:${lic.expiresAt || 'none'}`);
  });

program
  .command('dashboard')
  .description('show last scan dashboard (Ink)')
  .option('--last', 'show last scan', true)
  .action(() => {
    const dash = require('../lib/dashboard');
    if (dash.renderDashboard) dash.renderDashboard();
    else console.log('Dashboard not yet implemented (Todo 8)');
  });

program
  .command('batch <file>')
  .description('run batch scans from CSV/NDJSON file')
  .action(async (file) => {
    const batch = require('../lib/batch');
    const res = await batch.runBatch(file);
    console.log(JSON.stringify(res, null, 2));
  });

program
  .command('update')
  .description('3-way merge resume with latest scan suggestions')
  .option('--resume <path>', 'resume file to update')
  .action(async (opts) => {
    const upd = require('../lib/update');
    const res = await upd.mergeResume(opts.resume);
    console.log(JSON.stringify(res, null, 2));
  });

program
  .command('export')
  .description('export last scan')
  .option('--format <fmt>', 'json|md', 'json')
  .action((opts) => {
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const { serialize, tierCheck } = require('../lib/tier');
    const { loadCache } = require('../lib/license');
    const p = path.join(os.homedir(), '.config', 'jobscan', 'last-scan.json');
    if (!fs.existsSync(p)) { console.error('No last scan found'); process.exit(1); }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const lic = loadCache();
    const tier = tierCheck(lic);
    const out = serialize(data, tier);
    if (opts.format === 'md') {
      let md = `# Jobscan Report\n\nScore: ${out.score}\n\nMatched: ${out.matchedKeywords?.join(', ')}\n\nMissing: ${out.missingKeywords?.join(', ')}\n`;
      if (out.suggestions) md += `\nSuggestions:\n${out.suggestions.map(s=>`- ${s}`).join('\n')}\n`;
      console.log(md);
    } else console.log(JSON.stringify(out, null, 2));
  });

program.parse();
