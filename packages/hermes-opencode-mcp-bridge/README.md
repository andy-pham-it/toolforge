# @andy-toolforge/hermes-opencode-mcp-bridge

MCP bridge from Hermes Agent to the [opencode](https://opencode.ai) CLI.

Lets Hermes run coding tasks in a local opencode session, read files, check git
status, and manage the allowed-model list — through standard MCP tools.

## Requirements

- Node.js >= 18 (CommonJS)
- The `opencode` CLI installed (default `~/.opencode/bin/opencode`)

## Install

```bash
npm install @andy-toolforge/hermes-opencode-mcp-bridge
```

Run the stdio server (this is what your MCP client spawns):

```bash
npx hermes-opencode-bridge
```

## Configuration

Config file: `~/.config/hermes-opencode/config.json` (override with env var
`HERMES_OPENCODE_CONFIG`). All keys optional:

```json
{
  "opencode_bin": "~/.opencode/bin/opencode",
  "default_project_dir": "~/projects",
  "default_agent": "fixer",
  "default_model": "opencode/deepseek-v4-flash-free",
  "models": [],
  "session_timeout": 300,
  "auto_commit": false,
  "verbose": false
}
```

- `models`: if non-empty, `opencode_run` only allows models in this list.
- `session_timeout`: seconds of idle before a conversation is forgotten.
- `auto_commit`: run `git add -A && git commit` after each successful run.

## Tools

| Tool | Purpose |
|------|---------|
| `opencode_run` | Run a task in opencode; pass `conversation_id` to continue a session |
| `opencode_task` | Like `opencode_run` but always auto-commits |
| `opencode_read` | Read a file or list a directory tree |
| `opencode_status` | Git status of a project directory |
| `opencode_set_models` | Set/add/remove/list allowed models |

## Example

1. Hermes asks opencode to fix a bug:

   `opencode_run({task: "fix the login bug in src/auth.js", project_dir: "~/projects/app"})`

2. Hermes checks the result and reads the changed file:

   `opencode_read({path: "~/projects/app/src/auth.js"})`

3. Hermes continues the same session:

   `opencode_run({task: "also add tests for the fix", conversation_id: "hob-abc123"})`

## Sessions

Each `opencode_run` returns a `conversation_id`. Passing it back continues that
opencode session via `--session <id> --fork`. Idle sessions are swept after
`session_timeout` seconds.

## Skill file

The package ships `skills/hermes-opencode-bridge.md` — an agent-facing guide for
using the 5 tools (`opencode_run`, `opencode_task`, `opencode_read`,
`opencode_status`, `opencode_set_models`), covering `conversation_id`
continuation, `opencode_task` vs `opencode_run`, error codes, and config
reference. The `postinstall` script installs it into the client project's
`.opencode/skills/` (prefixed `hermes-opencode-bridge-`).

## License

MIT
