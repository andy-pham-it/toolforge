const { describe, it } = require('node:test');
const assert = require('node:assert');

const { StockLLM } = require('./llm');

class FakeQuick {
    constructor() { this.calls = []; }
    async generateContent({ model, prompt }) {
        this.calls.push({ model, prompt });
        return { text: `Mock quick: ${prompt.slice(0, 20)}`, raw: {} };
    }
}

class FakeDeep {
    constructor(config) { this.config = config; this.calls = []; }
    async chat(systemPrompt, userPrompt, jsonMode) {
        this.calls.push({ systemPrompt, userPrompt, jsonMode });
        return `Mock deep: ${userPrompt.slice(0, 20)}`;
    }
}

describe('StockLLM', () => {
    it('should construct with injected clients', () => {
        const llm = new StockLLM({ quickClient: new FakeQuick(), deepClient: new FakeDeep() });
        assert.ok(llm);
        assert.ok(llm._quick);
        assert.ok(llm._deep);
    });

    it('quickChat should call injected quick client', async () => {
        const quick = new FakeQuick();
        const llm = new StockLLM({ quickClient: quick, deepClient: new FakeDeep() });
        const result = await llm.quickChat('You are a stock analyst', 'Analyze FPT');
        assert.ok(result.includes('Mock quick'));
        assert.ok(quick.calls[0].model.includes('flash'));
    });

    it('deepChat should call injected deep client', async () => {
        const deep = new FakeDeep();
        const llm = new StockLLM({ quickClient: new FakeQuick(), deepClient: deep });
        const result = await llm.deepChat('You are a deep analyst', 'Deep dive FPT');
        assert.ok(result.includes('Mock deep'));
        assert.strictEqual(deep.calls[0].systemPrompt, 'You are a deep analyst');
    });
});
