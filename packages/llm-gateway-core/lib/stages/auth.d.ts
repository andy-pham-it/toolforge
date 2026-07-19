export = AuthStage;
import Stage = require('../stage');
declare class AuthStage extends Stage {
    _keys: object;
    _defaultTenant: string;
    /**
     * @param {object} opts
     * @param {object} [opts.keys] — { [apiKey]: { tenant, roles, rotationKeys[] } }
     * @param {string} [opts.defaultTenant='default']
     */
    constructor(opts?: {
        keys?: object;
        defaultTenant?: string;
    });
    execute(ctx: any, next: any): Promise<void>;
}
