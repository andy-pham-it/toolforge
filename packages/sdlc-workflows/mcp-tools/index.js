'use strict';

/**
 * @andy-toolforge/sdlc-workflows MCP tools.
 * Auto-discovers all tool modules in this directory and exports them
 * as an array of { definition, handler } — the same shape as the
 * original monolithic mcp-tools.js.
 */

const getTemplate = require('./get-template');
const listTemplates = require('./list-templates');
const getStandard = require('./get-standard');
const validateDocument = require('./validate-document');
const validateSkill = require('./validate-skill');
const checkVersion = require('./check-version');
const searchSkills = require('./search-skills');
const renderTemplate = require('./render-template');

module.exports = function () {
    return [
        getTemplate,
        listTemplates,
        getStandard,
        validateDocument,
        validateSkill,
        checkVersion,
        searchSkills,
        renderTemplate,
    ];
};
