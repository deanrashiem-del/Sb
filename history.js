const db = require('./database');
const { EmbedBuilder } = require('discord.js');
const { formatTimestamp, splitIntoPages } = require('./utils');

function buildCaseTimeline(caseId) {
  const sb = db.getServerBlockByCase(caseId);
  if (!sb) return null;

  const history = db.getHistoryByCase(caseId);
  const notes = db.getNotes(caseId);

  const lines = [];
  lines.push(`**Case:** \`${sb.caseId}\``);
  lines.push(`**User ID:** \`${sb.userId}\``);
  lines.push(`**Status:** ${sb.active ? '🚫 Active' : '✅ Inactive'}`);
  lines.push(`**Appeal Status:** ${sb.appealStatus}`);
  lines.push('');
  lines.push('**Timeline:**');

  for (const h of history) {
    let icon = '•';
    if (h.action === 'serverblocked') icon = '🚫';
    else if (h.action === 'removed') icon = '✅';
    else if (h.action === 'appeal_accepted') icon = '✅';
    else if (h.action === 'appeal_denied') icon = '❌';
    else if (h.action === 'roles_restored') icon = '🔄';
    else if (h.action === 'reason_edited') icon = '✏️';
    else if (h.action === 'note_added') icon = '📝';

    lines.push(`${icon} **${h.action.replace(/_/g, ' ').toUpperCase()}** — ${formatTimestamp(h.timestamp)}`);
    if (h.reason) lines.push(`   Reason: ${h.reason}`);
    if (h.staffId) lines.push(`   Staff: <@${h.staffId}>`);
  }

  if (notes.length) {
    lines.push('');
    lines.push('**Staff Notes:**');
    for (const n of notes) {
      lines.push(`📝 <@${n.staffId}> — ${formatTimestamp(n.timestamp)}`);
      lines.push(`   ${n.note}`);
    }
  }

  return lines.join('\n');
}

function buildUserHistoryEmbed(guild, userId, page = 0) {
  const blocks = db.getServerBlocksByUser(guild.id, userId);
  if (!blocks.length) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('📋 ServerBlock History')
          .setDescription('No ServerBlock records found for this user.')
          .setColor(0x5865F2),
      ],
    };
  }

  const lines = [];
  for (const sb of blocks) {
    lines.push(`**${sb.caseId}** — ${sb.active ? '🚫 Active' : '✅ Inactive'}`);
    lines.push(`Reason: ${sb.reason}`);
    lines.push(`By: <@${sb.blockedBy}> on ${formatTimestamp(sb.blockedAt)}`);
    if (sb.appealStatus !== 'none') {
      lines.push(`Appeal: ${sb.appealStatus}`);
    }
    lines.push('');
  }

  const pages = splitIntoPages(lines, 12);
  const current = Math.max(0, Math.min(page, pages.length - 1));

  const embed = new EmbedBuilder()
    .setTitle('📋 ServerBlock History')
    .setDescription(pages[current])
    .setFooter({ text: `Page ${current + 1}/${pages.length} • User ID: ${userId}` })
    .setColor(0x5865F2)
    .setTimestamp();

  return { embeds: [embed], page: current, totalPages: pages.length };
}

function buildGuildHistoryEmbed(guild, filter, page = 0) {
  const blocks = db.getAllServerBlocks(guild.id, filter);
  if (!blocks.length) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('📋 Server History')
          .setDescription(`No records found${filter ? ` for filter: ${filter}` : ''}.`)
          .setColor(0x5865F2),
      ],
    };
  }

  const lines = [];
  for (const sb of blocks) {
    lines.push(`**${sb.caseId}** <@${sb.userId}> — ${sb.active ? 'Active' : 'Inactive'}`);
    lines.push(`${sb.reason.slice(0, 80)}${sb.reason.length > 80 ? '...' : ''}`);
    lines.push(`By <@${sb.blockedBy}> • ${formatTimestamp(sb.blockedAt)}`);
    lines.push('');
  }

  const pages = splitIntoPages(lines, 10);
  const current = Math.max(0, Math.min(page, pages.length - 1));

  const embed = new EmbedBuilder()
    .setTitle(`📋 Server History${filter ? ` (${filter})` : ''}`)
    .setDescription(pages[current])
    .setFooter({ text: `Page ${current + 1}/${pages.length} • Total: ${blocks.length}` })
    .setColor(0x5865F2)
    .setTimestamp();

  return { embeds: [embed], page: current, totalPages: pages.length };
}

module.exports = {
  buildCaseTimeline,
  buildUserHistoryEmbed,
  buildGuildHistoryEmbed,
};
