const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { formatTimestamp } = require('./utils');

async function getLogChannel(guild) {
  const config = db.getGuildConfig(guild.id);
  if (!config.logChannelId || !config.logActions) return null;
  try {
    const channel = await guild.channels.fetch(config.logChannelId);
    if (channel && channel.isTextBased()) return channel;
  } catch {
    return null;
  }
  return null;
}

async function logSbCreated(guild, { user, caseId, reason, moderator, rolesGiven }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🚫 ServerBlock Created')
    .setColor(0xED4245)
    .addFields(
      { name: 'User', value: user ? `<@${user.id}>` : 'Unknown', inline: true },
      { name: 'User ID', value: user ? user.id : 'Unknown', inline: true },
      { name: 'Case', value: caseId, inline: true },
      { name: 'Reason', value: reason || 'No reason', inline: false },
      { name: 'Blocked By', value: moderator ? `<@${moderator.id}>` : 'Unknown', inline: true },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
      { name: 'Status', value: 'Active', inline: true },
      { name: 'Roles Given', value: rolesGiven?.length ? rolesGiven.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send SB created log:', e.message);
  }
}

async function logSbRemoved(guild, { user, caseId, moderator, reason }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('✅ ServerBlock Removed')
    .setColor(0x57F287)
    .addFields(
      { name: 'User', value: user ? `<@${user.id}>` : 'Unknown', inline: true },
      { name: 'User ID', value: user ? user.id : 'Unknown', inline: true },
      { name: 'Case', value: caseId, inline: true },
      { name: 'Removed By', value: moderator ? `<@${moderator.id}>` : 'Unknown', inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send SB removed log:', e.message);
  }
}

async function logAppealAccepted(guild, { user, caseId, moderator }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('✅ Appeal Accepted')
    .setColor(0x57F287)
    .addFields(
      { name: 'User', value: user ? `<@${user.id}>` : 'Unknown', inline: true },
      { name: 'User ID', value: user ? user.id : 'Unknown', inline: true },
      { name: 'Case', value: caseId, inline: true },
      { name: 'Reviewed By', value: moderator ? `<@${moderator.id}>` : 'Unknown', inline: true },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send appeal accepted log:', e.message);
  }
}

async function logAppealDenied(guild, { user, caseId, moderator, reason }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('❌ Appeal Denied')
    .setColor(0xED4245)
    .addFields(
      { name: 'User', value: user ? `<@${user.id}>` : 'Unknown', inline: true },
      { name: 'User ID', value: user ? user.id : 'Unknown', inline: true },
      { name: 'Case', value: caseId, inline: true },
      { name: 'Reviewed By', value: moderator ? `<@${moderator.id}>` : 'Unknown', inline: true },
      { name: 'Denial Reason', value: reason || 'No reason provided', inline: false },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send appeal denied log:', e.message);
  }
}

async function logRolesRestored(guild, { userId, rolesCount }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔄 ServerBlock Roles Restored')
    .setColor(0xFEE75C)
    .addFields(
      { name: 'User ID', value: userId, inline: true },
      { name: 'Roles Restored', value: String(rolesCount), inline: true },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send roles restored log:', e.message);
  }
}

async function logConfigChange(guild, { changedBy, setting, oldValue, newValue }) {
  const channel = await getLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Configuration Changed')
    .setColor(0x5865F2)
    .addFields(
      { name: 'Changed By', value: `<@${changedBy}>`, inline: true },
      { name: 'Setting', value: setting, inline: true },
      { name: 'Previous Value', value: String(oldValue ?? 'N/A').slice(0, 1024) || 'N/A', inline: false },
      { name: 'New Value', value: String(newValue ?? 'N/A').slice(0, 1024) || 'N/A', inline: false },
      { name: 'Timestamp', value: formatTimestamp(new Date().toISOString()), inline: true },
    )
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Logger] Failed to send config change log:', e.message);
  }
}

async function logError(guild, message) {
  const channel = await getLogChannel(guild);
  if (!channel) return;
  try {
    await channel.send(`⚠️ **Error:** ${message}`);
  } catch {}
}

module.exports = {
  getLogChannel,
  logSbCreated,
  logSbRemoved,
  logAppealAccepted,
  logAppealDenied,
  logRolesRestored,
  logConfigChange,
  logError,
};
