'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');

const { renderTemplate, parseFrontmatter, extractVariables } = require('./template-engine');

describe('parseFrontmatter', () => {
  it('should extract YAML frontmatter from content', () => {
    const content = '---\ntitle: Test\n---\nBody content';
    const result = parseFrontmatter(content);
    assert.deepStrictEqual(result.frontmatter, { title: 'Test' });
    assert.strictEqual(result.body, 'Body content');
  });

  it('should return null frontmatter when no --- found', () => {
    const content = 'Just body content';
    const result = parseFrontmatter(content);
    assert.strictEqual(result.frontmatter, null);
    assert.strictEqual(result.body, 'Just body content');
  });

  it('should handle content without closing ---', () => {
    const content = '---\ntitle: Broken\nBody content';
    const result = parseFrontmatter(content);
    assert.strictEqual(result.frontmatter, null);
    assert.strictEqual(result.body, content);
  });
});

describe('renderTemplate', () => {
  it('should interpolate {{ var }} with context values', () => {
    const tpl = 'Hello {{ name }}!';
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }), 'Hello World!');
  });

  it('should support {{ var | default("val") }} syntax', () => {
    const tpl = 'Hello {{ name | default("Guest") }}!';
    assert.strictEqual(renderTemplate(tpl, {}), 'Hello Guest!');
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }), 'Hello World!');
  });

  it('should handle {% if %} conditional sections', () => {
    const tpl = 'Start{% if show %}Visible{% endif %}End';
    assert.strictEqual(renderTemplate(tpl, { show: true }), 'StartVisibleEnd');
    assert.strictEqual(renderTemplate(tpl, { show: false }), 'StartEnd');
    assert.strictEqual(renderTemplate(tpl, {}), 'StartEnd');
  });

  it('should handle {% if %}...{% else %}...{% endif %}', () => {
    const tpl = '{% if dark %}Dark mode{% else %}Light mode{% endif %}';
    assert.strictEqual(renderTemplate(tpl, { dark: true }), 'Dark mode');
    assert.strictEqual(renderTemplate(tpl, { dark: false }), 'Light mode');
  });

  it('should handle {% for item in list %} loops', () => {
    const tpl = '{% for item in items %}- {{ item }}\n{% endfor %}';
    const result = renderTemplate(tpl, { items: ['A', 'B', 'C'] });
    assert.strictEqual(result, '- A\n- B\n- C\n');
  });

  it('should handle empty list in {% for %}', () => {
    const tpl = '{% for item in items %}- {{ item }}\n{% endfor %}';
    assert.strictEqual(renderTemplate(tpl, { items: [] }), '');
  });

  it('should support {% include "name" %} with registered partials', () => {
    const tpl = 'Header: {% include "footer" %}';
    const partials = { footer: 'Copyright 2026' };
    assert.strictEqual(renderTemplate(tpl, {}, partials), 'Header: Copyright 2026');
  });

  it('should interpolate {{ var }} inside included partials', () => {
    const tpl = '{% include "greeting" %}';
    const partials = { greeting: 'Hello {{ name }}!' };
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }, partials), 'Hello World!');
  });

  it('should return template unchanged when no variables match', () => {
    const tpl = 'Static content without variables';
    assert.strictEqual(renderTemplate(tpl, {}), 'Static content without variables');
  });
});

describe('extractVariables', () => {
  it('should return all {{ var }} names', () => {
    const tpl = 'Hello {{ name }}, you are {{ age }} years old';
    const vars = extractVariables(tpl);
    assert.ok(vars.includes('name'));
    assert.ok(vars.includes('age'));
  });

  it('should not include | default() content as variables', () => {
    const tpl = '{{ name | default("Guest") }}';
    const vars = extractVariables(tpl);
    assert.deepStrictEqual(vars, ['name']);
  });
});
