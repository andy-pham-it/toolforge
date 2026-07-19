declare const _exports: {
    RateLimitStage: typeof RateLimitStage;
    TokenBucket: typeof TokenBucket;
};
export = _exports;
import Stage = require('../stage');
declare class TokenBucket {
    capacity: any;
    tokens: any;
    refillRate: any;
    lastRefill: number;
    constructor(capacity: any, refillRate: any);
    tryConsume(count?: number): boolean;
    get remaining(): number;
    get resetTimeMs(): number;
    _refill(): void;
}
declare class RateLimitStage extends Stage {
    /** @type {Object<string, TokenBucket>} */
    _buckets: Record<string, TokenBucket>;
    _defaultCapacity: number;
    _defaultRefillRate: number;
    /**
     * @param {object} opts
     * @param {object} [opts.buckets] — { [tenant]: { capacity, refillRate } }
     * @param {number} [opts.defaultCapacity=60]
     * @param {number} [opts.defaultRefillRate=1]
     */
    constructor(opts?: {
        buckets?: object;
        defaultCapacity?: number;
        defaultRefillRate?: number;
    });
    execute(ctx: any, next: any): Promise<void>;
}
