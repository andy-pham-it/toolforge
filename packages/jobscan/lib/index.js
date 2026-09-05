'use strict';

const resume = require('./resume');
const matcher = require('./matcher');
const tier = require('./tier');
const scanner = require('./scanner');
const providers = require('./providers');
const license = require('./license');
const LLMClient = require('./llm');
const dataContract = require('../schemas/data-contract.v1.json');

module.exports = {
  version: '0.1.0',
  ...resume,
  ...matcher,
  ...tier,
  ...scanner,
  license,
  LLMClient,
  providers,
  dataContract,
};
