#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { installSkills } = require('@andy-toolforge/core/lib/postinstall-skills');

const STANDARD_MAP = {
  'agile-prd': 'agile', 'ieee-29148': 'ieee-29148',
  'arc42': 'arc42', 'c4-model': 'c4',
  'iso-29119': 'iso-29119', 'ieee-829': 'ieee-829',
  'itil-runbook': 'itil', 'sre-runbook': 'sre',
  'agile-scrum': 'agile', 'itil-sre': 'itil',
};

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
      const baseName = entry.name.replace(/\.md$/, '');
      const id = prefix ? `${prefix}/${baseName}` : baseName;
      const standard = STANDARD_MAP[baseName] || 'unknown';
      const type = full.includes('/standards/') ? 'standard' : 'flow';
      const templateVersion = '1.0.0';
      results.push({ id, name: baseName, standard, type, version: templateVersion });
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
