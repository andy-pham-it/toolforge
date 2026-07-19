export = Stage;
declare class Stage {
    name: string;
    /**
     * @param {string} name — unique stage identifier
     */
    constructor(name: string);
    /**
     * Execute this stage in the pipeline.
     * Call next() to pass control downstream. Skip next() to short-circuit.
     * Pre/post processing around next() for setup/teardown.
     *
     * @param {import('./types').PipelineContext} ctx
     * @param {Function} next — async function to call next stage
     */
    execute(ctx: import('./types').PipelineContext, next: Function): Promise<void>;
}
