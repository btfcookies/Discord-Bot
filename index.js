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
  EmbedBuilder,
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
const AURA_FILE = path.join(__dirname, 'aura.json');

const BIRTHDAY_INFO_PAGES = [
  {
    title: 'Birthday Commands',
    command: '/birthday add <date>',
    summary: 'Save or update your birthday reminder.',
    details:
      'Use `YYYY-MM-DD`. The bot will wish you a happy birthday every year in the channel where you ran the command.',
  },
  {
    title: 'Birthday Commands',
    command: '/birthday remove',
    summary: 'Remove your saved birthday reminder.',
    details:
      'Deletes your saved birthday so the bot will no longer send birthday messages for you.',
  },
  {
    title: 'Birthday Commands',
    command: '/birthday info',
    summary: 'Display information about all birthday subcommands.',
    details: 'Shows this paginator with details for each available birthday command.',
  },
];

const AURA_LEADERBOARD_PAGE_SIZE = 5;

function buildInfoPage(pageIndex) {
  const page = BIRTHDAY_INFO_PAGES[pageIndex];

  const embed = new EmbedBuilder()
    .setColor(0x00fff7)
    .setTitle(`📖 ${page.title}`)
    .addFields(
      { name: 'Command', value: `\`${page.command}\``, inline: false },
      { name: 'Summary', value: page.summary, inline: false },
      { name: 'Details', value: page.details, inline: false }
    )
    .setFooter({ text: `Page ${pageIndex + 1} of ${BIRTHDAY_INFO_PAGES.length}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`birthday_info_prev_${pageIndex}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('birthday_info_page_indicator')
      .setLabel(`${pageIndex + 1}/${BIRTHDAY_INFO_PAGES.length}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`birthday_info_next_${pageIndex}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === BIRTHDAY_INFO_PAGES.length - 1)
  );

  return {
    embeds: [embed],
    components: [row],
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

function loadAura() {
  if (!fs.existsSync(AURA_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(AURA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read aura file:', error);
    return [];
  }
}

function saveAura(aura) {
  try {
    fs.writeFileSync(AURA_FILE, JSON.stringify(aura, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save aura file:', error);
  }
}

function getSortedAuraEntries() {
  return loadAura()
    .filter(
      (entry) =>
        entry &&
        typeof entry.userId === 'string' &&
        Number.isInteger(entry.Aura) &&
        entry.Aura >= 0
    )
    .sort((a, b) => b.Aura - a.Aura);
}

function buildAuraLeaderboardPage(pageIndex) {
  const sortedAura = getSortedAuraEntries();
  const totalPages = Math.max(1, Math.ceil(sortedAura.length / AURA_LEADERBOARD_PAGE_SIZE));
  const safePageIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1);
  const start = safePageIndex * AURA_LEADERBOARD_PAGE_SIZE;
  const end = start + AURA_LEADERBOARD_PAGE_SIZE;
  const pageEntries = sortedAura.slice(start, end);

  const lines =
    pageEntries.length > 0
      ? pageEntries
          .map((entry, idx) => {
            const rank = start + idx + 1;
            return `${rank}. <@${entry.userId}> - ${entry.Aura} Aura`;
          })
          .join('\n')
      : 'No aura has been farmed yet.';

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Aura Leaderboard')
    .setDescription(lines)
    .setFooter({ text: `Page ${safePageIndex + 1} of ${totalPages}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aura_lb_prev_${safePageIndex}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePageIndex === 0),
    new ButtonBuilder()
      .setCustomId('aura_lb_page_indicator')
      .setLabel(`${safePageIndex + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`aura_lb_next_${safePageIndex}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePageIndex === totalPages - 1)
  );

  return {
    embeds: [embed],
    components: [row],
  };
}

function saveBirthdays(birthdays) {
  try {
    fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(birthdays, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save birthdays file:', error);
  }
}

function parseBirthdayDate(input) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
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

  const auraCommand = new SlashCommandBuilder()
    .setName('aura')
    .setDescription('Aura commands')
    .addSubcommand((subcommand) =>
      subcommand.setName('farm').setDescription('Farm a random amount of aura (1-5)')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Show the aura leaderboard')
    );

  const pingCommand = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency');

  await client.application.commands.set([birthdayCommand, auraCommand, pingCommand]);
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
    const auraPrevMatch = /^aura_lb_prev_(\d+)$/.exec(interaction.customId);
    const auraNextMatch = /^aura_lb_next_(\d+)$/.exec(interaction.customId);

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

    if (auraPrevMatch) {
      const newPage = Number(auraPrevMatch[1]) - 1;
      await interaction.update(buildAuraLeaderboardPage(newPage));
      return;
    }

    if (auraNextMatch) {
      const newPage = Number(auraNextMatch[1]) + 1;
      await interaction.update(buildAuraLeaderboardPage(newPage));
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! Latency is ${latency}ms.`);
    return;
  }

  if (interaction.commandName === 'aura') {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'farm') {
      const gainedAmount = Math.floor(Math.random() * 5) + 1;
      const aura = loadAura();
      const existingEntry = aura.find((entry) => entry.userId === interaction.user.id);

      if (existingEntry) {
        existingEntry.Aura += gainedAmount;
      } else {
        aura.push({ userId: interaction.user.id, Aura: gainedAmount });
      }

      saveAura(aura);

      await interaction.reply(`<@${interaction.user.id}> gained ${gainedAmount} aura`);
      return;
    }

    if (subcommand === 'leaderboard') {
      await interaction.reply(buildAuraLeaderboardPage(0));
      return;
    }

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
  if (message.content === 'BTF bot does lawrence have aura') {
    message.reply('Yes, Lawrence has infinite aura!');
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);