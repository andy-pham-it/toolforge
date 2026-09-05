'use strict';

const resume = require('./resume');
const matcher = require('./matcher');
const tier = require('./tier');
const scanner = require('./scanner');
const providers = require('./providers');
const license = require('./license');
const companies = require('./companies');
const LLMClient = require('./llm');
const dataContract = require('../schemas/data-contract.v1.json');

module.exports = {
  version: '0.3.2',
  ...resume,
  ...matcher,
  ...tier,
  ...scanner,
  ...companies,
  license,
  LLMClient,
  providers,
  dataContract,
};
