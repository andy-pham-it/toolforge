'use strict';

class MemoryStore {
  /**
   * @param {object} [opts]
   * @param {number} [opts.max=1000]
   * @param {number} [opts.ttlMs=300000]
   */
  constructor(opts = {}) {
    this._max = opts.max || 1000;
    this._ttl = opts.ttlMs || 300_000;
    /** @type {Map<string, {value: *, expires: number}>} */
    this._map = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() > entry.expires) {
      this._map.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    // LRU: delete + re-set to move to end
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this._map.size >= this._max) {
      // Evict oldest (first inserted)
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, { value, expires: Date.now() + (ttlMs || this._ttl) });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this._map.delete(key);
  }

  clear() {
    this._map.clear();
    this._hits = 0;
    this._misses = 0;
  }

  get stats() {
    return { size: this._map.size, hits: this._hits, misses: this._misses, hitRate: this._hits + this._misses > 0 ? (this._hits / (this._hits + this._misses)).toFixed(3) : 0 };
  }
}

module.exports = MemoryStore;
