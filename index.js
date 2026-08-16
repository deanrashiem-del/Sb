/**
 * ServerBlock — Professional Discord Moderation Bot
 * Flat structure, SQLite persistence, mobile-friendly.
 *
 * Required .env:
 *   TOKEN=your_bot_token
 *   CLIENT_ID=your_client_id
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./database');
const events = require('./events');

if (!config.token || !config.clientId) {
  console.error('❌ Missing required environment variables.');
  console.error('Create a .env file with:');
  console.error('  TOKEN=YOUR_BOT_TOKEN');
  console.error('  CLIENT_ID=YOUR_CLIENT_ID');
  process.exit(1);
}

// Initialize database (creates tables if needed)
db.init();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Register all event handlers
events.register(client);

// Global error handling so the bot never crashes from uncaught errors
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

client.login(config.token).catch((err) => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});
