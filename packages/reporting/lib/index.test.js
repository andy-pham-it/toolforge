'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { toMarkdown, toHTML, toPDF } = require('./index.js');

test('toMarkdown: title, sections, table', () => {
  const md = toMarkdown(
    {
      sections: [{ heading: 'Overview', body: 'Some text' }],
      table: { headers: ['Symbol', 'Score'], rows: [['FPT', 85], ['VNM', 72]] },
    },
    { title: 'Report' }
  );
  assert.ok(md.startsWith('# Report'));
  assert.ok(md.includes('## Overview'));
  assert.ok(md.includes('| Symbol | Score |'));
  assert.ok(md.includes('| FPT | 85 |'));
});

test('toMarkdown: escapes pipes in cells', () => {
  const md = toMarkdown({ table: { headers: ['A'], rows: [['x|y']] } });
  assert.ok(md.includes('x\\|y'));
});

test('toHTML: headings, paragraphs, lists, code', () => {
  const html = toHTML('# Title\n\nSome **bold** text.\n\n- one\n- two\n\n```js\nconst x = 1;\n```');
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('<p>Some <strong>bold</strong> text.</p>'));
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>one</li>'));
  assert.ok(html.includes('<pre><code>const x = 1;</code></pre>'));
});

test('toHTML: table conversion', () => {
  const html = toHTML('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<th>A</th>'));
  assert.ok(html.includes('<td>1</td>'));
});

test('toHTML: escapes HTML in content', () => {
  const html = toHTML('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('toPDF: returns a PDF buffer', async () => {
  const buf = await toPDF('## Title\n\nHello world', { title: 'Doc' });
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 100);
  assert.strictEqual(buf.slice(0, 4).toString(), '%PDF');
});