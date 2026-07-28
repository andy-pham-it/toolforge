'use strict';

const path = require('path');
const { checkManifest } = require('../lib/version-registry');
const pkg = require('../package.json');

const definition = {
    name: 'sdlc_check_version',
    description: 'Check installed SDLC workflows version against package version. Detects drift (outdated manifest) and returns manifest details.',
    inputSchema: {
        type: 'object',
        properties: {
            manifestDir: {
                type: 'string',
                description: 'Path to .opencode/manifests/ directory (default: cwd/.opencode/manifests)',
            },
        },
    },
};

async function handler(_llm, args) {
    const cwd = process.cwd();
    const manifestDir = args.manifestDir || path.join(cwd, '.opencode', 'manifests');
    return checkManifest(manifestDir, pkg.version);
}

module.exports = { definition, handler };
