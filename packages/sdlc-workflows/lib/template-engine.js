'use strict';

/**
 * @andy-toolforge/sdlc-workflows Template Engine
 * Pure-function template renderer with variables, conditionals, loops, and includes.
 * No external dependencies.
 */

/**
 * Parse YAML frontmatter from markdown content.
 * @param {string} content
 * @returns {{ frontmatter: object|null, body: string }}
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { frontmatter: null, body: content };
  }

  const fmRaw = content.slice(3, endIdx);
  let body = content.slice(endIdx + 4);
  if (body.startsWith('\n')) body = body.slice(1);

  try {
    const frontmatter = require('js-yaml').load(fmRaw);
    return { frontmatter: frontmatter || {}, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}

/**
 * Extract variable names from a template string.
 * @param {string} template
 * @returns {string[]}
 */
function extractVariables(template) {
  const names = new Set();
  const re = /\{\{\s*([\w-]+)(?:\s*\|\s*default\s*\([^)]*\))?\s*\}\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Extract conditional variable names from {% if var %} tags.
 * @param {string} template
 * @returns {string[]}
 */
function extractConditionals(template) {
  const names = new Set();
  const re = /\{%\s*if\s+(\w[\w-]*)\s*%\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Resolve a value from context using dot-notation path (e.g., "user.name").
 * @param {object} context
 * @param {string} path
 * @returns {*}
 */
function resolveValue(context, path) {
  const parts = path.split('.');
  let val = context;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return undefined;
    val = val[part];
  }
  return val;
}

/**
 * Render a template string with context variables and optional partials.
 *
 * Syntax:
 *   {{ var }}                    — variable interpolation
 *   {{ var | default("val") }}   — variable with default
 *   {% if var %}...{% endif %}   — conditional
 *   {% if var %}...{% else %}...{% endif %}
 *   {% for item in list %}...{% endfor %}
 *   {% include "name" %}         — include registered partial
 *
 * @param {string} template
 * @param {object} context
 * @param {object} [partitals]
 * @returns {string}
 */
function renderTemplate(template, context, partials) {
  context = context || {};
  partials = partials || {};

  let result = template;

  // 1. Process {% include "name" %} — recurse with context
  result = result.replace(/\{%\s*include\s+"([^"]+)"\s*%\}/g, (_match, name) => {
    if (!partials[name]) return '';
    return renderTemplate(partials[name], context, partials);
  });

  // 2. Process {% for item in list %}...{% endfor %}
  const forRe = /\{%\s*for\s+(\w[\w-]*)\s+in\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/;
  while (forRe.test(result)) {
    result = result.replace(forRe, (_match, itemVar, listVar, body) => {
      const list = resolveValue(context, listVar);
      if (!Array.isArray(list) || list.length === 0) return '';

      return list.map((item, idx) => {
        const loopContext = { index: idx + 1 };
        const itemContext = Object.assign({}, context, { [itemVar]: item, loop: loopContext });
        return renderTemplate(body, itemContext, partials);
      }).join('');
    });
  }

  // 3. Process {% if var %}...{% elif var %}...{% else %}...{% endif %}
  //    (elif can be chained: if/elif/elif/else/endif)
  //    Uses a simple section-parsing approach (repeated capture groups in JS regex
  //    only preserve the last iteration, so we parse from the full match body).
  const ifBlockRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/;
  while (ifBlockRe.test(result)) {
    result = result.replace(ifBlockRe, (_match, ifVar, between) => {
      // between is everything between {% if var %} and {% endif %}
      const branches = [];
      let remaining = between;
      // Look for first {% elif %} or {% else %} in the block
      const firstSplit = remaining.match(/\{%\s*(elif|else)\s+(\w[\w-]*)?\s*%\}/);
      if (firstSplit) {
        branches.push({ var: ifVar, body: remaining.slice(0, firstSplit.index) });
        remaining = remaining.slice(firstSplit.index);
      } else {
        // No elif/else in between — simple if/endif
        if (resolveValue(context, ifVar)) return renderTemplate(between, context, partials);
        return '';
      }

      // Walk remaining tokens: {% elif %}, {% else %}, or {% endif %}
      const tokenRe = /\{%\s*(elif|else|endif)\s+(\w[\w-]*)?\s*%\}/;
      while (remaining.length > 0) {
        const tmatch = remaining.match(tokenRe);
        if (!tmatch) break;
        const keyword = tmatch[1];
        const afterToken = remaining.slice(tmatch.index + tmatch[0].length);
        if (keyword === 'elif') {
          const next = afterToken.match(tokenRe);
          const body = next ? afterToken.slice(0, next.index) : afterToken;
          branches.push({ var: tmatch[2], body });
          remaining = next ? afterToken.slice(next.index) : '';
        } else if (keyword === 'else') {
          const next = afterToken.match(tokenRe);
          const body = next ? afterToken.slice(0, next.index) : afterToken;
          branches.push({ var: null, body, isElse: true });
          remaining = next ? afterToken.slice(next.index) : '';
        } else if (keyword === 'endif') {
          break; // consumed by the outer regex — nothing left
        }
      }

      // Evaluate branches in order, return first truthy match
      for (const branch of branches) {
        if (branch.isElse) return renderTemplate(branch.body, context, partials);
        if (resolveValue(context, branch.var)) return renderTemplate(branch.body, context, partials);
      }
      return '';
    });
  }

  // 4. Process {% if var %}...{% endif %} (no else, no elif — for remaining
  //    simple if/endif blocks that weren't caught by the section parser above)
  const ifRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;

  // 5. Process {{ var | default("val") }}
  const defaultRe = /\{\{\s*([\w.-]+)\s*\|\s*default\s*\(\s*"([^"]*)"\s*\)\s*\}\}/g;
  result = result.replace(defaultRe, (_match, varName, defVal) => {
    const val = resolveValue(context, varName);
    return val !== undefined && val !== null ? String(val) : defVal;
  });

  // 6. Process {{ var }}
  const varRe = /\{\{\s*([\w.-]+)\s*\}\}/g;
  result = result.replace(varRe, (_match, varName) => {
    const val = resolveValue(context, varName);
    return val !== undefined && val !== null ? String(val) : '';
  });

  return result;
}

module.exports = { renderTemplate, parseFrontmatter, extractVariables, extractConditionals };
