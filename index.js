const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(3000, () => {
  console.log('Web server running');
});

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create the bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Map to track user message timestamps for anti-spam
const userMessages = new Map();

const BIRTHDAYS_FILE = path.join(__dirname, 'birthdays.json');

const BIRTHDAY_INFO_PAGES = [
  {
    title: '📖 Birthday Commands — Page 1/3',
    description:
      '`/birthday add <date>`\nSave or update your birthday reminder.\nProvide your birthday in `YYYY-MM-DD` format and the bot will wish you a happy birthday every year in the channel you used the command in.',
  },
  {
    title: '📖 Birthday Commands — Page 2/3',
    description:
      '`/birthday remove`\nRemove your saved birthday reminder.\nIf you have a birthday saved, this will delete it so the bot will no longer send you birthday messages.',
  },
  {
    title: '📖 Birthday Commands — Page 3/3',
    description:
      '`/birthday info`\nDisplay information about all birthday subcommands.\nShows you this paginated help menu detailing each available subcommand.',
  },
];

function buildInfoPage(pageIndex) {
  const page = BIRTHDAY_INFO_PAGES[pageIndex];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`birthday_info_prev_${pageIndex}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(`birthday_info_next_${pageIndex}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === BIRTHDAY_INFO_PAGES.length - 1)
  );

  return {
    content: `**${page.title}**\n\n${page.description}`,
    components: [row],
    ephemeral: true,
  };
}

function loadBirthdays() {
  if (!fs.existsSync(BIRTHDAYS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(BIRTHDAYS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read birthdays file:', error);
    return [];
  }
}

function saveBirthdays(birthdays) {
  try {
    fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(birthdays, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save birthdays file:', error);
  }
}

function parseBirthdayDate(input) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

async function registerSlashCommands() {
  const birthdayCommand = new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage birthday reminders')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add or update your birthday reminder')
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('Your birthday in YYYY-MM-DD format')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('remove').setDescription('Remove your saved birthday reminder')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('View info and descriptions for all birthday subcommands')
    );

  const aurafarmCommand = new SlashCommandBuilder()
    .setName('aurafarm')
    .setDescription('Check your aura');

  await client.application.commands.set([birthdayCommand, aurafarmCommand]);
}

async function checkBirthdaysAndSend() {
  const birthdays = loadBirthdays();
  if (birthdays.length === 0) return;

  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  const currentYear = now.getUTCFullYear();
  let hasUpdates = false;

  for (const entry of birthdays) {
    if (entry.month !== currentMonth || entry.day !== currentDay) {
      continue;
    }

    if (entry.lastSentYear === currentYear) {
      continue;
    }

    try {
      const channel = await client.channels.fetch(entry.channelId);
      if (!channel || !channel.isTextBased()) {
        continue;
      }

      await channel.send(`Happy Birthday, <@${entry.userId}>`);
      entry.lastSentYear = currentYear;
      hasUpdates = true;
    } catch (error) {
      console.error(`Failed to send birthday message for user ${entry.userId}:`, error);
    }
  }

  if (hasUpdates) {
    saveBirthdays(birthdays);
  }
}

// Anti-spam settings
const SPAM_INTERVAL = 3000; // 3 seconds
const SPAM_LIMIT = 3; // messages allowed in interval

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  registerSlashCommands()
    .then(() => {
      console.log('Slash commands registered.');
    })
    .catch((error) => {
      console.error('Failed to register slash commands:', error);
    });

  // Check once at startup, then every minute.
  checkBirthdaysAndSend().catch((error) => {
    console.error('Birthday check failed:', error);
  });

  setInterval(() => {
    checkBirthdaysAndSend().catch((error) => {
      console.error('Birthday check failed:', error);
    });
  }, 60 * 1000);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const prevMatch = /^birthday_info_prev_(\d+)$/.exec(interaction.customId);
    const nextMatch = /^birthday_info_next_(\d+)$/.exec(interaction.customId);

    if (prevMatch) {
      const newPage = Number(prevMatch[1]) - 1;
      await interaction.update(buildInfoPage(newPage));
      return;
    }

    if (nextMatch) {
      const newPage = Number(nextMatch[1]) + 1;
      await interaction.update(buildInfoPage(newPage));
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'aurafarm') {
    await interaction.reply(`${interaction.user.username} has aura`);
    return;
  }

  if (interaction.commandName !== 'birthday') return;
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'info') {
    await interaction.reply(buildInfoPage(0));
    return;
  }

  if (subcommand === 'remove') {
    const birthdays = loadBirthdays();
    const filteredBirthdays = birthdays.filter((entry) => entry.userId !== interaction.user.id);

    if (filteredBirthdays.length === birthdays.length) {
      await interaction.reply({
        content: 'You do not have a saved birthday to remove.',
        ephemeral: true,
      });
      return;
    }

    saveBirthdays(filteredBirthdays);
    await interaction.reply({
      content: 'Your birthday reminder has been removed.',
      ephemeral: true,
    });
    return;
  }

  if (subcommand !== 'add') return;

  const dateInput = interaction.options.getString('date', true);
  const parsedDate = parseBirthdayDate(dateInput);

  if (!parsedDate) {
    await interaction.reply({
      content: 'Please use a valid date format: YYYY-MM-DD',
      ephemeral: true,
    });
    return;
  }

  const birthdays = loadBirthdays().filter((entry) => entry.userId !== interaction.user.id);

  const birthdayEntry = {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    month: parsedDate.month,
    day: parsedDate.day,
    originalDate: dateInput,
    lastSentYear: null,
  };

  birthdays.push(birthdayEntry);
  saveBirthdays(birthdays);

  await interaction.reply({
    content: `Birthday saved for ${dateInput}.`,
    ephemeral: true,
  });
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  // --- Anti-Spam Logic ---
  const now = Date.now();
  const timestamps = userMessages.get(message.author.id) || [];
  timestamps.push(now);

  const recent = timestamps.filter((time) => now - time <= SPAM_INTERVAL);
  userMessages.set(message.author.id, recent);

  if (recent.length > SPAM_LIMIT) {
    message.reply('Hey stop spamming').catch(console.error);
  }

  // --- Existing Commands ---
  if (message.content === '!ping') {
    const latency = Date.now() - message.createdTimestamp;
    message.reply(`Pong! Your latency is ${latency}ms.`);
  }

  if (message.content === 'BTF bot does lawrence have aura') {
    message.reply('Yes, Lawrence has infinite aura!');
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);