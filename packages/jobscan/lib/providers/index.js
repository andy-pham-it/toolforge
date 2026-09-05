'use strict';

const greenhouse = require('./greenhouse');
const lever = require('./lever');
const ashby = require('./ashby');
const smartrecruiters = require('./smartrecruiters');
const workable = require('./workable');
const recruitee = require('./recruitee');
const pinpoint = require('./pinpoint');
const personio = require('./personio');
const remoteok = require('./remoteok');

const REGISTRY = {
  greenhouse,
  lever,
  ashby,
  smartrecruiters,
  workable,
  recruitee,
  pinpoint,
  personio,
  remoteok,
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
