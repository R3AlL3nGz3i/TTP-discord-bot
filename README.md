# Discord Message Scraper

Scrapes messages from a specific user in a specific Discord channel. Built on [discord.js-selfbot-v13](https://github.com/aiko-chan-ai/discord.js-selfbot-v13).

## Prerequisites

- **Node.js 20.18.0** or newer

## Installation

```sh
npm install
```

## Setup & Run

Run the setup script — it will prompt you for your IDs and optionally start the scraper:

```sh
./run.sh
```

You will be asked for:

| Field | Description | How to get it |
|---|---|---|
| **Discord Token** | Your Discord account token | See [Get Token](#get-token) below |
| **Discord User ID** | Your own Discord user ID | Right-click your name → Copy User ID |
| **Discord Server ID** | The server containing the channel | Right-click server icon → Copy Server ID |
| **Channel ID** | The channel to scrape | Right-click channel → Copy Channel ID |
| **Target User ID** | The user whose messages to scrape | Right-click their name → Copy User ID |

> **Note:** Enable **Developer Mode** in Discord (Settings → Advanced → Developer Mode) to see the "Copy ID" options.

These values are saved to a `.env` file (git-ignored) so you only need to enter them once.

### Run directly (without the setup prompts)

If your `.env` is already configured:

```sh
node bot.js
```

## Output

Messages are saved to `scraped_messages.json` with the following format:

```json
[
  {
    "date": "04/02/2023",
    "time": "02:20:41",
    "content": "Message text here",
    "username": "user123",
    "displayName": "User",
    "attachments": ["https://cdn.discordapp.com/..."]
  }
]
```

## .env format

```env
DISCORD_TOKEN=your_token_here
DISCORD_USER_ID=123456789
DISCORD_SERVER_ID=123456789
CHANNEL_ID=123456789
TARGET_USER_ID=123456789
```

## Get Token

1. Open Discord in a browser (or desktop app)
2. Press `Ctrl+Shift+I` (or `Cmd+Opt+I` on Mac) to open DevTools
3. Go to the **Console** tab
4. Paste the following and press Enter:

```js
window.webpackChunkdiscord_app.push([
  [Symbol()],
  {},
  req => {
    if (!req.c) return;
    for (let m of Object.values(req.c)) {
      try {
        if (!m.exports || m.exports === window) continue;
        if (m.exports?.getToken) return copy(m.exports.getToken());
        for (let ex in m.exports) {
          if (m.exports?.[ex]?.getToken && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return copy(m.exports[ex].getToken());
        }
      } catch {}
    }
  },
]);
window.webpackChunkdiscord_app.pop();
console.log('%cWorked!', 'font-size: 50px');
console.log(`%cYou now have your token in the clipboard!`, 'font-size: 16px');
```

## Contributing

- Before creating an issue, please ensure that it hasn't already been reported/suggested, and double-check the
[documentation](https://discordjs-self-v13.netlify.app/).  
- See [the contribution guide](https://github.com/discordjs/discord.js/blob/main/.github/CONTRIBUTING.md) if you'd like to submit a PR.

## Need help?
Github Discussion: [Here](https://github.com/aiko-chan-ai/discord.js-selfbot-v13/discussions)

## Credits

- [discord.js-selfbot-v13](https://github.com/aiko-chan-ai/discord.js-selfbot-v13)
- [Discord.js](https://github.com/discordjs/discord.js)
