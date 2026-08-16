const config = require('./config');
const db = require('./database');
const { buildEmbedFromConfig, getMessage, replaceVariables } = require('./utils');

function getVars({ user, userId, moderator, guild, reason, caseId, status, appealLink, isInServer }) {
  const now = new Date();
  const id = user?.id || userId || '';
  const username = user?.username || user?.tag || id || 'Unknown';
  // Prefer mention when we know they're in the server or we have a full user object
  const mention = id
    ? (isInServer || user ? `<@${id}>` : id)
    : 'Unknown';

  return {
    user: username,
    username,
    userid: id,
    mention,
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

/**
 * Build the channel success confirmation for a ServerBlock.
 * Fully customizable via /config → Messages → SB Success.
 * Supports text or embed and all standard variables.
 */
function renderSbSuccess(guildId, vars = {}) {
  return renderMessage(guildId, 'sbSuccess', vars);
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

module.exports = {
  getVars,
  getGuildMessage,
  renderMessage,
  renderSbSuccess,
  sendDm,
};
