# LLM Gateway — Adapter Development Guide

## What is an Adapter?

An adapter wraps a provider's API (OpenAI, Gemini, Anthropic, etc.) into a uniform interface the gateway's ProviderStage can call:

```javascript
{
  chat(messages, options) => Promise<{ content, usage }>
  chatStream(messages, options) => AsyncIterable<{ content, done }>
}
```

## Sync Protocol

```javascript
async function chat(messages, options) {
  const { requestId, tenant, model, signal } = options;
  // Call provider API
  const response = await provider.chat(messages, { model });
  return {
    content: response.text(),
    usage: { promptTokens, completionTokens, costUsd },
  };
}
```

## Streaming Protocol

```javascript
async function* chatStream(messages, options) {
  const stream = await provider.chatStream(messages, { model });
  for await (const chunk of stream) {
    yield { content: chunk.text, done: false };
  }
  yield {
    content: '',
    done: true,
    usage: { promptTokens, completionTokens, costUsd },
  };
}
```

## Registering an Adapter

Pass via `createAdapter` factory in gateway options:

```javascript
const gw = createGateway({
  models: { 'my-model': { provider: 'custom', adapter: 'MyAdapter' } },
  createAdapter: (provider, model) => {
    if (provider === 'custom') return myAdapter;
    // fallback to built-in
  },
});
```

## Built-in Adapters

- **MockAdapter** — returns hardcoded response (for testing)
