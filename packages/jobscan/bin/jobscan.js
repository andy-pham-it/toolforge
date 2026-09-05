#!/usr/bin/env node
'use strict';

const { program } = require('commander');

program
  .name('jobscan')
  .description('Freemium job-scan CLI for resume analysis and job matching')
  .version('0.3.3');

program
  .command('scan')
  .description('scan jobs and match against resume (no args: uses jobscan.yml, else RemoteOK board)')
  .option('--provider <name>', 'provider: greenhouse|lever|ashby|smartrecruiters|workable|recruitee|pinpoint|personio|remoteok')
  .option('--company <slug>', 'company slug')
  .option('--url <careersUrl>', 'careers page URL — provider + slug inferred (e.g. https://boards.greenhouse.io/datadog)')
  .option('--resume <path>', 'path to resume file (json/yaml/md)')
  .option('--pro', 'enable pro features (requires valid license, single company only)')
  .action(async (opts) => {
    const { scanWithProvider, scan } = require('../lib/scanner');
    const { parseResume } = require('../lib/resume');
    const { tierCheck } = require('../lib/tier');
    const { loadCache } = require('../lib/license');
    const { parseCompaniesUrl, loadConfig, resolveEntry } = require('../lib/companies');
    const path = require('node:path');
    const fs = require('node:fs');
    function loadResume() {
      if (opts.resume) return parseResume(opts.resume);
      const defaults = ['resume.json', 'resume.yaml', 'resume.yml', 'resume.md'];
      for (const f of defaults) if (fs.existsSync(f)) return parseResume(f);
      throw new Error('No resume found. Use --resume <path>');
    }
    try {
      // Build target list: explicit args win, else jobscan.yml, else RemoteOK board.
      let targets = [];
      if (opts.url) {
        const hit = parseCompaniesUrl(opts.url);
        targets = [{ ...hit, label: opts.url }];
      } else if (opts.provider) {
        // remoteok is board-wide: --company optional, defaults to 'all' (newest jobs)
        if (!opts.company) {
          if (String(opts.provider).toLowerCase() === 'remoteok') opts.company = 'all';
          else throw new Error('--company is required (e.g. --provider greenhouse --company datadog; for RemoteOK use --provider remoteok --company all; or paste a careers URL with --url)');
        }
        if (String(opts.company).toLowerCase() === 'all' && String(opts.provider).toLowerCase() !== 'remoteok') {
          throw new Error("--company all chỉ áp dụng cho --provider remoteok (board tổng, không lọc theo công ty). Các provider khác cần slug công ty cụ thể, ví dụ: --provider greenhouse --company datadog hoặc --provider lever --company lever");
        }
        targets = [{ provider: opts.provider, companySlug: opts.company, label: `${opts.provider}:${opts.company}` }];
      } else {
        const cfg = loadConfig();
        const entries = (cfg && cfg.companies) || [];
        for (const e of entries) {
          const r = resolveEntry(e);
          if (r) targets.push(r);
          else console.error(`[skip] không nhận ra ATS, bỏ qua: ${e && e.url ? e.url : JSON.stringify(e)}`);
        }
        if (targets.length === 0) {
          console.error('[info] chưa có jobscan.yml — quét board tổng RemoteOK. Chạy `jobscan init` rồi thêm công ty để quét theo danh sách riêng.');
          targets = [{ provider: 'remoteok', companySlug: 'all', label: 'remoteok:all' }];
        }
      }
      const resume = loadResume();
      const lic = loadCache();
      const tier = tierCheck(lic);
      if (opts.pro && tier !== 'pro') {
        console.error('LICENSE_REQUIRED: pro license required. Run `jobscan license status` or set JOBSCAN_LICENSE_PUBLIC_KEY.');
        process.exit(1);
      }
      if (opts.pro && targets.length > 1) {
        throw new Error('--pro chỉ hỗ trợ 1 công ty/lần — dùng --url hoặc --provider/--company để quét riêng.');
      }
      let result;
      if (opts.pro && tier === 'pro') {
        // Pro: enrich with LLM tailored bullets per job (single target only)
        const LLMClient = require('../lib/llm');
        const client = new LLMClient({ provider: process.env.JOBSCAN_LLM_PROVIDER || 'groq', apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || 'test' });
        const { getProvider } = require('../lib/providers');
        const mod = getProvider(targets[0].provider);
        const jobs = await mod.fetchJobs({ companySlug: targets[0].companySlug, limit: 5 });
        result = [];
        for (const job of jobs) {
          const jd = job.description || job.title || '';
          let proData = null;
          try { proData = await client.tailorResume(resume, jd); } catch (_) { proData = null; }
          result.push({ ...scan({ resume, jobDescription: jd, license: lic, provider: targets[0].provider, url: job.url, jobTitle: job.title, jobId: job.id, proData }), company: targets[0].label });
        }
      } else {
        result = [];
        for (const t of targets) {
          // One dead board must not kill the whole scan (career-ops: skipped_error + continue).
          try {
            const rows = await scanWithProvider({ provider: t.provider, company: t.companySlug, resume, license: lic, limit: 5 });
            for (const r of rows) result.push({ ...r, company: t.label });
          } catch (e) {
            console.error(`[error] ${t.label}: ${e.message} — bỏ qua, tiếp tục quét.`);
          }
        }
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

program
  .command('init')
  .description('create jobscan.yml with your company list (bare `jobscan scan` uses it)')
  .action(() => {
    const { initConfig } = require('../lib/companies');
    try {
      const p = initConfig();
      console.log(`Đã tạo ${p} — sửa danh sách companies rồi chạy \`jobscan scan\`. Thêm URL: \`jobscan companies --add <careers-url>\`.`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  });

program
  .command('companies')
  .description('manage company list in jobscan.yml')
  .option('--add <careersUrl>', 'add a company by careers page URL (provider inferred)')
  .option('--list', 'list saved companies')
  .action((opts) => {
    const comp = require('../lib/companies');
    try {
      if (opts.add) {
        const { inferred } = comp.addCompany(opts.add);
        if (inferred) console.log(`Đã thêm: ${opts.add} → ${inferred.provider}:${inferred.companySlug}`);
        else console.log(`Đã thêm: ${opts.add} (chưa nhận ra ATS — scan sẽ bỏ qua, hãy kiểm tra lại URL)`);
      } else {
        const cfg = comp.loadConfig();
        if (!cfg || cfg.companies.length === 0) {
          console.log('Chưa có công ty nào. Chạy `jobscan init` hoặc `jobscan companies --add <careers-url>`.');
          return;
        }
        for (const e of cfg.companies) {
          const r = comp.resolveEntry(e);
          console.log(`- ${e.url || JSON.stringify(e)}${r ? ` → ${r.provider}:${r.companySlug}` : ' (chưa nhận ra ATS)'}`);
        }
      }
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
