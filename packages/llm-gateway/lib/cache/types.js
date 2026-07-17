'use strict';

/**
 * @typedef {Object} CacheStore
 * @property {function(string): Promise<*|null>} get
 * @property {function(string, *, number): Promise<void>} set — (key, value, ttlMs)
 * @property {function(string): Promise<boolean>} has
 * @property {function(string): Promise<void>} delete
 */

module.exports = {};
