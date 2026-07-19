'use strict';

/**
 * @typedef {Object} ChatRequest
 * @property {string} model
 * @property {Array<{role: string, content: string}>} messages
 * @property {boolean} [stream=false]
 * @property {number} [temperature]
 * @property {string} [tenant='default']
 * @property {boolean} [dryRun=false]
 * @property {string} [apiKey]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} content
 * @property {Array} [toolCalls]
 * @property {{ promptTokens: number, completionTokens: number, costUsd: number }} [usage]
 * @property {boolean} [cached=false]
 * @property {Object<string,string>} [responseHeaders]
 */

module.exports = {};
