#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { installSkills } = require('@andy-toolforge/core/lib/postinstall-skills');

// 1. Install skill files
installSkills({
  domain: 'sdlc-workflows',
  sourceDir: path.join(__dirname, 'skills'),
});

// 2. Generate version manifest
const pkg = require('./package.json');
const manifestDir = path.join(process.cwd(), '.opencode', 'manifests');
const manifestPath = path.join(manifestDir, 'sdlc-workflows.json');

fs.mkdirSync(manifestDir, { recursive: true });

// Scan templates directory
function scanTemplates(dir, prefix) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanTemplates(full, prefix ? `${prefix}/${entry.name}` : entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const id = prefix ? `${prefix}/${entry.name.replace(/\.md$/, '')}` : entry.name.replace(/\.md$/, '');
      const standard = entry.name.includes('agile') ? 'agile' : 'itil';
      const type = full.includes('/standards/') ? 'standard' : 'flow';
      results.push({ id, name: entry.name.replace(/\.md$/, ''), standard, type });
    }
  }
  return results;
}

const manifest = {
  package: '@andy-toolforge/sdlc-workflows',
  installedVersion: pkg.version,
  installedAt: new Date().toISOString(),
  templates: scanTemplates(path.join(__dirname, 'templates'), ''),
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[sdlc-workflows] Manifest written to ${manifestPath}`);
