const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('./database');
const permissions = require('./permissions');
const serverblock = require('./serverblock');
const messages = require('./messages');
const history = require('./history');
const setup = require('./setup');
const logger = require('./logger');
const { parseUser, resolveUser, formatTimestamp, isValidSnowflake, truncate } = require('./utils');
const config = require('./config');

// Cooldown map: key = `${userId}:${command}`
const cooldowns = new Map();

function checkCooldown(userId, command, ms = 3000) {
  const key = `${userId}:${command}`;
  const now = Date.now();
  const expires = cooldowns.get(key) || 0;
  if (now < expires) return Math.ceil((expires - now) / 1000);
  cooldowns.set(key, now + ms);
  return 0;
}

// ========== SLASH COMMAND DEFINITIONS ==========
const slashCommands = [
  new SlashCommandBuilder()
    .setName('serverblock')
    .setDescription('ServerBlock a user')
    .addUserOption(o => o.setName('user').setDescription('User to block').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sbinfo')
    .setDescription('View ServerBlock information for a user')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(false)),

  new SlashCommandBuilder()
    .setName('sbremove')
    .setDescription('Remove a ServerBlock')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Removal reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('sbaccept')
    .setDescription('Accept a ServerBlock appeal')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(false)),

  new SlashCommandBuilder()
    .setName('sbdeny')
    .setDescription('Deny a ServerBlock appeal')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Denial reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('sbhistory')
    .setDescription('View ServerBlock history')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(false))
    .addStringOption(o =>
      o.setName('filter')
        .setDescription('Filter for all history')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Active', value: 'active' },
          { name: 'Removed', value: 'removed' },
          { name: 'Accepted', value: 'accepted' },
          { name: 'Denied', value: 'denied' },
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('sbstats')
    .setDescription('View ServerBlock statistics'),

  new SlashCommandBuilder()
    .setName('sbstaff')
    .setDescription('View staff statistics')
    .addUserOption(o => o.setName('staff').setDescription('Staff member').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sbsearch')
    .setDescription('Search ServerBlock records by User ID')
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sbcase')
    .setDescription('View a specific case')
    .addStringOption(o => o.setName('caseid').setDescription('Case ID (e.g. SB-000001)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sbnote')
    .setDescription('Add a private staff note to a case')
    .addStringOption(o => o.setName('caseid').setDescription('Case ID').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note content').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sbreason')
    .setDescription('Edit the reason of a ServerBlock case')
    .addStringOption(o => o.setName('caseid').setDescription('Case ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('New reason').setRequired(true)),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open ServerBlock configuration panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('ServerBlock setup wizard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show ServerBlock help'),
];

// ========== PREFIX COMMAND HANDLER ==========
async function handlePrefix(message, client) {
  if (message.author.bot || !message.guild) return;

  const cfg = db.getGuildConfig(message.guild.id);
  const prefix = cfg.prefix || '?';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();

  const member = message.member;

  try {
    switch (cmd) {
      case 'sb':
      case 'serverblock':
        await cmdSb(message, args, client);
        break;
      case 'sbremove':
        await cmdSbRemove(message, args, client);
        break;
      case 'sbackcept':
      case 'sbaccept':
        await cmdSbAccept(message, args, client);
        break;
      case 'sbdeny':
        await cmdSbDeny(message, args, client);
        break;
      case 'sbinfo':
        await cmdSbInfo(message, args, client);
        break;
      case 'sbhistory':
        await cmdSbHistory(message, args, client);
        break;
      case 'sbsearch':
        await cmdSbSearch(message, args, client);
        break;
      case 'sbcase':
        await cmdSbCase(message, args, client);
        break;
      case 'sbnote':
        await cmdSbNote(message, args, client);
        break;
      case 'sbreason':
        await cmdSbReason(message, args, client);
        break;
      case 'sbstats':
        await cmdSbStats(message, client);
        break;
      case 'sbstaff':
        await cmdSbStaff(message, args, client);
        break;
      case 'help':
        await cmdHelp(message, member);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[Commands] Prefix error (${cmd}):`, err);
    try {
      await message.reply('❌ An unexpected error occurred while processing that command.');
    } catch {}
  }
}

// ========== COMMAND IMPLEMENTATIONS ==========

async function cmdSb(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = isSlash ? ctx.member : ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canUseSb(member)) {
    const msg = messages.renderMessage(guild.id, 'noPermission', {});
    return reply(ctx, msg);
  }

  const cd = checkCooldown(author.id, 'sb');
  if (cd) return reply(ctx, { content: `⏳ Please wait ${cd}s before using this again.` });

  let userId, reason;
  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user.id;
    reason = ctx.options.getString('reason');
  } else {
    if (args.length < 2) {
      return reply(ctx, messages.renderMessage(guild.id, 'missingReason', { prefix: db.getGuildConfig(guild.id).prefix }));
    }
    userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
    reason = args.slice(1).join(' ');
  }

  if (!userId) {
    return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));
  }

  const result = await serverblock.createSB(client, guild, author, userId, reason);

  if (!result.success) {
    if (result.message === 'already_blocked') {
      const m = messages.renderMessage(guild.id, 'alreadyBlocked', { case_id: result.caseId });
      return reply(ctx, m);
    }
    if (result.message === 'missing_reason') {
      return reply(ctx, messages.renderMessage(guild.id, 'missingReason', { prefix: db.getGuildConfig(guild.id).prefix }));
    }
    if (result.message === 'invalid_user') {
      return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));
    }
    return reply(ctx, { content: '❌ Failed to create ServerBlock.' });
  }

  // Customizable channel confirmation (text or embed via /config → Messages → SB Success)
  await reply(ctx, result.confirmation);

  if (result.failedRoles?.length) {
    for (const rid of result.failedRoles) {
      try {
        await ctx.channel.send(`⚠️ Could not assign <@&${rid}> (role hierarchy).`);
      } catch {}
    }
  }

  if (result.dmResult && !result.dmResult.success && result.dmResult.reason === 'dm_blocked') {
    try {
      const dmMsg = messages.renderMessage(guild.id, 'dmDisabled', {});
      await ctx.channel.send(dmMsg.content || dmMsg.embeds ? dmMsg : { content: '⚠️ Could not DM the user.' });
    } catch {}
  }
}

async function cmdSbRemove(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canUseSb(member)) {
    return reply(ctx, messages.renderMessage(guild.id, 'noPermission', {}));
  }

  const cd = checkCooldown(author.id, 'sbremove');
  if (cd) return reply(ctx, { content: `⏳ Please wait ${cd}s.` });

  let userId, reason;
  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user?.id || ctx.options.getString('userid');
    reason = ctx.options.getString('reason');
  } else {
    userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
    reason = args.slice(1).join(' ') || null;
  }

  if (!userId) return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));

  const result = await serverblock.removeSB(client, guild, author, userId, reason);
  if (!result.success) {
    return reply(ctx, messages.renderMessage(guild.id, 'noActiveSb', {}));
  }

  return reply(ctx, { content: `✅ ServerBlock removed for \`${userId}\` (Case: ${result.caseId}).` });
}

async function cmdSbAccept(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canAccept(member)) {
    return reply(ctx, messages.renderMessage(guild.id, 'noPermission', {}));
  }

  const cd = checkCooldown(author.id, 'sbaccept');
  if (cd) return reply(ctx, { content: `⏳ Please wait ${cd}s.` });

  let userId;
  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user?.id || ctx.options.getString('userid');
  } else {
    userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
  }

  if (!userId) return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));

  const result = await serverblock.acceptAppeal(client, guild, author, userId);
  if (!result.success) {
    return reply(ctx, messages.renderMessage(guild.id, 'noActiveSb', {}));
  }

  return reply(ctx, { content: `✅ Appeal accepted for \`${userId}\` (Case: ${result.caseId}).` });
}

