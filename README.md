# Better BTF Bot

A simple Discord bot built with Node.js and `discord.js`.

## Features

- Responds to `!ping` with the user's message latency.
- Responds to `BTF bot does lawrence have aura` with a custom message.
- Includes basic anti-spam detection and warning.

## Tech Stack

- Node.js
- discord.js v14
- dotenv

## Prerequisites

- Node.js 18+ (recommended)
- A Discord application and bot token

## Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_discord_bot_token_here
```

4. Make sure your bot has these Privileged Gateway Intents enabled in the Discord Developer Portal:
- Message Content Intent

5. Invite the bot to your server with permissions to:
- Read messages
- Send messages

6. Start the bot:

```bash
node index.js
```

When successful, you should see:

```text
Logged in as <your_bot_name>
```

## Commands

- `!ping`
  - Replies with the user's latency (in milliseconds) from when the message was sent to when the bot processed it.
- `BTF bot does lawrence have aura`
  - Replies: `Yes, Lawrence has infinite aura!`

## Anti-Spam Behavior

The bot tracks recent messages per user and warns with `Hey stop spamming` when a user sends too many messages in a short period.

Current defaults in the code:

- Interval: 3 seconds
- Limit: more than 3 messages in that interval

## Project Structure

```text
.
├── index.js
├── package.json
├── package-lock.json
├── .env
├── .gitignore
└── README.md
```

## Notes

- Keep your `DISCORD_TOKEN` private.
- Do not commit `.env` to version control.

## License

ISC
