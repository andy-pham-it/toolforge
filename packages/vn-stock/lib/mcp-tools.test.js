const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock Analyst by configuring a fake via constructor injection
const { Analyst } = require('./analyst');
class FakeStockLLM {
    async quickChat() { return JSON.stringify({ recommendation: 'MUA', reasoning: 'Strong', risks: [] }); }
    async deepChat() { return JSON.stringify({ strategy: 'Buy dip', entry: 120000, stopLoss: 115000, support: [118000], resistance: [125000], reasoning: 'Uptrend', riskReward: 2 }); }
}

const pluginFn = require('../mcp-tools');

describe('vn-stock MCP tools', () => {
    let tools;

    it('should export array of tools', () => {
        tools = pluginFn();
        assert.ok(Array.isArray(tools));
        assert.ok(tools.length >= 7); // 4 existing + 3 new
    });

    it('should have analyze tool', () => {
        const analyze = tools.find(t => t.definition.name === 'toolforge_vn_stock_analyze');
        assert.ok(analyze, 'analyze tool missing');
        assert.ok(analyze.handler);
    });

    it('should have deep_dive tool', () => {
        const deep = tools.find(t => t.definition.name === 'toolforge_vn_stock_deep_dive');
        assert.ok(deep, 'deep_dive tool missing');
    });

    it('should have compare tool', () => {
        const compare = tools.find(t => t.definition.name === 'toolforge_vn_stock_compare');
        assert.ok(compare, 'compare tool missing');
    });

    it('analyze handler should return stock analysis', async () => {
        const analyze = tools.find(t => t.definition.name === 'toolforge_vn_stock_analyze');
        const result = await analyze.handler(null, { symbol: 'FPT' });
        assert.ok(result.symbol);
        assert.ok(result.recommendation);
    });

    it('compare handler should compare symbols', async () => {
        const compare = tools.find(t => t.definition.name === 'toolforge_vn_stock_compare');
        const result = await compare.handler(null, { symbols: ['FPT', 'VNM'] });
        assert.ok(result.topPick);
    });
});
