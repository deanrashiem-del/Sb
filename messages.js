const config = require('./config');
const db = require('./database');
const { buildEmbedFromConfig, getMessage, replaceVariables } = require('./utils');
const { EmbedBuilder } = require('discord.js');

function getVars({ user, moderator, guild, reason, caseId, status, appealLink }) {
  const now = new Date();
  return {
    user: user ? (user.username || user.tag || user.id) : 'Unknown',
    username: user ? (user.username || 'Unknown') : 'Unknown',
    userid: user ? user.id : '',
    mention: user ? `<@${user.id}>` : '',
    reason: reason || 'No reason provided',
    moderator: moderator ? (moderator.username || moderator.tag || moderator.id) : 'Unknown',
    moderator_id: moderator ? moderator.id : '',
    server: guild ? guild.name : 'Unknown Server',
    server_id: guild ? guild.id : '',
    case_id: caseId || '',
    date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    appeal_link: appealLink || '',
    server_link: guild ? `https://discord.gg/` : '',
    status: status || '',
    prefix: '?',
  };
}

function getGuildMessage(guildId, key) {
  const gConfig = db.getGuildConfig(guildId);
  return getMessage(gConfig, key, config.defaultMessages);
}

function renderMessage(guildId, key, vars = {}) {
  const msgConfig = getGuildMessage(guildId, key);
  if (!msgConfig) return { content: 'Message not configured.' };
  return buildEmbedFromConfig(msgConfig, vars);
}

async function sendDm(user, guildId, key, vars = {}) {
  const gConfig = db.getGuildConfig(guildId);
  if (!gConfig.dmUsers) return { success: false, reason: 'dms_disabled_in_config' };

  try {
    const payload = renderMessage(guildId, key, vars);
    await user.send(payload);
    return { success: true };
  } catch (err) {
    return { success: false, reason: 'dm_blocked', error: err.message };
  }
}

function fixedSbConfirmation(userId, isInServer) {
  if (isInServer) {
    return `✔️ <@${userId}> was successfully serverblocked.`;
  }
  return `✔️ ${userId} was successfully serverblocked.`;
}

module.exports = {
  getVars,
  getGuildMessage,
  renderMessage,
  sendDm,
  fixedSbConfirmation,
};
