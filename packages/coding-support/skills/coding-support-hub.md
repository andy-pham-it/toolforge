---
name: coding-support-hub
description: Use when analyzing codebase complexity, finding dead code, mapping dependencies, or counting lines of code.
---

# Coding Support Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `codebase_line_counts` | Count lines of code by glob pattern |
| `codebase_dead_code` | Find potentially dead exports not required from entry points |
| `codebase_dependency_graph` | Generate dependency graph of JS files |
| `codebase_complexity` | Complexity report for specific files |

## Workflow
1. `codebase_line_counts` — measure project size
2. `codebase_dependency_graph` — understand architecture
3. `codebase_dead_code` — identify cleanup opportunities
4. `codebase_complexity` — analyze specific files for refactoring

## Related Skills
- `coding-refactoring-advisor` — refactoring guidance based on analysis
- `coding-code-reviewer` — code review patterns

## Integration
- Dead code & complexity analysis feed into refactoring decisions
- Dependency graph helps plan module extraction
- Line counts used for project reporting
