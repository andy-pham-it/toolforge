export = RouterStage;
import Stage = require('../stage');
declare class RouterStage extends Stage {
    _modelMap: any;
    _fallbackChain: any;
    _createAdapter: any;
    _circuitBreaker: any;
    constructor(opts?: {});
    setCircuitBreaker(cb: any): void;
    execute(ctx: any, next: any): Promise<void>;
}
