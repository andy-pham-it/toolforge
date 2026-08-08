'use strict';

const { writeConfig } = require('../config');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

async function opencodeSetModels({ config, args }) {
  const action = args.action || 'set';
  const valid = ['set', 'add', 'remove', 'list'];
  if (!valid.includes(action)) return error('INVALID_ARGS', `action must be one of: ${valid.join(', ')}`);
  if (action !== 'list' && !Array.isArray(args.models)) {
    return error('INVALID_ARGS', 'models must be an array');
  }

  if (action === 'list') {
    return { status: 'success', data: { models: config.models } };
  }

  const incoming = (args.models || []).filter((m) => typeof m === 'string');
  let models;
  if (action === 'set') {
    models = incoming;
  } else if (action === 'add') {
    models = [...config.models];
    for (const m of incoming) if (!models.includes(m)) models.push(m);
  } else if (action === 'remove') {
    models = config.models.filter((m) => !incoming.includes(m));
  }

  writeConfig({ ...config, models }, undefined);
  return { status: 'success', data: { models } };
}

module.exports = { opencodeSetModels };
