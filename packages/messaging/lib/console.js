'use strict';

class ConsoleAdapter {
  constructor({ prefix = '[messaging]' } = {}) {
    this.prefix = prefix;
  }

  async send(payload = {}) {
    const { text } = payload;
    if (text == null) throw new Error('ConsoleAdapter: text is required');
    const line = `${this.prefix} ${String(text)}`;
    console.log(line);
    return { ok: true, line };
  }
}

module.exports = { ConsoleAdapter };
