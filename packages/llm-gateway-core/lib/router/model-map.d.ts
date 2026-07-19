export = ModelMap;
declare class ModelMap {
    /** @type {Object<string, {provider:string, adapter:string, timeoutMs:number}>} */
    _models: Record<string, {
        provider: string;
        adapter: string;
        timeoutMs: number;
    }>;
    /** @type {Object<string, string>} */
    _aliases: Record<string, string>;
    _tiebreaker: string;
    /**
     * @param {object} [config={}] — optional initial model mappings
     * @param {string} [config.tiebreaker='cost'] — 'cost' | 'latency'
     */
    constructor(config?: {
        tiebreaker?: string;
    });
    /**
     * Register a model mapping.
     * @param {string} model
     * @param {{provider:string, adapter:string, timeoutMs?:number} | Array} opts
     */
    add(model: string, opts: {
        provider: string;
        adapter: string;
        timeoutMs?: number;
    } | any[]): void;
    /**
     * Register an alias (e.g. gpt-4-turbo -> gpt-4o).
     */
    alias(name: any, canonical: any): void;
    /**
     * Resolve a model name to provider config.
     * @returns {{provider:string, adapter:string, timeoutMs:number}}
     */
    resolve(model: any): {
        provider: string;
        adapter: string;
        timeoutMs: number;
    };
    get availableModels(): string[];
    /**
     * Resolve collision when multiple providers serve the same model name.
     */
    _resolveCollision(model: any, options: any): any;
}
