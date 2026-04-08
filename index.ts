import express from 'express';
import dotenv from 'dotenv';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  SlashCommandBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

app.get('/', (_req, res) => {
  res.send('Bot is alive!');
});

app.listen(3000, () => {
  console.log('Web server running');
});

interface BirthdayInfoPage {
  title: string;
  command: string;
  summary: string;
  details: string;
}

interface GeneralInfoPage {
  title: string;
  command: string;
  summary: string;
  subcommands: string[];
}

interface BirthdayEntry {
  userId: string;
  guildId: string;
  channelId: string;
  month: number;
  day: number;
  originalDate: string;
  lastSentYear: number | null;
}

interface AuraEntry {
  userId: string;
  Aura: number;
}

interface ParsedBirthdayDate {
  year: number;
  month: number;
  day: number;
}

// Create the bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Map to track user message timestamps for anti-spam
const userMessages = new Map<string, number[]>();
// Map to track spam burst events per user within the spam event window
const userSpamEvents = new Map<string, number[]>();

const BIRTHDAYS_FILE = path.join(__dirname, 'birthdays.json');
const AURA_FILE = path.join(__dirname, 'aura.json');

const BIRTHDAY_INFO_PAGES: BirthdayInfoPage[] = [
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

const GENERAL_INFO_PAGES: GeneralInfoPage[] = [
  {
    title: 'General Command Info',
    command: '/birthday',
    summary: 'Manage birthday reminders.',
    subcommands: ['/birthday add <date>', '/birthday remove', '/birthday info'],
  },
  {
    title: 'General Command Info',
    command: '/aura',
    summary: 'Manage aura farming, gains, losses, and ranking.',
    subcommands: ['/aura add <amount> [username]', '/aura farm', '/aura loss <username>', '/aura leaderboard'],
  },
  {
    title: 'General Command Info',
    command: '/ping',
    summary: 'Check bot latency.',
    subcommands: ['No subcommands'],
  },
  {
    title: 'General Command Info',
    command: '/hellno',
    summary: 'Tell someone hell no.',
    subcommands: ['No subcommands'],
  },
  {
    title: 'General Command Info',
    command: '/whoasked',
    summary: 'Tell someone who asked?',
    subcommands: ['No subcommands'],
  },
  {
    title: 'General Command Info',
    command: '/info',
    summary: 'Show all slash commands with pagination.',
    subcommands: ['No subcommands'],
  },
];

const AURA_LEADERBOARD_PAGE_SIZE = 5;

function buildInfoPage(pageIndex: number) {
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

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

function buildGeneralInfoPage(pageIndex: number) {
  const page = GENERAL_INFO_PAGES[pageIndex];

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📘 ${page.title}`)
    .addFields(
      { name: 'Command', value: `\`${page.command}\``, inline: false },
      { name: 'Summary', value: page.summary, inline: false },
      { name: 'Subcommands', value: page.subcommands.join('\n'), inline: false }
    )
    .setFooter({ text: `Page ${pageIndex + 1} of ${GENERAL_INFO_PAGES.length}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`general_info_prev_${pageIndex}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('general_info_page_indicator')
      .setLabel(`${pageIndex + 1}/${GENERAL_INFO_PAGES.length}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`general_info_next_${pageIndex}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === GENERAL_INFO_PAGES.length - 1)
  );

  return {
    embeds: [embed],
    components: [row],
  };
}

function loadBirthdays(): BirthdayEntry[] {
  if (!fs.existsSync(BIRTHDAYS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(BIRTHDAYS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BirthdayEntry[]) : [];
  } catch (error) {
    console.error('Failed to read birthdays file:', error);
    return [];
  }
}

function loadAura(): AuraEntry[] {
  if (!fs.existsSync(AURA_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(AURA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuraEntry[]) : [];
  } catch (error) {
    console.error('Failed to read aura file:', error);
    return [];
  }
}

function saveAura(aura: AuraEntry[]): void {
  try {
    fs.writeFileSync(AURA_FILE, JSON.stringify(aura, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save aura file:', error);
  }
}

function getSortedAuraEntries(): AuraEntry[] {
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

function buildAuraLeaderboardPage(pageIndex: number) {
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

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

function saveBirthdays(birthdays: BirthdayEntry[]): void {
  try {
    fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(birthdays, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save birthdays file:', error);
  }
}

function parseBirthdayDate(input: string): ParsedBirthdayDate | null {
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

async function findGuildMemberMentionByName(
  guild: import('discord.js').Guild | null,
  name: string
): Promise<string | null> {
  if (!guild) {
    return null;
  }

  const normalizedName = name.trim().toLowerCase();
  const cachedMember = guild.members.cache.find((member) => {
    const username = member.user.username.toLowerCase();
    const globalName = member.user.globalName?.toLowerCase();
    const displayName = member.displayName.toLowerCase();

    return (
      username === normalizedName ||
      globalName === normalizedName ||
      displayName === normalizedName
    );
  });

  if (cachedMember) {
    return `<@${cachedMember.id}>`;
  }

  try {
    const members = await guild.members.search({ query: name, limit: 10 });
    const matchedMember = members.find((member) => {
      const username = member.user.username.toLowerCase();
      const globalName = member.user.globalName?.toLowerCase();
      const displayName = member.displayName.toLowerCase();

      return (
        username === normalizedName ||
        globalName === normalizedName ||
        displayName === normalizedName
      );
    });

    return matchedMember ? `<@${matchedMember.id}>` : null;
  } catch (error) {
    console.error(`Failed to find guild member for name "${name}":`, error);
    return null;
  }
}

async function registerSlashCommands(): Promise<void> {
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
      subcommand
        .setName('add')
        .setDescription('Add aura to yourself or another user')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount of aura to add (minimum 1)')
            .setRequired(true)
            .setMinValue(1)
        )
        .addUserOption((option) =>
          option
            .setName('username')
            .setDescription('Optional: user to add aura to')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('farm').setDescription('Farm a random amount of aura (1-5)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('loss')
        .setDescription('Try to make another user lose 1-5 aura')
        .addUserOption((option) =>
          option
            .setName('username')
            .setDescription('The user to make lose aura')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Show the aura leaderboard')
    );

  const pingCommand = new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check the bot's latency");

  const hellnoCommand = new SlashCommandBuilder()
    .setName('hellno')
    .setDescription('Tell someone hell no')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to say hell no to')
        .setRequired(true)
    );

  const whoaskedCommand = new SlashCommandBuilder()
    .setName('whoasked')
    .setDescription('Ask who asked')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to ask who asked')
        .setRequired(true)
    );

  const infoCommand = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show all slash commands and their subcommands');

  if (!client.application) {
    throw new Error('Discord client application is not initialized yet.');
  }

  await client.application.commands.set([
    birthdayCommand,
    auraCommand,
    pingCommand,
    hellnoCommand,
    whoaskedCommand,
    infoCommand,
  ]);
}

async function checkBirthdaysAndSend(): Promise<void> {
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
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
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

// Anti- settings
const SPAM_INTERVAL = 3000; // 3 seconds — window for detecting a spam burst
const SPAM_LIMIT = 3; // messages within SPAM_INTERVAL = one spam burst
const SPAM_EVENT_INTERVAL = 120000; // 2 minutes — window for counting spam bursts
const SPAM_EVENT_LIMIT = 3; // spam bursts within SPAM_EVENT_INTERVAL = timeout
const AURA_ADD_REQUIRED_ROLE_NAME = '👑COOKIEMONSTER👑';

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag ?? 'unknown user'}`);

  client.user?.setPresence({
    activities: [{ name: 'buying BTF' }],
    status: 'online',
  });

  registerSlashCommands()
    .then(() => {
      console.log('[Discord] Slash commands registered.');
    })
    .catch((error) => {
      console.error('[Discord] Failed to register slash commands:', error);
    });

  // Send startup message
  const channelId = '1490417449831501914';
  client.channels.fetch(channelId)
    .then((channel) => {
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        const botPingRole = channel.guild.roles.cache.find(role => role.name === 'bot ping');
        if (botPingRole) {
          const startupEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🟢 Bot is Online')
            .addFields(
              { name: 'I HAVE AWAKEN', value: ' ', inline: false },
              { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Notification - Bob the 2nd' });

          channel.send({ content: `<@&${botPingRole.id}>`, embeds: [startupEmbed] })
            .then(() => {
              console.log(`[BOT] Startup message sent to channel ${channel.id}.`);
            })
            .catch((error) => {
              console.error('Failed to send startup message:', error);
            });
        } else {
          console.error('Bot ping role not found');
        }
      }
    })
    .catch((error) => {
      console.error('Failed to fetch startup channel:', error);
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
    const generalPrevMatch = /^general_info_prev_(\d+)$/.exec(interaction.customId);
    const generalNextMatch = /^general_info_next_(\d+)$/.exec(interaction.customId);

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

    if (generalPrevMatch) {
      const newPage = Number(generalPrevMatch[1]) - 1;
      await interaction.update(buildGeneralInfoPage(newPage));
      return;
    }

    if (generalNextMatch) {
      const newPage = Number(generalNextMatch[1]) + 1;
      await interaction.update(buildGeneralInfoPage(newPage));
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

  if (interaction.commandName === 'hellno') {
    const targetUser = interaction.options.getUser('user', true);
    await interaction.reply(`<@${targetUser.id}> - hell no`);
    return;
  }

  if (interaction.commandName === 'whoasked') {
    const targetUser = interaction.options.getUser('user', true);
    await interaction.reply(`<@${targetUser.id}> - who asked?`);
    return;
  }

  if (interaction.commandName === 'info') {
    await interaction.reply(buildGeneralInfoPage(0));
    return;
  }

  if (interaction.commandName === 'aura') {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      if (!interaction.guild || !interaction.guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRequiredRole = member.roles.cache.some(
        (role) => role.name === AURA_ADD_REQUIRED_ROLE_NAME
      );

      if (!hasRequiredRole) {
        await interaction.reply({
          content: `You need the ${AURA_ADD_REQUIRED_ROLE_NAME} role to use /aura add.`,
          ephemeral: true,
        });
        return;
      }

      const amount = interaction.options.getInteger('amount', true);
      const targetUser = interaction.options.getUser('username') || interaction.user;
      const aura = loadAura();
      const targetEntry = aura.find((entry) => entry.userId === targetUser.id);

      if (targetEntry) {
        targetEntry.Aura += amount;
      } else {
        aura.push({ userId: targetUser.id, Aura: amount });
      }

      saveAura(aura);

      const updatedEntry = aura.find((entry) => entry.userId === targetUser.id);
      const totalAura = updatedEntry ? updatedEntry.Aura : amount;

      await interaction.reply({
        content: `<@${interaction.user.id}> added ${amount} aura to <@${targetUser.id}>. Total Aura: ${totalAura}`,
        ephemeral: true,
      });
      return;
    }

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

    if (subcommand === 'loss') {
      const LOSS_METHODS = [
        'leaking their search history',
        'not letting them buy btf',
        'making them say 67',
      ];

      const targetUser = interaction.options.getUser('username', true);
      const aura = loadAura();
      const commandSucceeded = Math.floor(Math.random() * 4) === 0;

      if (commandSucceeded) {
        const lossAmount = Math.floor(Math.random() * 5) + 1;
        const lossMethod = LOSS_METHODS[Math.floor(Math.random() * LOSS_METHODS.length)];
        const targetEntry = aura.find((entry) => entry.userId === targetUser.id);

        if (targetEntry) {
          targetEntry.Aura = Math.max(0, targetEntry.Aura - lossAmount);
        } else {
          aura.push({ userId: targetUser.id, Aura: 0 });
        }

        saveAura(aura);

        await interaction.reply(
          `<@${interaction.user.id}> made <@${targetUser.id}> lose ${lossAmount} aura by ${lossMethod}`
        );
        return;
      }

      const issuerEntry = aura.find((entry) => entry.userId === interaction.user.id);
      let message = `<@${interaction.user.id}> tried to make <@${targetUser.id}> lose aura, but failed.`;

      if (Math.floor(Math.random() * 2) === 0) {
        const issuerLossAmount = Math.floor(Math.random() * 5) + 1;

        if (issuerEntry) {
          issuerEntry.Aura = Math.max(0, issuerEntry.Aura - issuerLossAmount);
        } else {
          aura.push({ userId: interaction.user.id, Aura: 0 });
        }

        message += ` <@${interaction.user.id}> lost ${issuerLossAmount} aura because they failed.`;
      }

      saveAura(aura);
      await interaction.reply(message);
      return;
    }

    if (subcommand === 'leaderboard') {
      await interaction.reply(buildAuraLeaderboardPage(0));
      return;
    }

    return;
  }

  if (interaction.commandName !== 'birthday') return;
  if (!interaction.guild || !interaction.guildId) {
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

  const birthdayEntry: BirthdayEntry = {
    userId: interaction.user.id,
    guildId: interaction.guildId ?? '',
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

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- Anti-Spam Logic ---
  const now = Date.now();
  const timestamps = userMessages.get(message.author.id) || [];
  timestamps.push(now);

  const recent = timestamps.filter((time) => now - time <= SPAM_INTERVAL);
  userMessages.set(message.author.id, recent);

  if (recent.length >= SPAM_LIMIT) {
    // One spam burst detected — reset message timestamps
    userMessages.set(message.author.id, []);

    // Record this burst and check if the user has hit the burst limit
    const spamEventTimestamps = userSpamEvents.get(message.author.id) || [];
    spamEventTimestamps.push(now);
    const recentSpamEvents = spamEventTimestamps.filter((t) => now - t <= SPAM_EVENT_INTERVAL);
    userSpamEvents.set(message.author.id, recentSpamEvents);

    if (recentSpamEvents.length >= SPAM_EVENT_LIMIT) {
      // 3 spam bursts in 2 minutes — timeout the user
      userSpamEvents.set(message.author.id, []);

      if (message.guild) {
        try {
          const member = await message.guild.members.fetch(message.author.id);

          // Skip timeout for users with the exempt role
          if (member.roles.cache.some((role) => role.name === AURA_ADD_REQUIRED_ROLE_NAME)) {
            return;
          }

          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`🔇 ${message.author.username} was timed out`)
            .addFields(
              { name: 'Reason', value: 'Spamming', inline: false },
              { name: 'Duration', value: '5 minutes', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Automated anti-spam system' });

          if (member.moderatable) {
            await member.timeout(5 * 60 * 1000, 'Spamming');
          } else {
            timeoutEmbed.setFooter({ text: 'Automated anti-spam system — could not apply timeout (insufficient permissions or higher role)' });
          }

          await message.channel.send({ embeds: [timeoutEmbed] }).catch(console.error);
        } catch (error) {
          console.error(`Failed to timeout user ${message.author.id}:`, error);
        }
      }
      return;
    }
  }

  // --- Existing Commands ---
  if (client.user && message.mentions.has(client.user)) {
    await message.reply({ content: 'Need help? Here are my commands:', ...buildGeneralInfoPage(0) });
    return;
  }

  if (message.content.trim() === 'Bob the 2nd, owen criticized you') {
    const bradMention =
      (await findGuildMemberMentionByName(message.guild, 'brad_the_lad')) ?? '@brad_the_lad';

    message
      .reply(`how dare you ${bradMention}! should i ban him?`)
      .catch(console.error);
    return;
  }

  if (message.content === 'Bob the 2nd does lawrence have aura') {
    message.reply('Yes, Lawrence has infinite aura!');
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
