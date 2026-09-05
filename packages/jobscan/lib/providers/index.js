'use strict';

const greenhouse = require('./greenhouse');
const lever = require('./lever');
const ashby = require('./ashby');

const REGISTRY = {
  greenhouse,
  lever,
  ashby,
};

function getProvider(name) {
  if (!name) throw new Error('provider name is required');
  const key = String(name).toLowerCase();
  const mod = REGISTRY[key];
  if (!mod) throw new Error(`Unknown provider: ${name} (available: ${Object.keys(REGISTRY).join(', ')})`);
  return mod;
}

function listProviders() {
  return Object.keys(REGISTRY);
}

module.exports = { getProvider, listProviders, REGISTRY };
