'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_FILENAME = 'sdlc-workflows.json';

/**
 * Read and check the installed version manifest against the current package version.
 * @param {string} manifestDir — path to `.opencode/manifests/`
 * @param {string} pkgVersion — current package.json version
 * @returns {object} { packageName, installedVersion, packageVersion, driftDetected, templateCount, installedAt, reason }
 */
function checkManifest(manifestDir, pkgVersion) {
  const manifestPath = path.join(manifestDir, MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    return {
      packageName: '@andy-toolforge/sdlc-workflows',
      installedVersion: null,
      packageVersion: pkgVersion,
      driftDetected: true,
      templateCount: 0,
      installedAt: null,
      reason: 'Manifest not found — postinstall may not have run',
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return {
      packageName: '@andy-toolforge/sdlc-workflows',
      installedVersion: null,
      packageVersion: pkgVersion,
      driftDetected: true,
      templateCount: 0,
      installedAt: null,
      reason: 'Manifest corrupted — unable to parse',
    };
  }

  const driftDetected = manifest.installedVersion !== pkgVersion;

  return {
    packageName: manifest.package || '@andy-toolforge/sdlc-workflows',
    installedVersion: manifest.installedVersion,
    packageVersion: pkgVersion,
    driftDetected,
    templateCount: (manifest.templates || []).length,
    installedAt: manifest.installedAt,
    reason: driftDetected
      ? `Package version ${pkgVersion} differs from installed ${manifest.installedVersion}. Run 'npm update @andy-toolforge/sdlc-workflows' to sync.`
      : undefined,
  };
}

/**
 * Diff installed templates against local overrides directory.
 * @param {Array} installedTemplates — array from manifest.templates
 * @param {string} localDir — path to `.opencode/templates/sdlc-workflows/`
 * @returns {{ added: string[], missing: string[], modified: string[], unchanged: string[] }}
 */
function diffTemplates(installedTemplates, localDir) {
  const result = { added: [], missing: [], modified: [], unchanged: [] };

  if (!fs.existsSync(localDir)) {
    result.missing = installedTemplates.map(t => t.id);
    return result;
  }

  const localFiles = new Set();
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      localFiles.add(entry.name.replace(/\.md$/, ''));
    }
  }

  const installedSet = new Map();
  for (const tpl of installedTemplates) {
    const localName = tpl.id.replace(/\//g, '-');
    installedSet.set(localName, tpl.id);
  }

  for (const localName of localFiles) {
    if (!installedSet.has(localName)) {
      result.added.push(localName);
    }
  }

  for (const [localName, tplId] of installedSet) {
    if (!localFiles.has(localName)) {
      result.missing.push(tplId);
    } else {
      result.unchanged.push(tplId);
    }
  }

  return result;
}

module.exports = { checkManifest, diffTemplates };
