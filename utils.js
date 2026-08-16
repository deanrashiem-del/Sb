const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function parseUser(input, messageOrInteraction) {
  if (!input) return null;

  // Mention
  const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) return mentionMatch[1];

  // Raw ID
  if (/^\d{17,20}$/.test(input)) return input;

  // Username search (fallback - limited)
  return null;
}

async function resolveUser(client, userId) {
  try {
    return await client.users.fetch(userId);
  } catch {
    return null;
  }
}

async function resolveMember(guild, userId) {
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

function formatTimestamp(iso) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function replaceVariables(text, vars) {
  if (!text) return text;
  let result = String(text);
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

function buildEmbedFromConfig(msgConfig, vars = {}) {
  if (!msgConfig) return null;

  if (msgConfig.type === 'text') {
    return { content: replaceVariables(msgConfig.content || '', vars) };
  }

  const embed = new EmbedBuilder();
  if (msgConfig.title) embed.setTitle(replaceVariables(msgConfig.title, vars));
  if (msgConfig.description) embed.setDescription(replaceVariables(msgConfig.description, vars));
  if (msgConfig.color !== undefined) embed.setColor(msgConfig.color);
  if (msgConfig.footer) embed.setFooter({ text: replaceVariables(msgConfig.footer, vars) });
  if (msgConfig.author) embed.setAuthor({ name: replaceVariables(msgConfig.author, vars) });
  if (msgConfig.thumbnail) embed.setThumbnail(msgConfig.thumbnail);
  if (msgConfig.image) embed.setImage(msgConfig.image);
  if (msgConfig.timestamp) embed.setTimestamp();

  return { embeds: [embed] };
}

function getMessage(guildConfig, key, defaults) {
  if (guildConfig.customMessages && guildConfig.customMessages[key]) {
    return guildConfig.customMessages[key];
  }
  return defaults[key] || null;
}

function createPagination(pages, currentPage = 0) {
  const total = pages.length;
  const page = Math.max(0, Math.min(currentPage, total - 1));
  return {
    content: pages[page],
    components: total > 1 ? [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`page_prev_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`page_info`)
          .setLabel(`${page + 1} / ${total}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`page_next_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= total - 1),
      ),
    ] : [],
  };
}

function splitIntoPages(lines, maxLines = 15) {
  const pages = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    pages.push(lines.slice(i, i + maxLines).join('\n'));
  }
  return pages.length ? pages : ['No entries.'];
}

function isValidSnowflake(id) {
  return /^\d{17,20}$/.test(String(id));
}

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function truncate(str, max = 1000) {
  if (!str) return '';
  str = String(str);
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function formatRoles(roleIds, guild) {
  if (!roleIds || !roleIds.length) return 'None';
  return roleIds.map(id => {
    const role = guild.roles.cache.get(id);
    return role ? `<@&${id}>` : `\`${id}\``;
  }).join(', ');
}

module.exports = {
  parseUser,
  resolveUser,
  resolveMember,
  formatTimestamp,
  replaceVariables,
  buildEmbedFromConfig,
  getMessage,
  createPagination,
  splitIntoPages,
  isValidSnowflake,
  safeJsonParse,
  truncate,
  formatRoles,
};
