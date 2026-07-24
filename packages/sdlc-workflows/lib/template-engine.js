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
  const forRe = /\{%\s*for\s+(\w[\w-]*)\s+in\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;
  result = result.replace(forRe, (_match, itemVar, listVar, body) => {
    const list = resolveValue(context, listVar);
    if (!Array.isArray(list) || list.length === 0) return '';

    return list.map(item => {
      const itemContext = Object.assign({}, context, { [itemVar]: item });
      return renderTemplate(body, itemContext, partials);
    }).join('');
  });

  // 3. Process {% if var %}...{% else %}...{% endif %}
  const ifElseRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  result = result.replace(ifElseRe, (_match, varName, ifBody, elseBody) => {
    const val = resolveValue(context, varName);
    if (val) {
      return renderTemplate(ifBody, context, partials);
    }
    return renderTemplate(elseBody, context, partials);
  });

  // 4. Process {% if var %}...{% endif %} (no else)
  const ifRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  result = result.replace(ifRe, (_match, varName, body) => {
    const val = resolveValue(context, varName);
    if (val) {
      return renderTemplate(body, context, partials);
    }
    return '';
  });

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
