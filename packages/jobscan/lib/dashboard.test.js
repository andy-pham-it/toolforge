'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { ScoreGauge, MissingKeywords, Suggestions, formatScan, renderDashboard, getLastScanPath, Dashboard } = require('./dashboard');

describe('ScoreGauge', () => {
  it('renders low/medium/high', () => {
    assert.match(ScoreGauge(10), /low/);
    assert.match(ScoreGauge(50), /medium/);
    assert.match(ScoreGauge(90), /high/);
  });
  it('bar length 20', () => {
    const out = ScoreGauge(50);
    assert.match(out, /\[█+░+\]/);
  });
});

describe('MissingKeywords', () => {
  it('empty -> none', () => { assert.match(MissingKeywords([]), /none/); });
  it('lists keywords', () => { assert.match(MissingKeywords(['react', 'node']), /react/); });
});

describe('Suggestions', () => {
  it('empty -> none', () => { assert.match(Suggestions([]), /none/); });
  it('lists suggestions', () => { assert.match(Suggestions(['add skill']), /add skill/); });
});

describe('formatScan', () => {
  it('formats scan with fields', () => {
    const out = formatScan({ score: 42, provider: 'greenhouse', jobTitle: 'Dev', url: 'http://x', missingKeywords: ['k8s'], suggestions: ['learn k8s'], fetchedAt: '2024-01-01' });
    assert.match(out, /Score: 42/);
    assert.match(out, /Missing Keywords/);
    assert.match(out, /Suggestions/);
  });
  it('handles missing scan', () => { assert.match(formatScan(null), /No scan data/); });
});

describe('renderDashboard', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('no scans yet message when missing file', () => {
    const p = path.join(tmpDir, 'missing.json');
    const msg = renderDashboard({ lastScanPath: p });
    assert.match(msg, /no scans yet/i);
  });

  it('renders last scan json', () => {
    const p = path.join(tmpDir, 'last-scan.json');
    fs.writeFileSync(p, JSON.stringify({ score: 77, provider: 'lever', jobTitle: 'Eng', missingKeywords: ['aws'], suggestions: ['add aws'] }));
    const out = renderDashboard({ lastScanPath: p });
    assert.match(out, /Score: 77/);
    assert.match(out, /aws/);
  });

  it('handles array last-scan (batch)', () => {
    const p = path.join(tmpDir, 'last-scan.json');
    fs.writeFileSync(p, JSON.stringify([{ score: 10, missingKeywords: ['x'] }, { score: 20 }]));
    const out = renderDashboard({ lastScanPath: p });
    assert.match(out, /Score: 10/);
  });
});
