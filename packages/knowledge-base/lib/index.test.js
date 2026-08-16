'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { KnowledgeBase, DEFAULT_DIR, slugify } = require('./index');

function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-'));
}

test('add persists an entry with id + createdAt to index.json', () => {
    const dir = tmpDir();
    const kb = new KnowledgeBase({ dir, adapters: [] });
    const entry = kb.add({ type: 'pattern', text: 'Prefer atomic writes', tags: ['writing', 'files'], source: 'retro-2026-08' });
    assert.ok(entry.id, 'should have an id');
    assert.ok(entry.createdAt, 'should have createdAt');
    assert.ok(entry.id.startsWith(slugify('pattern-Prefer atomic writes')), 'id should be slug+timestamp');
    assert.ok(fs.existsSync(path.join(dir, 'index.json')), 'index.json should be written');
    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].text, 'Prefer atomic writes');
});

test('add throws when text is missing or empty', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: [] });
    assert.throws(() => kb.add({}), /text is required/);
    assert.throws(() => kb.add({ text: '   ' }), /text is required/);
});

test('get returns the entry by id and null for unknown id', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: [] });
    const e = kb.add({ text: 'hello world' });
    assert.strictEqual(kb.get(e.id).text, 'hello world');
    assert.strictEqual(kb.get('nope-123'), null);
});

test('search matches query substring (case-insensitive) and tag filter', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: [] });
    kb.add({ type: 'fact', text: 'MongoDB supports TTL indexes', tags: ['db', 'mongodb'] });
    kb.add({ type: 'pattern', text: 'Use atomic tmp+rename writes', tags: ['files', 'atomic'] });

    const byQuery = kb.search({ query: 'ATOMIC' });
    assert.strictEqual(byQuery.length, 1);
    assert.strictEqual(byQuery[0].type, 'pattern');

    const byTag = kb.search({ tags: ['mongodb'] });
    assert.strictEqual(byTag.length, 1);
    assert.strictEqual(byTag[0].text, 'MongoDB supports TTL indexes');

    const both = kb.search({ query: 'writes', tags: ['files'] });
    assert.strictEqual(both.length, 1);
});

test('list filters by tags and type, newest first', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: [] });
    kb.add({ type: 'note', text: 'first', tags: ['a'] });
    kb.add({ type: 'pattern', text: 'second', tags: ['b'] });
    kb.add({ type: 'note', text: 'third', tags: ['a', 'b'] });

    const notes = kb.list({ type: 'note' });
    assert.strictEqual(notes.length, 2);
    assert.strictEqual(notes[0].text, 'third'); // newest first

    const tagB = kb.list({ tags: ['b'] });
    assert.strictEqual(tagB.length, 2);
});

test('forget removes the entry and reports ok', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: [] });
    const e = kb.add({ text: 'to be removed' });
    const res = kb.forget(e.id);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.removed.text, 'to be removed');
    assert.strictEqual(kb.get(e.id), null);
    assert.strictEqual(kb.forget('missing-1').ok, false);
});

test('status reports dir, entry count and adapter availability', () => {
    const kb = new KnowledgeBase({ dir: tmpDir(), adapters: ['supermemory', 'serena'] });
    kb.add({ text: 'one' });
    const st = kb.status();
    assert.strictEqual(st.dir, kb.dir);
    assert.strictEqual(st.entries, 1);
    assert.strictEqual(typeof st.adapters.supermemory, 'boolean');
    assert.strictEqual(typeof st.adapters.serena, 'boolean');
});

test('missing adapters silently fall back to filesystem (no throw)', () => {
    const dir = tmpDir();
    const kb = new KnowledgeBase({ dir, adapters: ['supermemory'] }); // likely not on PATH
    const e = kb.add({ text: 'still stored' }); // must not throw
    assert.ok(kb.get(e.id));
    assert.strictEqual(kb._available('supermemory'), hasCliCheck('supermemory'));
});

function hasCliCheck(cmd) {
    try {
        require('node:child_process').execFileSync('which', [cmd], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

test('DEFAULT_DIR points under ~/.toolforge/kb', () => {
    assert.ok(DEFAULT_DIR.includes('.toolforge'));
    assert.ok(DEFAULT_DIR.includes('kb'));
});

test('corrupt index.json degrades to empty store without crashing', () => {
    const dir = tmpDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.json'), '{not valid json');
    const kb = new KnowledgeBase({ dir, adapters: [] });
    assert.deepStrictEqual(kb.list(), []);
    const e = kb.add({ text: 'recovered' });
    assert.ok(kb.get(e.id));
});
