const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const db = require('./database');
const logger = require('./logger');
const { formatRoles } = require('./utils');
const config = require('./config');

function setupStatus(guild) {
  const cfg = db.getGuildConfig(guild.id);
  return {
    sbRoles: cfg.sbRoles.length > 0,
    sbStaff: cfg.sbStaffRoles.length > 0,
    accept: cfg.acceptRoles.length > 0,
    deny: cfg.denyRoles.length > 0,
    logChannel: !!cfg.logChannelId,
    messages: true, // defaults always loaded
    appeals: !!(cfg.appealUrl || cfg.appealChannelId),
  };
}

function isFullyConfigured(status) {
  return status.sbRoles && status.sbStaff && status.logChannel;
}

function buildSetupEmbed(guild) {
  const status = setupStatus(guild);
  const cfg = db.getGuildConfig(guild.id);

  const check = (ok) => (ok ? '✅' : '⚠️ Not Configured');

  const embed = new EmbedBuilder()
    .setTitle('🛡️ ServerBlock Setup')
    .setDescription('Configure your ServerBlock system. Click the buttons below to set each item.')
    .addFields(
      { name: '🎭 SB Roles', value: check(status.sbRoles) + (status.sbRoles ? `\n${formatRoles(cfg.sbRoles, guild)}` : ''), inline: true },
      { name: '🛡️ SB Staff', value: check(status.sbStaff) + (status.sbStaff ? `\n${formatRoles(cfg.sbStaffRoles, guild)}` : ''), inline: true },
      { name: '✅ Accept Staff', value: check(status.accept) + (status.accept ? `\n${formatRoles(cfg.acceptRoles, guild)}` : ''), inline: true },
      { name: '❌ Deny Staff', value: check(status.deny) + (status.deny ? `\n${formatRoles(cfg.denyRoles, guild)}` : ''), inline: true },
      { name: '📋 Log Channel', value: check(status.logChannel) + (status.logChannel ? `\n<#${cfg.logChannelId}>` : ''), inline: true },
      { name: '💬 Messages', value: '✅ Defaults Loaded', inline: true },
      { name: '🔗 Appeals', value: check(status.appeals), inline: true },
      {
        name: 'System',
        value: isFullyConfigured(status) ? '🟢 Ready' : '🟡 Setup Required',
        inline: false,
      },
    )
    .setColor(isFullyConfigured(status) ? 0x57F287 : 0xFEE75C)
    .setFooter({ text: 'Use the buttons below to configure' })
    .setTimestamp();

  return embed;
}

function buildSetupComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_sb_roles').setLabel('SB Roles').setEmoji('🎭').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_sb_staff').setLabel('SB Staff').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_accept').setLabel('Accept Staff').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup_deny').setLabel('Deny Staff').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_log').setLabel('Log Channel').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_create_log').setLabel('Create Log Channel').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_messages').setLabel('Messages').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_appeals').setLabel('Appeals').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_quick').setLabel('Quick Setup').setEmoji('⚡').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup_checker').setLabel('Check Setup').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_config').setLabel('Full Config').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2, row3];
}

function buildConfigPanel(guild) {
  const cfg = db.getGuildConfig(guild.id);
  const status = setupStatus(guild);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ ServerBlock Configuration')
    .setDescription('Configure your entire ServerBlock system below.')
    .addFields(
      { name: '🎭 SB Roles', value: cfg.sbRoles.length ? formatRoles(cfg.sbRoles, guild) : 'None', inline: true },
      { name: '🛡️ SB Staff', value: cfg.sbStaffRoles.length ? formatRoles(cfg.sbStaffRoles, guild) : 'None', inline: true },
      { name: '✅ Accept Staff', value: cfg.acceptRoles.length ? formatRoles(cfg.acceptRoles, guild) : 'None', inline: true },
      { name: '❌ Deny Staff', value: cfg.denyRoles.length ? formatRoles(cfg.denyRoles, guild) : 'None', inline: true },
      { name: '📋 Log Channel', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'None', inline: true },
      { name: 'Prefix', value: `\`${cfg.prefix}\``, inline: true },
      { name: 'Appeals Enabled', value: cfg.appealsEnabled ? 'Yes' : 'No', inline: true },
      { name: 'Permission Bypass', value: cfg.permissionBypass ? 'Yes' : 'No', inline: true },
      { name: 'DM Users', value: cfg.dmUsers ? 'Yes' : 'No', inline: true },
      { name: 'Restore Roles', value: cfg.restoreRoles ? 'Yes' : 'No', inline: true },
    )
    .setColor(0x5865F2)
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg_sb_roles').setLabel('SB Roles').setEmoji('🎭').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cfg_sb_staff').setLabel('SB Staff').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cfg_accept').setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('cfg_deny').setLabel('Deny').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg_log').setLabel('Log Channel').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg_messages').setLabel('Messages').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg_appeals').setLabel('Appeals').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg_general').setLabel('General').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg_export').setLabel('Export Config').setEmoji('💾').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg_reset').setLabel('Reset Config').setEmoji('🔄').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cfg_checker').setLabel('Check Setup').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function buildRoleSelect(customId, placeholder, min = 0, max = 25) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(min)
      .setMaxValues(max),
  );
}

