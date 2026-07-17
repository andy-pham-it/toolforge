# LLM Gateway Skills

## Available Skill Files

| Skill | Description |
|-------|-------------|
| `llm-gateway-adapter-guide` | Write custom adapters for any LLM provider |

## Quick CLI Reference

```bash
# Start gateway server
llm-gateway --port 4000 --api-key sk-admin

# With custom host
llm-gateway --port 4000 --host 0.0.0.0 --api-key sk-admin

# With model config file
llm-gateway --port 4000 --api-key sk-admin --config ./gateway-config.json
```

## Key Config Options

| CLI Flag | Env Var | Default | Description |
|----------|---------|---------|-------------|
| `--port` | `GATEWAY_PORT` | `3000` | Listen port |
| `--host` | `GATEWAY_HOST` | `localhost` | Bind address |
| `--api-key` | `GATEWAY_API_KEY` | — | Admin API key |
| `--config` | `GATEWAY_CONFIG` | — | Path to JSON config |

## Troubleshooting

- **Server won't start (EADDRINUSE)**: Port already in use. Use `--port 0` for a random port, or kill the existing process.
- **401 Unauthorized**: Missing or invalid `Authorization: Bearer <key>` header. Verify the key matches one in `keys` config.
- **Model not found**: Check `models` config has the requested model name. `GET /v1/models` lists available models.
- **Rate limited**: Adjust `rateLimits.{tenant}.capacity` / `refillRate` or wait for token refill.
- **Circuit breaker open**: Provider is unhealthy. Wait for `cooldownMs` or check provider status.
- **No stages configured**: The pipeline requires at minimum a fallback chain with one model entry.

## Related

- `@andy-toolforge/core` — Core LLM client with provider routing
- `@andy-toolforge/mcp` — MCP server with gateway integration tools
