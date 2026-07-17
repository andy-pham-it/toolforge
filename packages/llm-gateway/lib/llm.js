'use strict';

const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');
const { createGateway } = require('./gateway');

class LLMClient extends CoreLLMClient {
    constructor(config = {}) {
        const { gateway, apiKey, ...rest } = config;
        super({});

        const gatewayConfig = gateway
            ? { apiKey }
            : {
                  apiKey,
                  keys: rest.keys || (apiKey ? { [apiKey]: { tenant: rest.tenant || 'default' } } : {}),
                  ...rest,
              };

        this._gateway = gateway || createGateway(gatewayConfig);
        this._defaultModel = config.defaultModel || (config.models ? Object.keys(config.models)[0] : null) || 'default';
    }

    async chat(systemPrompt, userPrompt, jsonMode = false, _fetchFn) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userPrompt });

        const result = await this._gateway.chat({
            model: this._defaultModel,
            messages,
            jsonMode,
        });
        return result.content;
    }

    async chatStream(systemPrompt, userPrompt, jsonMode = false) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userPrompt });

        const result = await this._gateway.chat({
            model: this._defaultModel,
            messages,
            stream: true,
            jsonMode,
        });
        return result;
    }
}

module.exports = LLMClient;
