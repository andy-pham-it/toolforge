export = ProviderStage;
import Stage = require('../stage');
declare class ProviderStage extends Stage {
    constructor();
    execute(ctx: any, next: any): Promise<void>;
    /**
     * Fallback: convert sync adapter to streaming-compatible async iterable.
     */
    _adaptSyncToStream(adapter: any, opts: any, signal: any): AsyncGenerator<{
        content: any;
        finish_reason: string;
    }, void, unknown>;
}
