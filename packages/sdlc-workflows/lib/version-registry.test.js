'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { checkManifest, diffTemplates } = require('./version-registry');

describe('checkManifest', () => {
  it('should return current state when manifest exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'sdlc-workflows.json'), JSON.stringify({
      package: '@andy-toolforge/sdlc-workflows',
      installedVersion: '0.2.0',
      installedAt: '2026-07-24T10:00:00Z',
      templates: [
        { id: 'prd/agile-prd', name: 'agile-prd', standard: 'agile', type: 'flow', version: '1.0.0' }
      ]
    }));

    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.packageName, '@andy-toolforge/sdlc-workflows');
    assert.strictEqual(result.installedVersion, '0.2.0');
    assert.strictEqual(result.templateCount, 1);
    assert.strictEqual(result.driftDetected, false);
  });

  it('should detect version drift when package version differs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'sdlc-workflows.json'), JSON.stringify({
      package: '@andy-toolforge/sdlc-workflows',
      installedVersion: '0.1.0',
      installedAt: '2026-07-20T10:00:00Z',
      templates: []
    }));

    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.packageVersion, '0.2.0');
    assert.strictEqual(result.installedVersion, '0.1.0');
  });

  it('should handle missing manifest gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.installedVersion, null);
  });
});

describe('diffTemplates', () => {
  it('should detect missing templates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const localDir = path.join(tmpDir, 'local');
    fs.mkdirSync(localDir, { recursive: true });

    const installed = [
      { id: 'prd/agile-prd', name: 'agile-prd' },
      { id: 'brd/ieee-29148', name: 'ieee-29148' },
    ];

    const result = diffTemplates(installed, localDir);
    assert.deepStrictEqual(result.missing, ['prd/agile-prd', 'brd/ieee-29148']);
  });
});
