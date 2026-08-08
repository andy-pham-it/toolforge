'use strict';

const { createServer, startServer } = require('./server');

module.exports = { createServer, startServer };

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[hermes-opencode-bridge] fatal:', err);
    process.exit(1);
  });
}
