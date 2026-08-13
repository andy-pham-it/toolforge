'use strict';

class Messenger {
  constructor(adapters = {}) {
    this._adapters = new Map();
    for (const [name, adapter] of Object.entries(adapters)) {
      this._adapters.set(name, adapter);
    }
  }

  register(name, adapter) {
    this._adapters.set(name, adapter);
    return this;
  }

  get(name) {
    return this._adapters.get(name);
  }

  async send(name, payload) {
    const adapter = this._adapters.get(name);
    if (!adapter) throw new Error(`Messenger: unknown adapter ${name}`);
    return adapter.send(payload);
  }

  async sendAll(payload) {
    const results = [];
    for (const [name, adapter] of this._adapters) {
      try {
        results.push({ name, ok: true, result: await adapter.send(payload) });
      } catch (err) {
        results.push({ name, ok: false, error: err.message });
      }
    }
    return results;
  }
}

module.exports = { Messenger };
