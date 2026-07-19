export = KeyRotatorStage;
import Stage = require('../stage');
declare class KeyRotatorStage extends Stage {
    /** @type {Object<string, string[]>} */
    _keyPools: Record<string, string[]>;
    /** @type {Object<string, number>} */
    _currentIndex: Record<string, number>;
    /**
     * @param {object} opts
     * @param {Object<string, string[]>} [opts.keyPools] — { [provider]: [key1, key2, ...] }
     */
    constructor(opts?: {
        keyPools?: Record<string, string[]>;
    });
    execute(ctx: any, next: any): Promise<void>;
}
