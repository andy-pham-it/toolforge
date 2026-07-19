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
 * @property {Array<{role:string, content:string}>} messages
 * @property {boolean} [stream=false]
 * @property {boolean} [dryRun=false]
 * @property {string} [tenant='default']
 * @property {string} [apiKey]
 * @property {number} [temperature]
 * @property {AbortSignal} [signal]
 * @property {string} requestId
 * @property {Object<string,string>} [responseHeaders]
 * @property {number} _startTime
 * @property {string} [provider]
 * @property {object} [_route]
 * @property {Function} [_adapterFactory]
 * @property {string} [_fallbackReason]
 * @property {number} [_fallbackIndex]
 * @property {Error} [error]
 * @property {object} [response]
 * @property {AsyncIterable} [responseStream]
 * @property {boolean} [cached=false]
 * @property {{promptTokens:number, completionTokens:number, costUsd:number, pending?:boolean}} [cost]
 * @property {string[]} [roles]
 * @property {number} [_keyIndex]
 * @property {number} [_durationMs]
 * @property {object} [finalUsage]
 */
declare const _exports: {};
export = _exports;
export type ChatRequest = {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    stream?: boolean;
    temperature?: number;
    tenant?: string;
    dryRun?: boolean;
    apiKey?: string;
    signal?: AbortSignal;
};
export type ChatResponse = {
    content: string;
    toolCalls?: any[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
        costUsd: number;
    };
    cached?: boolean;
    responseHeaders?: Record<string, string>;
};
export type PipelineContext = {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    stream?: boolean;
    dryRun?: boolean;
    tenant?: string;
    apiKey?: string;
    temperature?: number;
    signal?: AbortSignal;
    requestId: string;
    responseHeaders?: Record<string, string>;
    _startTime: number;
    provider?: string;
    _route?: object;
    _adapterFactory?: Function;
    _fallbackReason?: string;
    _fallbackIndex?: number;
    error?: Error;
    response?: object;
    responseStream?: AsyncIterable<any>;
    cached?: boolean;
    cost?: {
        promptTokens: number;
        completionTokens: number;
        costUsd: number;
        pending?: boolean;
    };
    roles?: string[];
    _keyIndex?: number;
    _durationMs?: number;
    finalUsage?: object;
};
