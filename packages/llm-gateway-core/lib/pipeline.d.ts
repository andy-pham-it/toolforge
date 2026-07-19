export = Pipeline;
declare class Pipeline {
    /** @type {Array<import('./stage')>} */
    _stages: Array<import('./stage')>;
    /** @type {Set<string>} request IDs currently executing */
    _inflight: Set<string>;
    constructor(stages?: any[]);
    use(stage: any): this;
    /**
     * Execute the pipeline for a given context.
     * Handles sync, streaming, and dryRun modes.
     *
     * @param {import('./types').PipelineContext} ctx
     * @returns {Promise<import('./types').ChatResponse|AsyncIterable>}
     */
    execute(ctx: import('./types').PipelineContext): Promise<import('./types').ChatResponse | AsyncIterable<any>>;
    /** Number of requests currently executing */
    get inflightCount(): number;
    /** Wait until in-flight count reaches 0, with timeout */
    drain(timeoutMs?: number): Promise<void>;
}
