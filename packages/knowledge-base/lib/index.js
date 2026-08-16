'use strict';

/**
 * @andy-toolforge/knowledge-base
 *
 * Filesystem-first knowledge base facade for AI agents. Agents (and client
 * projects) get a zero-dependency CRUD/search store that works everywhere —
 * no service, no network, no schema. The same store is what the
 * knowledge-base-management skill drives, and it can optionally mirror
 * entries into external memory CLIs (Supermemory, Serena) on a best-effort
 * basis: if the CLI is on PATH we try, if it isn't (or it fails) we silently
 * fall back to the filesystem store.
 *
 * Store layout:
 *   <dir>/index.json   — JSON array of entries (atomic writes via tmp+rename)
 *
 * Entry shape:
 *   { id, type, text, tags: string[], source, createdAt }
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const DEFAULT_DIR = path.join(os.homedir(), '.toolforge', 'kb');

const TYPES = ['note', 'fact', 'decision', 'pattern', 'error-solution', 'reference'];

/** Lowercase alphanumeric slug, max 60 chars. */
function slugify(str) {
    return String(str)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/** True when `cmd` is on PATH. */
function hasCli(cmd) {
    try {
        execFileSync('which', [cmd], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

class KnowledgeBase {
    /**
     * @param {object} [opts]
     * @param {string} [opts.dir]  Store directory (default ~/.toolforge/kb).
     * @param {string[]} [opts.adapters]  External CLIs to mirror to on add()
     *   (default ['supermemory', 'serena'] — each used only if present on PATH).
     */
    constructor({ dir = DEFAULT_DIR, adapters = ['supermemory', 'serena'] } = {}) {
        this.dir = dir;
        this.adapters = adapters;
        this.indexFile = path.join(dir, 'index.json');
        fs.mkdirSync(dir, { recursive: true });
    }

    // -- storage -----------------------------------------------------------

    _load() {
        if (!fs.existsSync(this.indexFile)) return [];
        try {
            const raw = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
            return Array.isArray(raw) ? raw : [];
        } catch {
            // Corrupt store: don't crash the caller — treat as empty.
            return [];
        }
    }

    _save(entries) {
        const tmp = `${this.indexFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf8');
        fs.renameSync(tmp, this.indexFile); // atomic on same filesystem
    }

    // -- adapters (best-effort, silent fallback) ---------------------------

    _available(cmd) {
        return this.adapters.includes(cmd) && hasCli(cmd);
    }

    /** Run an external CLI; never throws (failures fall back to filesystem). */
    _tryAdapter(cmd, args) {
        if (!this._available(cmd)) return null;
        try {
            return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
        } catch {
            return null;
        }
    }

    _mirrorAdd(entry) {
        const text = `[${entry.type}] ${entry.text}${entry.source ? ` (source: ${entry.source})` : ''}`;
        this._tryAdapter('supermemory', ['add', '--type', entry.type, '--scope', 'project', text]);
        // Serena has no stable standalone CLI contract today; reserved so a
        // future serena CLI is picked up automatically.
        this._tryAdapter('serena', ['add', '--type', entry.type, text]);
    }

    // -- CRUD --------------------------------------------------------------

    /**
     * Add an entry. Always persists to the filesystem store first, then
     * mirrors to any available adapter (best-effort).
     *
     * @param {object} entry
     * @param {string} [entry.type]  One of TYPES (default 'note').
     * @param {string} entry.text    The knowledge content (required).
     * @param {string[]} [entry.tags]  Tags for filtering/search.
     * @param {string} [entry.source]  Where this knowledge came from.
     * @returns {object} The stored entry (with id + createdAt).
     */
    add({ type = 'note', text, tags = [], source = '' } = {}) {
        if (typeof text !== 'string' || !text.trim()) {
            throw new Error('KnowledgeBase.add: text is required');
        }
        const id = `${slugify(`${type}-${text}`) || 'entry'}-${Date.now().toString(36)}`;
        const entry = {
            id,
            type: TYPES.includes(type) ? type : 'note',
            text: text.trim(),
            tags: Array.isArray(tags) ? [...new Set(tags.map(String))] : [],
            source: String(source || ''),
            createdAt: new Date().toISOString(),
        };
        const entries = this._load();
        entries.push(entry);
        this._save(entries);
        this._mirrorAdd(entry); // best-effort; never throws
        return entry;
    }

    /** @returns {object|null} Entry with matching id. */
    get(id) {
        return this._load().find(e => e.id === id) || null;
    }

    /**
     * Full-text search over text/type/source plus optional tag filter.
     *
     * @param {object} [opts]
     * @param {string} [opts.query]  Case-insensitive substring.
     * @param {string[]} [opts.tags]  Entry must contain at least one of these tags.
     * @param {number} [opts.limit]  Max results (default 50).
     * @returns {object[]} Matches, newest first.
     */
    search({ query = '', tags = [], limit = 50 } = {}) {
        const q = String(query).toLowerCase().trim();
        const tagSet = Array.isArray(tags) ? new Set(tags.map(String)) : new Set();
        return this._load()
            .filter(e => {
                if (q && !(
                    e.text.toLowerCase().includes(q) ||
                    e.type.toLowerCase().includes(q) ||
                    e.source.toLowerCase().includes(q)
                )) return false;
                if (tagSet.size > 0 && !e.tags.some(t => tagSet.has(t))) return false;
                return true;
            })
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, Math.max(0, Number(limit) || 50));
    }

    /**
     * List entries, optionally filtered by tags and/or type.
     * @returns {object[]} Entries, newest first.
     */
    list({ tags = [], type = '', limit = 100 } = {}) {
        const tagSet = Array.isArray(tags) ? new Set(tags.map(String)) : new Set();
        return this._load()
            .filter(e => {
                if (type && e.type !== type) return false;
                if (tagSet.size > 0 && !e.tags.some(t => tagSet.has(t))) return false;
                return true;
            })
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, Math.max(0, Number(limit) || 100));
    }

    /**
     * Remove an entry by id.
     * @returns {object} { ok, removed } — ok=false when id not found.
     */
    forget(id) {
        const entries = this._load();
        const idx = entries.findIndex(e => e.id === id);
        if (idx === -1) return { ok: false, removed: null };
        const [removed] = entries.splice(idx, 1);
        this._save(entries);
        return { ok: true, removed };
    }

    /** @returns {object} { dir, entries, adapters } store health summary. */
    status() {
        return {
            dir: this.dir,
            entries: this._load().length,
            adapters: {
                supermemory: this._available('supermemory'),
                serena: this._available('serena'),
            },
        };
    }
}

module.exports = { KnowledgeBase, DEFAULT_DIR, TYPES, slugify, hasCli };
