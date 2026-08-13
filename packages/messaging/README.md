# @andy-toolforge/messaging

Notify automation pipelines through one facade. Telegram, Discord, or plain console — same payload shape.

## Install

```sh
npm install @andy-toolforge/messaging
```

## Quick start

```js
const { Messenger, TelegramAdapter, ConsoleAdapter } = require('@andy-toolforge/messaging');

const messenger = new Messenger({
  telegram: new TelegramAdapter({ token: process.env.TELEGRAM_BOT_TOKEN, defaultChatId: '123456789' }),
  console: new ConsoleAdapter(),
});

await messenger.send('telegram', { text: 'Build finished' });
await messenger.sendAll({ text: 'Job done' }); // fan-out to every adapter
```

## Adapters

| Adapter | Env var | Options | Payload |
|---|---|---|---|
| `TelegramAdapter` | `TELEGRAM_BOT_TOKEN` | `token`, `defaultChatId`, `parseMode` (default `Markdown`) | `{ chatId?, text, parseMode? }` |
| `DiscordAdapter` | `DISCORD_BOT_TOKEN` | `token`, `defaultChannelId` | `{ channelId?, text }` |
| `ConsoleAdapter` | — | `prefix` (default `[messaging]`) | `{ text }` |

All adapters implement `async send(payload)` and throw on failure (missing config or HTTP error).

## Messenger API

- `new Messenger(adapters)` — object mapping name → adapter
- `register(name, adapter)` — chainable
- `get(name)`
- `send(name, payload)` — throws `Messenger: unknown adapter <name>` if not registered
- `sendAll(payload)` — never throws; returns `[{ name, ok, result | error }]` per adapter

## Zero dependencies

The package uses Node's global `fetch` (Node >= 18) — no HTTP client dependency required.

## Testing

```sh
npm test -w @andy-toolforge/messaging
```
