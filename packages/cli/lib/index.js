'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse argv into { flags, positionals, values }.
 *
 * spec: { flags: { name: { type: 'boolean'|'string', short: 'x' } } }
 * Supports: --flag, --flag=value, --flag value (string flags),
 * -abc (boolean short cluster), -x value (string short).
 */
function parseArgs(argv, spec = {}) {
  const flags = {};
  const positionals = [];
  const values = {};
  const flagSpecs = spec.flags || {};
  const byShort = {};
  for (const [name, def] of Object.entries(flagSpecs)) {
    if (def.short) byShort[def.short] = name;
  }

  const setFlag = (name, value) => {
    const def = flagSpecs[name];
    if (def && def.type === 'string') values[name] = value;
    else flags[name] = true;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        setFlag(arg.slice(2, eq), arg.slice(eq + 1));
      } else {
        const name = arg.slice(2);
        const def = flagSpecs[name];
        if (def && def.type === 'string' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          values[name] = argv[++i];
        } else {
          setFlag(name, true);
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      const chars = arg.slice(1);
      for (let j = 0; j < chars.length; j++) {
        const short = chars[j];
        const name = byShort[short];
        if (!name) {
          flags[short] = true;
          continue;
        }
        const def = flagSpecs[name];
        if (def && def.type === 'string') {
          const rest = chars.slice(j + 1);
          if (rest) {
            values[name] = rest;
          } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
            values[name] = argv[++i];
          }
          break;
        }
        flags[name] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals, values };
}

/**
 * Terminal spinner. Stream is injectable for testing.
 */
class Spinner {
  constructor(options = {}) {
    this.frames = options.frames || ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = options.interval || 80;
    this.text = options.text || '';
    this.stream = options.stream || process.stderr;
    this._timer = null;
    this._frame = 0;
  }

  start(text = this.text) {
    if (this._timer) return this;
    this.text = text;
    this._frame = 0;
    this._timer = setInterval(() => {
      const frame = this.frames[this._frame % this.frames.length];
      this.stream.write(`\r${frame} ${this.text}`);
      this._frame++;
    }, this.interval);
    return this;
  }

  update(text) {
    this.text = text;
    return this;
  }

  stop(final = '') {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
      this.stream.write(`\r${final}\n`);
    }
    return this;
  }

  get running() {
    return this._timer !== null;
  }
}

/**
 * Load config from a list of candidate paths (first existing wins per key,
 * later files override earlier ones), merged over defaults, with optional
 * env override: envPrefix + '_' + KEY -> config[key.toLowerCase()].
 */
function loadConfig(paths, options = {}) {
  const { envPrefix = '', defaults = {} } = options;
  let config = { ...defaults };
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const ext = path.extname(p);
    let loaded;
    if (ext === '.js' || ext === '.cjs') {
      loaded = require(path.resolve(p));
    } else {
      loaded = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    config = { ...config, ...loaded };
  }
    if (envPrefix) {
    const prefix = envPrefix.endsWith('_') ? envPrefix : `${envPrefix}_`;
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        // Coerce env overrides: 'true'/'false' -> boolean, numeric -> number,
        // JSON -> object; keep raw string otherwise (e.g. 'PORT=80' -> 80).
        let coerced = value;
        try {
          coerced = JSON.parse(value);
        } catch {
          /* not JSON — keep string */
        }
        config[key.slice(prefix.length).toLowerCase()] = coerced;
      }
    }
  }
  return config;
}

module.exports = { parseArgs, Spinner, loadConfig };