'use strict';

const PDFDocument = require('pdfkit');

/**
 * Build a markdown report from structured data.
 *
 * report: { title?, sections: [{ heading?, body? }], table?: { headers, rows } }
 * Returns a markdown string.
 */
function toMarkdown(report, options = {}) {
  const { title } = options;
  const lines = [];
  if (title) lines.push(`# ${title}`, '');
  if (report.sections) {
    for (const section of report.sections) {
      if (section.heading) lines.push(`## ${section.heading}`, '');
      if (section.body) lines.push(section.body, '');
    }
  }
  if (report.table) {
    const { headers, rows } = report.table;
    if (headers && headers.length) {
      lines.push(`| ${headers.join(' | ')} |`);
      lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
      for (const row of rows) {
        lines.push(`| ${row.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`);
      }
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(md) {
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/**
 * Convert markdown to HTML. Supports: headings, paragraphs, unordered lists,
 * tables, fenced code blocks, inline bold/italic/code.
 */
function toHTML(markdown) {
  const lines = String(markdown).split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let inList = false;
  let inTable = false;
  let tableBuf = [];

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push('</table>');
      inTable = false;
      tableBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        closeTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      closeTable();
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (line.startsWith('|')) {
      if (!inTable) {
        closeList();
        inTable = true;
        tableBuf = [];
      }
      tableBuf.push(line);
      continue;
    }
    if (inTable) {
      // flush table: first row = header, second = separator, rest = rows
      const rows = tableBuf
        .filter((r, i) => i !== 1)
        .map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      if (rows.length) {
        const [header, ...body] = rows;
        out.push('<table>');
        out.push(`<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`);
        out.push(`<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
        out.push('</table>');
      }
      closeTable();
    }
    const listItem = line.match(/^\s*[-*]\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === '') continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  closeList();
  if (inTable) {
    const rows = tableBuf
      .filter((r, i) => i !== 1)
      .map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    if (rows.length) {
      const [header, ...body] = rows;
      out.push('<table>');
      out.push(`<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`);
      out.push(`<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
      out.push('</table>');
    }
  }
  return out.join('\n');
}

/**
 * Render markdown to a PDF buffer (via pdfkit).
 */
function toPDF(markdown, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    if (options.stream) {
      // Stream mode: pipe directly to a writable (e.g. fs.WriteStream) so
      // large reports don't need to be buffered in RAM; resolves on 'finish'.
      const stream = options.stream;
      doc.pipe(stream);
      doc.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', resolve);
    } else {
      // Buffer mode (default): collect chunks and resolve with a Buffer.
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    }

    if (options.title) {
      doc.fontSize(20).text(options.title);
      doc.moveDown();
    }
    for (const line of String(markdown).split('\n')) {
      if (/^#\s/.test(line)) {
        doc.fontSize(18).text(line.replace(/^#\s/, ''));
      } else if (/^##\s/.test(line)) {
        doc.fontSize(14).text(line.replace(/^##\s/, ''));
      } else if (line.trim()) {
        doc.fontSize(11).text(line);
      }
    }
    doc.end();
  });
}

module.exports = { toMarkdown, toHTML, toPDF };