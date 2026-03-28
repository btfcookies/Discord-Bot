require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

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

// Anti-spam settings
const SPAM_INTERVAL = 3000; // 3 seconds
const SPAM_LIMIT = 3; // messages allowed in interval

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return; // Ignore bots

  // --- Anti-Spam Logic ---
  const now = Date.now();
  const timestamps = userMessages.get(message.author.id) || [];
  timestamps.push(now);

  // Keep only messages within the interval
  const recent = timestamps.filter((time) => now - time <= SPAM_INTERVAL);
  userMessages.set(message.author.id, recent);

  // If exceeded limit, warn user
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