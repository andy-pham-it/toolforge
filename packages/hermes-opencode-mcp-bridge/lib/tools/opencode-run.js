'use strict';

const childProcess = require('node:child_process');
const { parseOpenCodeOutput } = require('../parser');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

async function opencodeRun({ config, sessions, args, timeoutMs }) {
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  if (!task) return error('INVALID_ARGS', 'task is required');
  if (args.model && Array.isArray(config.models) && config.models.length > 0 && !config.models.includes(args.model)) {
    return error('INVALID_ARGS', `model ${args.model} is not in config.models`);
  }
  const projectDir = args.project_dir || config.default_project_dir || '~/projects';
  const model = args.model || config.default_model;
  const agent = args.agent || config.default_agent;

  let opencodeSessionId = null;
  let existingSession = null;
  if (args.conversation_id) {
    existingSession = sessions.get(args.conversation_id);
    if (!existingSession) return error('MISSING_CONVERSATION', `conversation ${args.conversation_id} not found`);
    opencodeSessionId = existingSession.opencodeSessionId;
  }

  const spawnArgs = ['run', '--format', 'json', '--dir', projectDir, '--agent', agent, '--model', model, task];
  if (opencodeSessionId) spawnArgs.push('--session', opencodeSessionId, '--fork');

  const limitMs = timeoutMs || args.timeoutMs || (config.session_timeout || 300) * 1000;

  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(config.opencode_bin, spawnArgs, { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve(error('TASK_ERROR', `failed to spawn opencode: ${err.message}`));
    }
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      resolve(error('TIMEOUT', `opencode run exceeded ${limitMs}ms timeout`));
    }, limitMs);
    timer.unref();

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(error('TASK_ERROR', `opencode spawn error: ${err.message}`));
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const parsed = parseOpenCodeOutput(stdout);
        let conversation_id = args.conversation_id;
        if (existingSession) {
          existingSession.projectDir = projectDir;
          sessions.touch(conversation_id);
        } else {
          conversation_id = sessions.create(parsed.session_id, projectDir);
        }
        sessions.markDone(conversation_id);
        if (config.auto_commit) {
          childProcess.execFile('git', ['-C', projectDir, 'add', '-A'], () => {
            childProcess.execFile('git', ['-C', projectDir, 'commit', '-m', 'feat: auto-commit after opencode run'], () => {});
          });
        }
        resolve({
          status: 'success',
          data: {
            conversation_id,
            session_id: parsed.session_id,
            task,
            project_dir: projectDir,
            files_changed: parsed.files_changed,
            diff: parsed.diff,
            summary: parsed.summary,
            completed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        resolve(error('PARSE_ERROR', `failed to parse opencode output: ${err.message}${stderr ? `\nstderr: ${stderr}` : ''}`));
      }
    });
  });
}

module.exports = { opencodeRun };
