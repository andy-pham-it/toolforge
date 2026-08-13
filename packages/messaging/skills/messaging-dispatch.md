# Messaging Dispatch

Send notifications from automation pipelines using `@andy-toolforge/messaging`.

## When to use

Any pipeline step that needs to notify the user or another system: job finished, error alert, daily
digest, watchdog.

## Pattern

1. Build one `Messenger` at startup with the adapters you need (Telegram / Discord / Console).
2. Read tokens from env (`TELEGRAM_BOT_TOKEN` / `DISCORD_BOT_TOKEN`) — never hardcode.
3. Send via `messenger.send('<adapter>', { text })` for one channel, or `sendAll({ text })` to fan out.

## Example

```js
const { Messenger, TelegramAdapter, ConsoleAdapter } = require('@andy-toolforge/messaging');

const messenger = new Messenger({
  telegram: new TelegramAdapter({
    token: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID,
  }),
  console: new ConsoleAdapter(),
});

await messenger.send('telegram', { text: 'Pipeline failed at step 3' });
await messenger.sendAll({ text: 'Daily report ready' });
```

## Failure handling

- `send` throws on missing config or HTTP error — wrap in try/catch if the pipeline must continue.
- `sendAll` never throws: each adapter's error is captured as `{ ok: false, error }`.
