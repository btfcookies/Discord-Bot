# Better BTF Bot

A simple Discord bot built with Node.js and `discord.js`.

## Features

- Responds to `!ping` with the user's message latency.
- Responds to `BTF bot does lawrence have aura` with a custom message.
- Supports `/birthday add` to save a user's birthday and send a yearly birthday ping.
- Supports `/birthday remove` to delete a saved birthday reminder.
- Supports `/birthday info` to show birthday command help with paginator buttons.
- Supports `/aura farm` to gain a random amount of Aura.
- Supports `/aura loss` to try making another user lose Aura.
- Supports `/aura leaderboard` with paginator buttons.
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

5. Re-invite or refresh your bot permissions if needed, ensuring it can:
- Read messages
- Send messages
- Use application commands (slash commands)

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
- `/birthday add date:<YYYY-MM-DD>`
  - Saves or updates your birthday.
  - Each user can only have one saved birthday at a time.
  - On that month/day each year, the bot posts: `Happy Birthday, @you` in the channel where you last set it.
- `/birthday remove`
  - Removes your currently saved birthday reminder.
- `/birthday info`
  - Shows a paginated help UI for all birthday subcommands.
- `/aura farm`
  - Grants a random amount of Aura between 1 and 5.
  - Replies publicly with: `<username> gained <amount> aura`.
- `/aura loss username:<@user>`
  - Has a 1 in 5 chance to make the target lose 1 to 5 Aura.
  - If it fails, there is a 50% chance the command user loses 1 to 5 Aura instead.
- `/aura leaderboard`
  - Shows users ranked by total Aura.
  - Displays 5 users per page with Previous/Next buttons.
- `BTF bot does lawrence have aura`
  - Replies: `Yes, Lawrence has infinite aura!`

## Birthday Notes

- Date format must be `YYYY-MM-DD`.
- Each user can only store one birthday at a time.
- Birthdays are stored in a local `birthdays.json` file at the project root.
- Birthday checks run every minute and use UTC date.

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
├── birthdays.json (auto-created when first birthday is added)
├── .env
├── .gitignore
└── README.md
```

## Notes

- Keep your `DISCORD_TOKEN` private.
- Do not commit `.env` to version control.

## License

ISC
