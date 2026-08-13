# @andy-toolforge/messaging

## Role

INFRA package — notification facade for automation pipelines. Sends one message shape to many channels
through a single `Messenger` facade.

## Rules

- CommonJS only (`require` / `module.exports`), no build step.
- Zero runtime dependencies — uses global `fetch` (Node >= 18).
- Adapter contract: `async send(payload)` resolves to an adapter-specific result, throws `Error` on failure.

## Exports

- `Messenger` (lib/messenger.js) — register adapters, `send(name, payload)`, `sendAll(payload)`.
- `TelegramAdapter` (lib/telegram.js) — `token` + `defaultChatId` (+ `parseMode`).
- `DiscordAdapter` (lib/discord.js) — `token` + `defaultChannelId`.
- `ConsoleAdapter` (lib/console.js) — `prefix`, logs to stdout.

## Adding an adapter

1. Add `lib/<name>.js` exporting a class with `async send(payload)`.
2. Export it from `lib/index.js`.
3. Add a test in `lib/messenger.test.js` (mock `global.fetch`).

## Testing

```sh
npm test -w @andy-toolforge/messaging
```
