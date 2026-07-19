export = FallbackChain;
declare class FallbackChain {
    _chains: Record<string, string[]>;
    /**
     * @param {object} [config={}]
     * @param {Object<string, string[]>} [config.fallbacks] — model -> [fallback model names]
     */
    constructor(config?: {
        fallbacks?: Record<string, string[]>;
    });
    /**
     * Get fallback models for a given model name.
     * @param {string} model
     * @returns {string[]}
     */
    getFallbacks(model: string): string[];
    /**
     * Register a fallback chain for a model.
     * @param {string} model
     * @param {string[]} fallbacks
     */
    set(model: string, fallbacks: string[]): void;
}