async function cmdSbDeny(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canDeny(member)) {
    return reply(ctx, messages.renderMessage(guild.id, 'noPermission', {}));
  }

  const cd = checkCooldown(author.id, 'sbdeny');
  if (cd) return reply(ctx, { content: `⏳ Please wait ${cd}s.` });

  let userId, reason;
  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user?.id || ctx.options.getString('userid');
    reason = ctx.options.getString('reason');
  } else {
    userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
    reason = args.slice(1).join(' ') || null;
  }

  if (!userId) return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));

  const result = await serverblock.denyAppeal(client, guild, author, userId, reason);
  if (!result.success) {
    return reply(ctx, messages.renderMessage(guild.id, 'noActiveSb', {}));
  }

  return reply(ctx, { content: `❌ Appeal denied for \`${userId}\` (Case: ${result.caseId}).` });
}

async function cmdSbInfo(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;

  let userId;
  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user?.id || ctx.options.getString('userid');
  } else {
    userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
  }

  if (!userId) return reply(ctx, messages.renderMessage(guild.id, 'invalidUser', {}));

  const info = await serverblock.getSbInfo(client, guild, userId);
  const active = info.active;

  const embed = new EmbedBuilder()
    .setTitle('🔎 ServerBlock Info')
    .setColor(active ? 0xED4245 : 0x57F287)
    .addFields(
      { name: 'User', value: info.user ? `${info.user.tag} (<@${userId}>)` : `\`${userId}\``, inline: true },
      { name: 'User ID', value: userId, inline: true },
      { name: 'In Server', value: info.isInServer ? 'Yes' : 'No', inline: true },
    );

  if (active) {
    embed.addFields(
      { name: 'Status', value: '🚫 Active', inline: true },
      { name: 'Case ID', value: active.caseId, inline: true },
      { name: 'Reason', value: active.reason, inline: false },
      { name: 'Blocked By', value: `<@${active.blockedBy}>`, inline: true },
      { name: 'Date', value: formatTimestamp(active.blockedAt), inline: true },
      { name: 'Appeal Status', value: active.appealStatus, inline: true },
    );
    if (active.rolesGiven?.length) {
      embed.addFields({ name: 'Roles Given', value: active.rolesGiven.map(r => `<@&${r}>`).join(', '), inline: false });
    }
  } else {
    embed.addFields({ name: 'Status', value: 'No active ServerBlock', inline: false });
    if (info.history.length) {
      embed.addFields({ name: 'Past Records', value: `${info.history.length} previous case(s)`, inline: false });
    }
  }

  embed.setTimestamp();
  return reply(ctx, { embeds: [embed] });
}

