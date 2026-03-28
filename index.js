require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.content === '!ping') {
    const latency = Date.now() - message.createdTimestamp;

    message.reply(`Pong! Your latency is ${latency}ms.`);
  }

  if (message.content === 'BTF bot does lawrence have aura') {
    message.reply('Yes, Lawrence has infinite aura!');
  }
});

client.login(process.env.DISCORD_TOKEN);