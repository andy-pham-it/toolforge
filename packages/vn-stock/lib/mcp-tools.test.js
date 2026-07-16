const { describe, it } = require('node:test');
const assert = require('node:assert');

const pluginFn = require('../mcp-tools');

describe('vn-stock MCP tools', () => {
    let tools;

    it('should export array of 7 tools', () => {
        tools = pluginFn();
        assert.ok(Array.isArray(tools));
        assert.strictEqual(tools.length, 7);
    });

    it('should have analyze tool with definition and handler', () => {
        const t = tools.find(t => t.definition.name === 'toolforge_vn_stock_analyze');
        assert.ok(t, 'analyze tool missing');
        assert.ok(t.handler);
        assert.ok(t.definition.inputSchema.required.includes('symbol'));
    });

    it('should have deep_dive tool with timeframe param', () => {
        const t = tools.find(t => t.definition.name === 'toolforge_vn_stock_deep_dive');
        assert.ok(t, 'deep_dive tool missing');
        assert.ok(t.definition.inputSchema.properties.timeframe);
        assert.strictEqual(t.definition.inputSchema.properties.timeframe.default, '1D');
    });

    it('should have compare tool with symbols array param', () => {
        const t = tools.find(t => t.definition.name === 'toolforge_vn_stock_compare');
        assert.ok(t, 'compare tool missing');
        assert.ok(t.definition.inputSchema.required.includes('symbols'));
        assert.strictEqual(t.definition.inputSchema.properties.symbols.type, 'array');
    });

    it('all tool definitions have unique names', () => {
        const names = tools.map(t => t.definition.name);
        assert.strictEqual(new Set(names).size, names.length);
    });

    it('all tool definitions have inputSchema with type object', () => {
        tools.forEach(t => {
            assert.strictEqual(t.definition.inputSchema.type, 'object', `${t.definition.name} schema type`);
        });
    });
});