async function cmdSbHistory(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;

  let userId = null;
  let filter = null;

  if (isSlash) {
    const user = ctx.options.getUser('user');
    userId = user?.id || ctx.options.getString('userid');
    filter = ctx.options.getString('filter');
    if (filter === 'all') filter = null;
  } else {
    if (args[0] === 'all') {
      filter = args[1] || null;
    } else {
      userId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
    }
  }

  if (userId) {
    const result = history.buildUserHistoryEmbed(guild, userId, 0);
    return reply(ctx, result);
  }

  // Guild history
  const result = history.buildGuildHistoryEmbed(guild, filter, 0);
  return reply(ctx, result);
}

async function cmdSbSearch(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const userId = isSlash ? ctx.options.getString('userid') : (args[0] || null);

  if (!userId || !isValidSnowflake(userId)) {
    return reply(ctx, { content: '❌ Provide a valid User ID.' });
  }

  const result = history.buildUserHistoryEmbed(guild, userId, 0);
  return reply(ctx, result);
}

async function cmdSbCase(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const caseId = isSlash ? ctx.options.getString('caseid') : (args[0] || null);

  if (!caseId) return reply(ctx, { content: '❌ Provide a case ID (e.g. SB-000001).' });

  const timeline = history.buildCaseTimeline(caseId.toUpperCase());
  if (!timeline) return reply(ctx, { content: '❌ Case not found.' });

  const embed = new EmbedBuilder()
    .setTitle(`📂 Case ${caseId.toUpperCase()}`)
    .setDescription(truncate(timeline, 4000))
    .setColor(0x5865F2)
    .setTimestamp();

  return reply(ctx, { embeds: [embed] });
}

