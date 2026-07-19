declare const _exports: {
    createPipeline: typeof createPipeline;
    Pipeline: typeof Pipeline;
    Stage: typeof Stage;
    AuthStage: typeof AuthStage;
    RateLimitStage: {
        new (opts?: {
            buckets?: object;
            defaultCapacity?: number;
            defaultRefillRate?: number;
        }): {
            _buckets: Record<string, {
                capacity: any;
                tokens: any;
                refillRate: any;
                lastRefill: number;
                tryConsume(count?: number): boolean;
                get remaining(): number;
                get resetTimeMs(): number;
                _refill(): void;
            }>;
            _defaultCapacity: number;
            _defaultRefillRate: number;
            execute(ctx: any, next: any): Promise<void>;
            name: string;
        };
    };
    TokenBucket: {
        new (capacity: any, refillRate: any): {
            capacity: any;
            tokens: any;
            refillRate: any;
            lastRefill: number;
            tryConsume(count?: number): boolean;
            get remaining(): number;
            get resetTimeMs(): number;
            _refill(): void;
        };
    };
    CacheStage: typeof CacheStage;
    RouterStage: typeof RouterStage;
    KeyRotatorStage: typeof KeyRotatorStage;
    ProviderStage: typeof ProviderStage;
    CircuitBreakerStage: {
        new (state: {
            threshold: number;
            cooldownMs: number;
            halfOpenMax: number;
            _providers: Record<string, {
                failures: number;
                lastFailure: number;
                state: string;
                halfOpenSent: number;
            }>;
            onSuccess(provider: any): void;
            onFailure(provider: any): void;
            isOpen(provider: any): boolean;
            getState(provider: any): string;
            getAllStates(): {};
        }): {
            _state: {
                threshold: number;
                cooldownMs: number;
                halfOpenMax: number;
                _providers: Record<string, {
                    failures: number;
                    lastFailure: number;
                    state: string;
                    halfOpenSent: number;
                }>;
                onSuccess(provider: any): void;
                onFailure(provider: any): void;
                isOpen(provider: any): boolean;
                getState(provider: any): string;
                getAllStates(): {};
            };
            execute(ctx: any, next: any): Promise<void>;
            name: string;
        };
    };
    CircuitBreakerState: {
        new (opts?: {
            threshold?: number;
            cooldownMs?: number;
            halfOpenMaxRequests?: number;
        }): {
            threshold: number;
            cooldownMs: number;
            halfOpenMax: number;
            _providers: Record<string, {
                failures: number;
                lastFailure: number;
                state: string;
                halfOpenSent: number;
            }>;
            onSuccess(provider: any): void;
            onFailure(provider: any): void;
            isOpen(provider: any): boolean;
            getState(provider: any): string;
            getAllStates(): {};
        };
    };
    CostLoggerStage: typeof CostLoggerStage;
    MemoryStore: typeof MemoryStore;
    ModelMap: typeof ModelMap;
    FallbackChain: typeof FallbackChain;
};
export = _exports;
import createPipeline = require('./create-pipeline');
import Pipeline = require('./pipeline');
import Stage = require('./stage');
import AuthStage = require('./stages/auth');
import CacheStage = require('./stages/cache');
import RouterStage = require('./stages/router');
import KeyRotatorStage = require('./stages/key-rotator');
import ProviderStage = require('./stages/provider');
import CostLoggerStage = require('./stages/cost-logger');
import MemoryStore = require('./cache/memory-store');
import ModelMap = require('./router/model-map');
import FallbackChain = require('./router/fallback-chain');
