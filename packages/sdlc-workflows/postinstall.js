#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { globSync } = require('glob');
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

function scanTemplates() {
  const templatesDir = path.join(__dirname, 'templates');
  const results = [];
  if (!fs.existsSync(templatesDir)) return results;

  const matches = globSync('**/*.md', { cwd: templatesDir, nodir: true });
  for (const match of matches) {
    if (match.startsWith('partials/')) continue;

    const parsed = path.parse(match);
    const baseName = parsed.name;
    const prefix = parsed.dir;
    const id = prefix ? `${prefix}/${baseName}` : baseName;
    const standard = STANDARD_MAP[baseName] || 'unknown';
    const type = prefix.includes('standards') ? 'standard' : 'flow';
    const templateVersion = '1.0.0';
    results.push({ id, name: baseName, standard, type, version: templateVersion });
  }
  return results;
}

const manifest = {
  package: '@andy-toolforge/sdlc-workflows',
  installedVersion: pkg.version,
  installedAt: new Date().toISOString(),
  templates: scanTemplates(),
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[sdlc-workflows] Manifest written to ${manifestPath}`);
