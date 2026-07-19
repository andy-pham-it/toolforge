'use strict';

class Stage {
  /**
   * @param {string} name — unique stage identifier
   */
  constructor(name) {
    if (!name) throw new Error('Stage requires a name');
    this.name = name;
  }

  /**
   * Execute this stage in the pipeline.
   * Call next() to pass control downstream. Skip next() to short-circuit.
   * Pre/post processing around next() for setup/teardown.
   *
   * @param {import('./types').PipelineContext} ctx
   * @param {Function} next — async function to call next stage
   */
  async execute(ctx, next) {
    // Default: pass through
    await next();
  }
}

module.exports = Stage;
