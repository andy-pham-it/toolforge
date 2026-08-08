'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = {
  opencode_bin: '~/.opencode/bin/opencode',
  default_project_dir: '~/projects',
  default_agent: 'fixer',
  default_model: 'opencode/deepseek-v4-flash-free',
  models: [],
  session_timeout: 300,
  session_file: '~/.config/hermes-opencode/sessions.json',
  auto_commit: false,
  verbose: false,
};

function expandHome(p) {
  if (typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function configPath() {
  return process.env.HERMES_OPENCODE_CONFIG ||
    path.join(os.homedir(), '.config', 'hermes-opencode', 'config.json');
}

function configError(message) {
  const err = new Error(message);
  err.code = 'CONFIG_ERROR';
  return err;
}

function loadConfig(file) {
  const target = file || configPath();
  const cfg = { ...DEFAULTS };
  let raw = null;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw configError(`Cannot read config ${target}: ${err.message}`);
    raw = null; // missing config → defaults
  }
  if (raw !== null) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw configError(`Config file ${target} is not valid JSON: ${err.message}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw configError(`Config file ${target} must contain a JSON object`);
    }
    Object.assign(cfg, parsed);
  }
  cfg.opencode_bin = expandHome(cfg.opencode_bin);
  cfg.default_project_dir = expandHome(cfg.default_project_dir);
  cfg.session_file = expandHome(cfg.session_file);
  if (!Array.isArray(cfg.models)) cfg.models = [];
  return cfg;
}

function writeConfig(cfg, target) {
  const file = target || configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const serializable = {
    opencode_bin: cfg.opencode_bin,
    default_project_dir: cfg.default_project_dir,
    default_agent: cfg.default_agent,
    default_model: cfg.default_model,
    models: cfg.models,
    session_timeout: cfg.session_timeout,
    session_file: cfg.session_file,
    auto_commit: cfg.auto_commit,
    verbose: cfg.verbose,
  };
  fs.writeFileSync(file, JSON.stringify(serializable, null, 2) + '\n');
  return file;
}

module.exports = { DEFAULTS, configPath, expandHome, loadConfig, writeConfig, configError };
