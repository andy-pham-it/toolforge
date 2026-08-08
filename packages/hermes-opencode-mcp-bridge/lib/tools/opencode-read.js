'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

function expandHome(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function listRecursive(dir, depth, out, limit) {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= limit) return;
    const full = path.join(dir, e.name);
    let type = 'other';
    if (e.isFile()) type = 'file';
    else if (e.isDirectory()) type = 'dir';
    else if (e.isSymbolicLink()) type = 'symlink';
    out.push({ name: path.basename(full), type, path: full });
    if (type === 'dir' && depth > 1) listRecursive(full, depth - 1, out, limit);
  }
}

async function opencodeRead({ args }) {
  const target = typeof args.path === 'string' ? args.path.trim() : '';
  if (!target) return error('INVALID_ARGS', 'path is required');
  const expanded = expandHome(target);
  const resolved = path.isAbsolute(expanded) ? expanded : path.join(process.cwd(), expanded);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return error('NOT_FOUND', `path not found: ${resolved}`);
  }

  if (stat.isDirectory()) {
    const depth = Number.isInteger(args.depth) && args.depth > 0 ? args.depth : 2;
    const entries = [];
    listRecursive(resolved, depth, entries, 1000);
    return { status: 'success', data: { path: resolved, is_dir: true, depth, entries, entry_count: entries.length } };
  }

  if (stat.isFile()) {
    let content = fs.readFileSync(resolved, 'utf8').replace(/\n$/, '');
    const maxLines = Number.isInteger(args.max_lines) && args.max_lines > 0 ? args.max_lines : 500;
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      content = lines.slice(0, maxLines).join('\n') + `\n... [truncated at ${maxLines} lines]`;
    }
    return { status: 'success', data: { path: resolved, is_dir: false, content, size: stat.size } };
  }

  return error('INVALID_ARGS', `path is neither a file nor a directory: ${resolved}`);
}

module.exports = { opencodeRead };
