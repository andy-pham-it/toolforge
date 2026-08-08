// Manual smoke test: boots the bridge and calls opencode_run against a real
// local project. Opt-in — requires the opencode CLI on PATH.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createServer } = require('../lib/index.js');

const projectDir = process.argv[2] || process.cwd();
const server = createServer();
const handler = server._registeredTools.opencode_run.handler;
const res = await handler.call(server, {
  task: 'Run `node -e "console.log(1+1)"` and report the result.',
  project_dir: projectDir,
});
console.log(JSON.stringify(res, null, 2));