async function cmdSbNote(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canViewNotes(member)) {
    return reply(ctx, messages.renderMessage(guild.id, 'noPermission', {}));
  }

  let caseId, note;
  if (isSlash) {
    caseId = ctx.options.getString('caseid');
    note = ctx.options.getString('note');
  } else {
    caseId = args[0];
    note = args.slice(1).join(' ');
  }

  if (!caseId || !note) {
    return reply(ctx, { content: '❌ Usage: `?sbnote SB-000001 your note here`' });
  }

  const sb = db.getServerBlockByCase(caseId.toUpperCase());
  if (!sb || sb.guildId !== guild.id) {
    return reply(ctx, { content: '❌ Case not found in this server.' });
  }

  db.addNote({ guildId: guild.id, caseId: sb.caseId, staffId: author.id, note });
  db.addHistory({
    guildId: guild.id,
    userId: sb.userId,
    caseId: sb.caseId,
    action: 'note_added',
    staffId: author.id,
    reason: note.slice(0, 200),
  });

  return reply(ctx, { content: `📝 Note added to **${sb.caseId}**.` });
}

async function cmdSbReason(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;
  const member = ctx.member;
  const author = isSlash ? ctx.user : ctx.author;

  if (!permissions.canUseSb(member)) {
    return reply(ctx, messages.renderMessage(guild.id, 'noPermission', {}));
  }

  let caseId, newReason;
  if (isSlash) {
    caseId = ctx.options.getString('caseid');
    newReason = ctx.options.getString('reason');
  } else {
    caseId = args[0];
    newReason = args.slice(1).join(' ');
  }

  if (!caseId || !newReason) {
    return reply(ctx, { content: '❌ Usage: `?sbreason SB-000001 New reason`' });
  }

  const sb = db.getServerBlockByCase(caseId.toUpperCase());
  if (!sb || sb.guildId !== guild.id) {
    return reply(ctx, { content: '❌ Case not found.' });
  }

  const oldReason = sb.reason;
  db.updateReason(sb.caseId, newReason);
  db.addHistory({
    guildId: guild.id,
    userId: sb.userId,
    caseId: sb.caseId,
    action: 'reason_edited',
    staffId: author.id,
    reason: `Old: ${oldReason} → New: ${newReason}`,
    metadata: { oldReason, newReason },
  });

  return reply(ctx, { content: `✏️ Reason for **${sb.caseId}** updated.` });
}

async function cmdSbStats(ctx, client) {
  const guild = ctx.guild;
  const stats = db.getGuildStats(guild.id);
  const topReasons = db.getTopReasons(guild.id, 5);

  const embed = new EmbedBuilder()
    .setTitle('📊 ServerBlock Statistics')
    .setColor(0x5865F2)
    .addFields(
      { name: 'Total', value: String(stats.total), inline: true },
      { name: 'Active', value: String(stats.active), inline: true },
      { name: 'Removed', value: String(stats.removed), inline: true },
      { name: 'Appeals', value: String(stats.appeals), inline: true },
      { name: 'Accepted', value: String(stats.accepted), inline: true },
      { name: 'Denied', value: String(stats.denied), inline: true },
      { name: 'This Week', value: String(stats.thisWeek), inline: true },
      { name: 'This Month', value: String(stats.thisMonth), inline: true },
    );

  if (topReasons.length) {
    const reasonText = topReasons.map(r => `**${r.reason}** — ${r.count}`).join('\n');
    embed.addFields({ name: '📊 Top Reasons', value: reasonText, inline: false });
  }

  embed.setTimestamp();
  return reply(ctx, { embeds: [embed] });
}

async function cmdSbStaff(ctx, args, client) {
  const isSlash = !!ctx.isChatInputCommand;
  const guild = ctx.guild;

  let staffId;
  if (isSlash) {
    staffId = ctx.options.getUser('staff')?.id;
  } else {
    staffId = parseUser(args[0]) || (isValidSnowflake(args[0]) ? args[0] : null);
  }

  if (!staffId) return reply(ctx, { content: '❌ Provide a staff member.' });

  const stats = db.getStaffStats(guild.id, staffId);
  const embed = new EmbedBuilder()
    .setTitle('👮 Staff Statistics')
    .setDescription(`Staff: <@${staffId}>`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'SBs Issued', value: String(stats.issued), inline: true },
      { name: 'SBs Removed', value: String(stats.removed), inline: true },
      { name: 'Appeals Accepted', value: String(stats.accepted), inline: true },
      { name: 'Appeals Denied', value: String(stats.denied), inline: true },
    );

  if (stats.recent.length) {
    const recentText = stats.recent
      .slice(0, 5)
      .map(h => `• ${h.action} — ${formatTimestamp(h.timestamp)}`)
      .join('\n');
    embed.addFields({ name: 'Recent Actions', value: recentText, inline: false });
  }

  embed.setTimestamp();
  return reply(ctx, { embeds: [embed] });
}

