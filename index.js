import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';

// --- Slash Command Definitions ---
const commands = [
  new SlashCommandBuilder()
    .setName('tutorial')
    .setDescription('Watch how to start and join the Aternos server.'),

  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Minecraft username so the owner can give you access.')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your Minecraft username')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('removeme')
    .setDescription('Remove your saved Minecraft username.'),

  new SlashCommandBuilder()
    .setName('listusers')
    .setDescription('Owner only — show all registered users.'),

  new SlashCommandBuilder()
    .setName('aternos')
    .setDescription('Open the Aternos dashboard link.')
].map(cmd => cmd.toJSON());

// --- Environment Variables ---
const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const CLIENT_ID = '1472795839851135159';
const DATA_FILE = './users.json';
const START_VIDEO_URL = 'https://youtu.be/0GUT7KpAoIs';
const JOIN_VIDEO_URL = 'https://youtu.be/UF0Oq-WxXdw';

// --- Initialize Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // 👈 Needed for welcome messages
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// --- Utility Functions ---
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = data => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
const validMinecraftName = name => /^[A-Za-z0-9_]{3,16}$/.test(name);
const friendlyReplies = [
  "Sure thing! 😊",
  "On it — one sec! ✨",
  "You got it, friend! 🤝",
  "I’m on the case! 🔎",
  "Absolutely — sending that now! 🚀"
];
const pickReply = () => friendlyReplies[Math.floor(Math.random() * friendlyReplies.length)];

// --- Register Slash Commands (runs on start) ---
(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();

// --- Bot Ready ---
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
});

// --- Welcome Message on Join ---
client.on('guildMemberAdd', async (member) => {
  try {
    const channel = member.guild.systemChannel; // Default welcome channel
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle(`👋 Welcome, ${member.user.username}!`)
      .setDescription(
        `We’re glad to have you here!\n\nType **/tutorial** to learn how to start and join the Minecraft server.\nIf you ever get stuck, you can also use **/aternos** to open the server dashboard.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Welcome to the community 🎉' })
      .setTimestamp();

    await channel.send({
      content: `Hey <@${member.id}>! 👋`,
      embeds: [welcomeEmbed]
    });

    console.log(`✅ Welcomed ${member.user.tag}`);
  } catch (err) {
    console.error('❌ Failed to send welcome message:', err);
  }
});

// --- Slash Command Handling ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // /tutorial (fixed embeds)
  if (commandName === 'tutorial') {
    await interaction.deferReply();

    const reply = pickReply();

    const startEmbed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle('🎥 How to Start the Server')
      .setURL(START_VIDEO_URL)
      .setDescription('Click the title or link below to watch on YouTube!')
      .setThumbnail('https://i.ytimg.com/vi/0GUT7KpAoIs/hqdefault.jpg')
      .addFields({ name: 'Watch here:', value: START_VIDEO_URL })
      .setFooter({ text: 'Step 1: Starting your Aternos Server' });

    const joinEmbed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle('🎮 How to Join the Server')
      .setURL(JOIN_VIDEO_URL)
      .setDescription('Click the title or link below to watch on YouTube!')
      .setThumbnail('https://i.ytimg.com/vi/UF0Oq-WxXdw/hqdefault.jpg')
      .addFields({ name: 'Watch here:', value: JOIN_VIDEO_URL })
      .setFooter({ text: 'Step 2: Joining your Minecraft Server' });

    await interaction.editReply({
      content: `${reply}\nHere are both tutorial videos you’ll need 👇\n\n🎥 **Start the Server:** ${START_VIDEO_URL}\n🎮 **Join the Server:** ${JOIN_VIDEO_URL}`,
      embeds: [startEmbed, joinEmbed]
    });
  }

  // /register <username>
  if (commandName === 'register') {
    const username = interaction.options.getString('username');
    if (!validMinecraftName(username)) {
      return interaction.reply('That username doesn’t look valid. Minecraft usernames are 3–16 characters, letters/numbers/underscores only.');
    }

    const data = readData();
    const exists = data.users.find(u => u.userId === interaction.user.id || u.mcName.toLowerCase() === username.toLowerCase());
    if (exists) return interaction.reply('You (or that name) are already registered! Use `/removeme` first if you want to change it.');

    const entry = {
      userId: interaction.user.id,
      discordTag: `${interaction.user.username}#${interaction.user.discriminator}`,
      mcName: username,
      registeredAt: new Date().toISOString()
    };
    data.users.push(entry);
    writeData(data);

    if (OWNER_ID) {
      try {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send(`🆕 Registration request:\nDiscord: ${entry.discordTag}\nMinecraft: ${entry.mcName}\nUser ID: ${entry.userId}`);
      } catch (err) {
        console.warn('❌ Failed notifying owner:', err);
      }
    }

    await interaction.reply(`🌱 Got it — I saved **${username}** and notified the server owner to grant you access.`);
  }

  // /removeme
  if (commandName === 'removeme') {
    const data = readData();
    const idx = data.users.findIndex(u => u.userId === interaction.user.id);
    if (idx === -1) return interaction.reply("I don't have a username for you on file.");
    const removed = data.users.splice(idx, 1)[0];
    writeData(data);

    if (OWNER_ID) {
      try {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send(`🗑️ Removed registration:\nDiscord: ${removed.discordTag}\nMinecraft: ${removed.mcName}`);
      } catch (err) {
        console.warn('Failed notifying owner about removal:', err);
      }
    }

    await interaction.reply(`🗑️ Removed your Minecraft username **${removed.mcName}** from my list.`);
  }

  // /listusers
  if (commandName === 'listusers') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ Only the server owner can use this.', ephemeral: true });
    }

    const data = readData();
    if (!data.users.length) return interaction.reply('No users registered yet.');
    const rows = data.users.map(u => `${u.discordTag} — ${u.mcName} (${u.registeredAt.split('T')[0]})`);
    const msg = rows.join('\n');
    await interaction.user.send(`📋 Registered Users:\n${msg}`);
    await interaction.reply('✅ I sent you a DM with all registered users!');
  }

  // /aternos
  if (commandName === 'aternos') {
    await interaction.reply({
      content: '🌐 Open your Aternos dashboard here:\nhttps://aternos.org/go/',
      ephemeral: true
    });
  }
});

// --- Friendly Chat Replies ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const lower = message.content.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) {
    const greetings = [
      `Hey ${message.author.username}! 👋 Type /tutorial to learn how to start and join the server.`,
      `Hiya ${message.author.username}! 🌼 You can see both tutorial videos with /tutorial.`,
      `Yo ${message.author.username}! Need help? Try /tutorial or /aternos.`
    ];
    await message.reply(greetings[Math.floor(Math.random() * greetings.length)]);
  }
});

// --- Login ---
client.login(TOKEN);
