'use strict';

class TelegramAdapter {
  constructor({ token, defaultChatId, parseMode = 'Markdown' } = {}) {
    if (!token) throw new Error('TelegramAdapter: token is required');
    this.token = token;
    this.defaultChatId = defaultChatId;
    this.parseMode = parseMode;
  }

  async send(payload = {}) {
    const { chatId = this.defaultChatId, text, parseMode = this.parseMode } = payload;
    if (!chatId) throw new Error('TelegramAdapter: chatId is required');
    if (text == null) throw new Error('TelegramAdapter: text is required');

    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(text), parse_mode: parseMode }),
    });
    if (!res.ok) throw new Error(`TelegramAdapter: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  }
}

module.exports = { TelegramAdapter };