function buildChannelSelect(customId, placeholder) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1),
  );
}

async function handleQuickSetup(interaction) {
  const guild = interaction.guild;
  const cfg = db.getGuildConfig(guild.id);

  // Create SB role if none
  let sbRoleId = cfg.sbRoles[0];
  if (!sbRoleId) {
    try {
      const role = await guild.roles.create({
        name: '🚫 Server Blocked',
        color: 0xED4245,
        reason: 'ServerBlock Quick Setup',
        permissions: [],
      });
      sbRoleId = role.id;
      db.updateGuildConfig(guild.id, { sbRoles: [sbRoleId] });
      db.addConfigAudit({
        guildId: guild.id,
        changedBy: interaction.user.id,
        setting: 'sb_roles',
        oldValue: '[]',
        newValue: JSON.stringify([sbRoleId]),
      });
    } catch (e) {
      return interaction.reply({ content: `❌ Failed to create SB role: ${e.message}`, ephemeral: true });
    }
  }

  // Create log channel if none
  let logId = cfg.logChannelId;
  if (!logId) {
    try {
      const ch = await guild.channels.create({
        name: 'serverblock-logs',
        type: ChannelType.GuildText,
        topic: 'ServerBlock system logs',
        reason: 'ServerBlock Quick Setup',
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks'] },
        ],
      });
      logId = ch.id;
      db.updateGuildConfig(guild.id, { logChannelId: logId });
      db.addConfigAudit({
        guildId: guild.id,
        changedBy: interaction.user.id,
        setting: 'log_channel',
        oldValue: 'none',
        newValue: logId,
      });
    } catch (e) {
      // Continue even if channel creation fails
      console.error('Quick setup log channel failed:', e.message);
    }
  }

  // Add owner / invoker as SB staff if none
  if (cfg.sbStaffRoles.length === 0) {
    // We can't create a role for staff easily without knowing hierarchy; instead note that owner has bypass
    // Optionally create a staff role
    try {
      const staffRole = await guild.roles.create({
        name: '🛡️ ServerBlock Staff',
        color: 0x5865F2,
        reason: 'ServerBlock Quick Setup',
        permissions: [],
      });
      // Give to invoker if possible
      try {
        await interaction.member.roles.add(staffRole.id);
      } catch {}
      db.updateGuildConfig(guild.id, { sbStaffRoles: [staffRole.id] });
      db.addConfigAudit({
        guildId: guild.id,
        changedBy: interaction.user.id,
        setting: 'sb_staff_roles',
        oldValue: '[]',
        newValue: JSON.stringify([staffRole.id]),
      });
    } catch (e) {
      console.error('Quick setup staff role failed:', e.message);
    }
  }

  await interaction.reply({
    content: '⚡ **Quick Setup complete!**\n- SB Role created/configured\n- Log channel created (if possible)\n- Staff role created\n\nOpening configuration panel...',
    ephemeral: true,
  });

  // Follow up with config panel
  const panel = buildConfigPanel(guild);
  await interaction.followUp({ ...panel, ephemeral: true });
}

