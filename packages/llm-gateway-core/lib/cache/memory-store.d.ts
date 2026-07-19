export = MemoryStore;
declare class MemoryStore {
    _max: number;
    _ttl: number;
    /** @type {Map<string, {value: *, expires: number}>} */
    _map: Map<string, {
        value: any;
        expires: number;
    }>;
    _hits: number;
    _misses: number;
    /**
     * @param {object} [opts]
     * @param {number} [opts.max=1000]
     * @param {number} [opts.ttlMs=300000]
     */
    constructor(opts?: {
        max?: number;
        ttlMs?: number;
    });
    get(key: any): any;
    set(key: any, value: any, ttlMs: any): void;
    has(key: any): boolean;
    delete(key: any): boolean;
    clear(): void;
    get stats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: string | number;
    };
}
