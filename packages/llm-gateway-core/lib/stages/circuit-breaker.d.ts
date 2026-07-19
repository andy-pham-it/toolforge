declare const _exports: {
    CircuitBreakerStage: typeof CircuitBreakerStage;
    CircuitBreakerState: typeof CircuitBreakerState;
};
export = _exports;
import Stage = require('../stage');
declare class CircuitBreakerState {
    threshold: number;
    cooldownMs: number;
    halfOpenMax: number;
    /** @type {Object<string, {failures: number, lastFailure: number, state: string, halfOpenSent: number}>} */
    _providers: Record<string, {
        failures: number;
        lastFailure: number;
        state: string;
        halfOpenSent: number;
    }>;
    /**
     * @param {object} [opts]
     * @param {number} [opts.threshold=5]
     * @param {number} [opts.cooldownMs=30000]
     * @param {number} [opts.halfOpenMaxRequests=1]
     */
    constructor(opts?: {
        threshold?: number;
        cooldownMs?: number;
        halfOpenMaxRequests?: number;
    });
    onSuccess(provider: any): void;
    onFailure(provider: any): void;
    isOpen(provider: any): boolean;
    getState(provider: any): string;
    getAllStates(): {};
}
declare class CircuitBreakerStage extends Stage {
    _state: CircuitBreakerState;
    /**
     * @param {CircuitBreakerState} state
     */
    constructor(state: CircuitBreakerState);
    execute(ctx: any, next: any): Promise<void>;
}
