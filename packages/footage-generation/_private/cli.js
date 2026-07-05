#!/usr/bin/env node
/**
 * cli.js — CLI wrapper for BrowserImageGenerator.
 *
 * Usage:
 *   node _private/cli.js <prompts-file> [output-dir]
 *   node _private/cli.js --login
 *
 * First-time setup:
 *   node _private/cli.js --login
 *   → Opens Chrome at gemini.google.com/images for login
 *   → Log in with your Google account, then Ctrl+C
 */

const path = require('path');
const BrowserImageGenerator = require('../lib/browser-generator');
const PromptParser = require('../lib/prompt-parser');

async function main() {
    const promptsFile = process.argv[2];
    const outputDir = process.argv[3];
    const isLoginMode = promptsFile === '--login';

    if (isLoginMode) {
        console.log('🔑 Login mode: opening Chrome for Gemini login...');
        console.log('1. Go to https://gemini.google.com/images');
        console.log('2. Log into your Google account');
        console.log('3. Close the window when done\n');

        const gen = new BrowserImageGenerator();
        await gen.ensureChromeRunning(true);
        const { page } = await gen.connect();
        await page.goto('https://gemini.google.com/images', { waitUntil: 'domcontentloaded' });
        console.log('✅ Page opened. Log in, then press Ctrl+C to exit.\n');
        await new Promise(() => {});
        return;
    }

    if (!promptsFile) {
        console.log('Usage:');
        console.log('  node _private/cli.js --login');
        console.log('  node _private/cli.js <prompts-file> [output-dir]');
        process.exit(1);
    }

    const resolvedPromptsFile = path.resolve(promptsFile);
    const resolvedOutputDir = outputDir
        ? path.resolve(outputDir)
        : path.join(path.dirname(resolvedPromptsFile), 'images');

    if (!require('fs').existsSync(resolvedPromptsFile)) {
        console.error(`❌ Prompts file not found: ${resolvedPromptsFile}`);
        process.exit(1);
    }

    const prompts = PromptParser.parseFile(resolvedPromptsFile);
    if (prompts.length === 0) {
        console.error('❌ No structured prompts found.');
        process.exit(1);
    }

    console.log(`📋 Found ${prompts.length} prompts`);
    console.log(`📂 Output: ${resolvedOutputDir}\n`);

    const gen = new BrowserImageGenerator({
        logger: { info: (msg) => console.log(msg) },
    });

    // Progress callback
    const onProgress = (data) => {
        const pct = ((data.current / data.total) * 100).toFixed(0);
        const icons = { starting: '▶️', generating: '🎨', done: '✅', skipped: '⏩', failed: '❌' };
        const icon = icons[data.status] || '🔄';
        process.stdout.write(`\r${icon} [${pct}%] ${data.current}/${data.total} ${data.name} — ${data.status}`);
        if (['done', 'skipped', 'failed'].includes(data.status)) {
            process.stdout.write('\n');
        }
    };

    const result = await gen.generateBatch(prompts, resolvedOutputDir, { onProgress });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Done! ${result.successCount}/${result.totalCount} images generated.`);
    console.log(`📂 ${resolvedOutputDir}`);
    if (result.rateLimitRetries > 0) {
        console.log(`⚠️  Hit rate-limit ${result.rateLimitRetries} times, retried successfully.`);
    }
    if (result.skippedCount > 0) {
        console.log(`⏩ ${result.skippedCount} already existed (resumed).`);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