function buildCheckerEmbed(guild) {
  const cfg = db.getGuildConfig(guild.id);
  const botMember = guild.members.me;
  const issues = [];
  const ok = [];

  // Bot permissions
  const needed = ['ManageRoles', 'SendMessages', 'EmbedLinks', 'ViewChannel'];
  for (const p of needed) {
    if (botMember.permissions.has(p)) ok.push(`Bot has \`${p}\``);
    else issues.push(`Bot missing \`${p}\``);
  }

  // Role hierarchy
  const botPos = botMember.roles.highest.position;
  for (const rid of cfg.sbRoles) {
    const role = guild.roles.cache.get(rid);
    if (role && role.position >= botPos) {
      issues.push(`SB role <@&${rid}> is above or equal to bot's highest role`);
    } else if (role) {
      ok.push(`Can assign <@&${rid}>`);
    }
  }

  if (cfg.sbRoles.length === 0) issues.push('No SB roles configured');
  else ok.push(`${cfg.sbRoles.length} SB role(s) set`);

  if (cfg.sbStaffRoles.length === 0) issues.push('No SB staff roles configured');
  else ok.push(`${cfg.sbStaffRoles.length} SB staff role(s) set`);

  if (!cfg.logChannelId) issues.push('No log channel set');
  else ok.push(`Log channel: <#${cfg.logChannelId}>`);

  const embed = new EmbedBuilder()
    .setTitle('🔍 Setup Checker')
    .setColor(issues.length ? 0xED4245 : 0x57F287)
    .addFields(
      { name: '✔️ Ready', value: ok.length ? ok.join('\n') : 'None', inline: false },
      { name: '❌ Needs Attention', value: issues.length ? issues.join('\n') : 'None — looking good!', inline: false },
    )
    .setTimestamp();

  return embed;
}

function buildMessagesMenu() {
  const options = [
    { label: 'SB DM', value: 'sbDm', description: 'DM sent when a user is serverblocked' },
    { label: 'Already Blocked', value: 'alreadyBlocked' },
    { label: 'Missing Reason', value: 'missingReason' },
    { label: 'No Permission', value: 'noPermission' },
    { label: 'Invalid User', value: 'invalidUser' },
    { label: 'DMs Disabled', value: 'dmDisabled' },
    { label: 'SB Removed', value: 'sbRemoved' },
    { label: 'Appeal Accepted', value: 'appealAccepted' },
    { label: 'Appeal Denied', value: 'appealDenied' },
    { label: 'Appeal Instructions', value: 'appealInstructions' },
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('msg_select')
      .setPlaceholder('Select a message to edit')
      .addOptions(options),
  );
}

function buildMessageEditorModal(key) {
  const modal = new ModalBuilder()
    .setCustomId(`msg_edit_${key}`)
    .setTitle(`Edit: ${key}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('msg_type')
        .setLabel('Type (text or embed)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('embed')
        .setMaxLength(10),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('msg_title')
        .setLabel('Embed Title (if embed)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('msg_description')
        .setLabel('Content / Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('msg_footer')
        .setLabel('Footer (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('msg_color')
        .setLabel('Color hex (e.g. #ED4245)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10),
    ),
  );

  return modal;
}

function buildAppealsModal() {
  const modal = new ModalBuilder()
    .setCustomId('appeals_edit')
    .setTitle('Appeal Settings');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('appeal_url')
        .setLabel('Appeal URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('appeal_server')
        .setLabel('Appeal / Support Server Invite')
        .setStyle(TextInputStyle.Short)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('appeal_instructions')
        .setLabel('Appeal Instructions')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000),
    ),
  );
  return modal;
}

function buildGeneralModal(cfg) {
  const modal = new ModalBuilder()
    .setCustomId('general_edit')
    .setTitle('General Settings');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('prefix')
        .setLabel('Command Prefix')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(cfg.prefix || '?')
        .setMaxLength(5),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('status')
        .setLabel('Bot Status Text')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(cfg.status || '🛡️ Protecting the server')
        .setMaxLength(100),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('toggles')
        .setLabel('Toggles: dm,restore,log,bypass,appeals (1/0)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(`${cfg.dmUsers ? 1 : 0},${cfg.restoreRoles ? 1 : 0},${cfg.logActions ? 1 : 0},${cfg.permissionBypass ? 1 : 0},${cfg.appealsEnabled ? 1 : 0}`)
        .setPlaceholder('1,1,1,1,1'),
    ),
  );
  return modal;
}

module.exports = {
  setupStatus,
  isFullyConfigured,
  buildSetupEmbed,
  buildSetupComponents,
  buildConfigPanel,
  buildRoleSelect,
  buildChannelSelect,
  handleQuickSetup,
  buildCheckerEmbed,
  buildMessagesMenu,
  buildMessageEditorModal,
  buildAppealsModal,
  buildGeneralModal,
};
