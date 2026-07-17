#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { createGateway } = require('../lib/gateway');
const HTTPServer = require('../lib/http/server');
const pkg = require('../package.json');

const args = process.argv.slice(2);
const cmd = args[0];

function showHelp() {
  console.log(`
@andy-toolforge/llm-gateway v${pkg.version}

Usage:
  npx llm-gateway start --config gateway.json   Start HTTP server
  npx llm-gateway --help                          Show this help
`);
  process.exit(0);
}

async function startServer(configPath) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf-8'));
  } catch (err) {
    console.error(`Failed to load config: ${err.message}`);
    process.exit(1);
  }

  const gateway = createGateway({
    apiKey: config.apiKey || process.env.LLM_GATEWAY_KEY,
    keys: config.keys,
    models: config.models,
    createAdapter: config.createAdapter,
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[llm-gateway] Shutting down...');
    await httpServer.stop(30000);
    console.log('[llm-gateway] Stopped');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const httpServer = new HTTPServer(gateway, {
    port: config.port || 3000,
    timeoutMs: config.timeoutMs || 30000,
  });

  await httpServer.start();
}

if (cmd === 'start' && args[1] === '--config') {
  startServer(args[2]);
} else {
  showHelp();
}
