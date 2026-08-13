'use strict';

class DiscordAdapter {
  constructor({ token, defaultChannelId } = {}) {
    if (!token) throw new Error('DiscordAdapter: token is required');
    this.token = token;
    this.defaultChannelId = defaultChannelId;
  }

  async send(payload = {}) {
    const { channelId = this.defaultChannelId, text } = payload;
    if (!channelId) throw new Error('DiscordAdapter: channelId is required');
    if (text == null) throw new Error('DiscordAdapter: text is required');

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${this.token}` },
      body: JSON.stringify({ content: String(text) }),
    });
    if (!res.ok) throw new Error(`DiscordAdapter: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  }
}

module.exports = { DiscordAdapter };
