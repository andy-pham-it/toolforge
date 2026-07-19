export = CostLoggerStage;
import Stage = require('../stage');
declare class CostLoggerStage extends Stage {
    _logPrompts: boolean;
    _pricing: {
        'gemini-3.1-flash-lite': {
            input: number;
            output: number;
        };
        'gemini-3.1-flash': {
            input: number;
            output: number;
        };
        'gpt-4o-mini': {
            input: number;
            output: number;
        };
        'gpt-4o': {
            input: number;
            output: number;
        };
        'llama-3.3-70b': {
            input: number;
            output: number;
        };
    };
    /**
     * @param {object} opts
     * @param {boolean} [opts.logPrompts=false]
     * @param {object} [opts.pricing] — override pricing table
     */
    constructor(opts?: {
        logPrompts?: boolean;
        pricing?: object;
    });
    execute(ctx: any, next: any): Promise<void>;
    _computeCost(model: any, inputTokens: any, outputTokens: any): number;
    _wrapStream(stream: any, ctx: any): AsyncGenerator<any, void, unknown>;
    _log(ctx: any): void;
}
