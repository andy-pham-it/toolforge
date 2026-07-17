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

/**
 * @typedef {Object} PipelineContext
 * @property {string} model
 * @property {Array} messages
 * @property {boolean} stream
 * @property {string} tenant
 * @property {string} requestId
 * @property {number} [temperature]
 * @property {boolean} [dryRun]
 * @property {AbortSignal} [signal]
 * @property {string} [apiKey]
 * @property {string} [provider]
 * @property {object} [adapter]
 * @property {{ promptTokens: number, completionTokens: number, costUsd: number }} [cost]
 * @property {boolean} [cached]
 * @property {ChatResponse} [response]
 * @property {AsyncIterable} [responseStream]
 * @property {Error} [error]
 * @property {boolean} [cancelled]
 * @property {Object<string,string>} [responseHeaders]
 * @property {number} _startTime
 * @property {number} _durationMs
 * @property {object} [_route]
 * @property {Function} [_adapterFactory]
 * @property {number} [_keyIndex]
 * @property {number} [_fallbackIndex]
 * @property {string} [_fallbackReason]
 * @property {object} [finalUsage]
 */

module.exports = {};
