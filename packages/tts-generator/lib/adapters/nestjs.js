'use strict';

/**
 * NestJS adapter for TTSPlugin.
 *
 * The Express adapter (adapters/express.js) works directly with NestJS
 * since nest/platform-express wraps an Express instance. Users can mount
 * the Express router via:
 *
 * ```ts
 * import { NestFactory } from '@nestjs/core';
 * import { ExpressAdapter } from '@nestjs/platform-express';
 * import { toExpressRouter } from '@andy-toolforge/tts-generator/lib/adapters/express';
 * import TTSPlugin from '@andy-toolforge/tts-generator/lib/plugin';
 *
 * const plugin = new TTSPlugin({ apiKey: process.env.GEMINI_API_KEY });
 * const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
 * app.use('/tts', toExpressRouter(plugin));
 * ```
 *
 * For dependency injection, createModule() returns a DynamicModule that
 * registers TTSPlugin as a provider. Wire it like:
 *
 * ```ts
 * import { Module } from '@nestjs/common';
 * import { createNestModule } from '@andy-toolforge/tts-generator/lib/adapters/nestjs';
 * import TTSPlugin from '@andy-toolforge/tts-generator/lib/plugin';
 *
 * const plugin = new TTSPlugin({ apiKey: process.env.GEMINI_API_KEY });
 *
 * @Module({ ...createNestModule(plugin) })
 * class TTSModule {}
 * ```
 */

const TTSPlugin = require('../plugin');

const TTS_PLUGIN = 'TTS_PLUGIN';

/**
 * Create NestJS module configuration from a TTSPlugin instance.
 *
 * Returns `{ providers, exports }` to spread into a @Module decorator.
 * The plugin is registered under the 'TTS_PLUGIN' injection token.
 *
 * @param {TTSPlugin} plugin - Configured plugin instance
 * @returns {{ providers: Array, exports: Array }}
 */
function createNestModule(plugin) {
  if (!(plugin instanceof TTSPlugin)) {
    throw new Error('createNestModule: argument must be a TTSPlugin instance');
  }

  return {
    providers: [
      {
        provide: TTS_PLUGIN,
        useValue: plugin,
      },
    ],
    exports: [TTS_PLUGIN],
  };
}

module.exports = { createNestModule, TTS_PLUGIN };
