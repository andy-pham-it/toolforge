'use strict';

const childProcess = require('node:child_process');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

function runGit(projectDir, args) {
  return new Promise((resolve) => {
    childProcess.execFile('git', ['-C', projectDir, ...args], (err, stdout) => {
      resolve({ err, stdout: String(stdout) });
    });
  });
}

async function opencodeStatus({ config, args }) {
  const projectDir = (args && args.project_dir) || (config && config.default_project_dir) || process.cwd();
  const { err, stdout } = await runGit(projectDir, ['status', '--porcelain=v1', '-b']);
  if (err) return error('TASK_ERROR', `git status failed for ${projectDir}: ${err.message}`);

  const lines = stdout.split('\n').filter((l) => l.trim() !== '');
  const changed = [];
  let branch = null;
  for (const line of lines) {
    if (line.startsWith('##')) {
      branch = line.replace(/^##\s*/, '').split('...')[0].trim();
      continue;
    }
    const status = line.slice(0, 2);
    const filePath = line.slice(3).trim();
    let code;
    if (status.includes('?')) code = '?';
    else if (status.includes('M')) code = 'M';
    else if (status.includes('A')) code = 'A';
    else if (status.includes('D')) code = 'D';
    else if (status.includes('R')) code = 'R';
    else if (status.includes('C')) code = 'C';
    else code = status.trim() || 'M';
    changed.push({ path: filePath, status: code });
  }

  const untracked = changed.filter((f) => f.status === '?').length;
  const tracked = changed.length - untracked;
  let overall;
  if (changed.length === 0) overall = 'clean';
  else if (untracked > 0) overall = 'untracked';
  else overall = 'dirty';

  return {
    status: 'success',
    data: {
      project_dir: projectDir,
      status: overall,
      changed_files: changed,
      tracked_changes: tracked,
      untracked_files: untracked,
      branch,
    },
  };
}

module.exports = { opencodeStatus };
