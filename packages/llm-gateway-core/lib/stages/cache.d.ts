export = CacheStage;
import Stage = require('../stage');
declare class CacheStage extends Stage {
    _store: object;
    /** @param {object} store */
    constructor(store: object);
    /**
     * Generate cache key from context using Web Crypto API.
     * Includes tenant ID for tenant isolation. Browser-safe.
     */
    _cacheKey(ctx: any): Promise<string>;
    execute(ctx: any, next: any): Promise<void>;
}
