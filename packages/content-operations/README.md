# @andy-toolforge/content-operations

[![npm](https://img.shields.io/npm/v/@andy-toolforge/content-operations)](https://npmjs.com/package/@andy-toolforge/content-operations)
[![License](https://img.shields.io/npm/l/@andy-toolforge/content-operations)](https://github.com/andy-pham-it/toolforge)

Full content operations lifecycle: research, plan, create, distribute, analyze. Part of the [toolforge](https://github.com/andy-pham-it/toolforge) monorepo.

## Installation

```bash
npm install @andy-toolforge/content-operations
```

## API

```javascript
const {
    ContentResearcher,      // Discover trends, keywords, content gaps
    ContentPlanner,         // Plan content calendar and strategy
    ContentCreator,         // Create content across formats
    ContentDistributor,     // Distribute to platforms
    ContentAnalytics,       // Analyze content performance
    ContentPatternLinter,   // Lint content for patterns & consistency
} = require('@andy-toolforge/content-operations');
```

### ContentResearcher

```javascript
const { ContentResearcher } = require('@andy-toolforge/content-operations');
const researcher = new ContentResearcher(llm);
const trends = await researcher.trends({ niche: 'personal finance', platform: 'youtube' });
```

### ContentPatternLinter

```javascript
const { ContentPatternLinter } = require('@andy-toolforge/content-operations');
const linter = new ContentPatternLinter();
const issues = await linter.lint('path/to/content.md');
```

## MCP Tools

When used with [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):

| Tool | Description |
|------|-------------|
| `toolforge_content_research` | Content research (trends, keywords, gaps, ideas) |

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core)
- [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research)