async function cmdHelp(ctx, member) {
  const isAdmin = permissions.canConfigure(member);
  const embed = new EmbedBuilder()
    .setTitle('🛡️ ServerBlock Help')
    .setColor(0x5865F2)
    .addFields(
      {
        name: '🛡️ ServerBlock',
        value: '`?sb @user reason` / `/serverblock`\n`?sbremove @user`\n`?sbackcept @user`\n`?sbdeny @user [reason]`',
        inline: false,
      },
      {
        name: '📋 History & Info',
        value: '`?sbinfo @user`\n`?sbhistory @user`\n`?sbhistory all [filter]`\n`?sbsearch USER_ID`\n`?sbcase SB-000001`',
        inline: false,
      },
      {
        name: '📊 Statistics',
        value: '`?sbstats`\n`?sbstaff @staff`',
        inline: false,
      },
      {
        name: '📝 Notes & Edit',
        value: '`?sbnote SB-000001 note`\n`?sbreason SB-000001 new reason`',
        inline: false,
      },
    );

  if (isAdmin) {
    embed.addFields({
      name: '⚙️ Configuration',
      value: '`/setup` — Setup wizard\n`/config` — Full configuration panel',
      inline: false,
    });
  }

  embed.setFooter({ text: 'Prefix commands use the configured prefix (default ?). Slash commands always work.' });
  return reply(ctx, { embeds: [embed] });
}

// ========== SLASH DISPATCHER ==========
async function handleSlash(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'serverblock':
        await cmdSb(interaction, [], client);
        break;
      case 'sbremove':
        await cmdSbRemove(interaction, [], client);
        break;
      case 'sbaccept':
        await cmdSbAccept(interaction, [], client);
        break;
      case 'sbdeny':
        await cmdSbDeny(interaction, [], client);
        break;
      case 'sbinfo':
        await cmdSbInfo(interaction, [], client);
        break;
      case 'sbhistory':
        await cmdSbHistory(interaction, [], client);
        break;
      case 'sbsearch':
        await cmdSbSearch(interaction, [], client);
        break;
      case 'sbcase':
        await cmdSbCase(interaction, [], client);
        break;
      case 'sbnote':
        await cmdSbNote(interaction, [], client);
        break;
      case 'sbreason':
        await cmdSbReason(interaction, [], client);
        break;
      case 'sbstats':
        await cmdSbStats(interaction, client);
        break;
      case 'sbstaff':
        await cmdSbStaff(interaction, [], client);
        break;
      case 'config':
        if (!permissions.canConfigure(interaction.member)) {
          return interaction.reply({ content: '❌ You do not have permission to configure ServerBlock.', ephemeral: true });
        }
        await interaction.reply({ ...setup.buildConfigPanel(interaction.guild), ephemeral: true });
        break;
      case 'setup':
        if (!permissions.canConfigure(interaction.member)) {
          return interaction.reply({ content: '❌ You do not have permission to run setup.', ephemeral: true });
        }
        await interaction.reply({
          embeds: [setup.buildSetupEmbed(interaction.guild)],
          components: setup.buildSetupComponents(),
          ephemeral: true,
        });
        break;
      case 'help':
        await cmdHelp(interaction, interaction.member);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(`[Commands] Slash error (${commandName}):`, err);
    const payload = { content: '❌ An unexpected error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

// Helper to reply to both message and interaction
async function reply(ctx, payload) {
  if (ctx.isChatInputCommand || ctx.isButton || ctx.isAnySelectMenu || ctx.isModalSubmit) {
    if (ctx.replied || ctx.deferred) {
      return ctx.followUp({ ...payload, ephemeral: payload.ephemeral !== false });
    }
    return ctx.reply({ ...payload, ephemeral: payload.ephemeral !== false });
  }
  // Message
  return ctx.reply(payload);
}

module.exports = {
  slashCommands,
  handlePrefix,
  handleSlash,
  checkCooldown,
};
