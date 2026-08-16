const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('./database');
const commands = require('./commands');
const serverblock = require('./serverblock');
const setup = require('./setup');
const permissions = require('./permissions');
const logger = require('./logger');
const messages = require('./messages');
const config = require('./config');

function register(client) {
  client.once(Events.ClientReady, async (c) => {
    console.log(`[Ready] Logged in as ${c.user.tag}`);

    // Set status from first guild or default
    try {
      const activity = config.defaults.status;
      await c.user.setPresence({
        activities: [{ name: activity, type: 3 }], // Watching
        status: 'online',
      });
    } catch (e) {
      console.error('[Ready] Presence error:', e.message);
    }

    // Register slash commands globally
    try {
      const { REST, Routes } = require('discord.js');
      const rest = new REST({ version: '10' }).setToken(config.token);
      await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands.slashCommands.map(c => c.toJSON()),
      });
      console.log('[Ready] Slash commands registered globally.');
    } catch (e) {
      console.error('[Ready] Failed to register slash commands:', e.message);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await commands.handleSlash(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction, client);
        return;
      }

      if (interaction.isAnySelectMenu()) {
        await handleSelect(interaction, client);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModal(interaction, client);
        return;
      }
    } catch (err) {
      console.error('[Events] Interaction error:', err);
      try {
        const payload = { content: '❌ Something went wrong processing that interaction.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch {}
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    await commands.handlePrefix(message, client);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await serverblock.restoreRolesOnJoin(member);
    } catch (e) {
      console.error('[Events] guildMemberAdd error:', e.message);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    console.log(`[Guild] Joined: ${guild.name} (${guild.id})`);
    db.getGuildConfig(guild.id); // ensure row exists
  });

  client.on(Events.GuildDelete, (guild) => {
    console.log(`[Guild] Left: ${guild.name} (${guild.id})`);
  });
}

async function handleButton(interaction, client) {
  const id = interaction.customId;
  const guild = interaction.guild;
  if (!guild) return;

  // Permission check for config buttons
  const configButtons = [
    'setup_sb_roles', 'setup_sb_staff', 'setup_accept', 'setup_deny',
    'setup_log', 'setup_create_log', 'setup_messages', 'setup_appeals',
    'setup_quick', 'setup_checker', 'setup_config',
    'cfg_sb_roles', 'cfg_sb_staff', 'cfg_accept', 'cfg_deny',
    'cfg_log', 'cfg_messages', 'cfg_appeals', 'cfg_general',
    'cfg_export', 'cfg_reset', 'cfg_checker',
    'reset_confirm', 'reset_cancel',
  ];

  if (configButtons.includes(id) || id.startsWith('msg_') || id.startsWith('reset_')) {
    if (!permissions.canConfigure(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }
  }

  // Setup / Config navigation
  if (id === 'setup_sb_roles' || id === 'cfg_sb_roles') {
    return interaction.reply({
      content: '🎭 Select the **ServerBlock roles** to apply when a user is blocked (multiple allowed):',
      components: [setup.buildRoleSelect('select_sb_roles', 'Select SB roles…', 0, 25)],
      ephemeral: true,
    });
  }

  if (id === 'setup_sb_staff' || id === 'cfg_sb_staff') {
    return interaction.reply({
      content: '🛡️ Select the **SB Staff roles** that can use `?sb` / `/serverblock`:',
      components: [setup.buildRoleSelect('select_sb_staff', 'Select SB staff roles…', 0, 25)],
      ephemeral: true,
    });
  }

  if (id === 'setup_accept' || id === 'cfg_accept') {
    return interaction.reply({
      content: '✅ Select the **Accept Appeal roles**:',
      components: [setup.buildRoleSelect('select_accept', 'Select accept roles…', 0, 25)],
      ephemeral: true,
    });
  }

  if (id === 'setup_deny' || id === 'cfg_deny') {
    return interaction.reply({
      content: '❌ Select the **Deny Appeal roles**:',
      components: [setup.buildRoleSelect('select_deny', 'Select deny roles…', 0, 25)],
      ephemeral: true,
    });
  }

  if (id === 'setup_log' || id === 'cfg_log') {
    return interaction.reply({
      content: '📋 Select the **Log Channel**:',
      components: [setup.buildChannelSelect('select_log', 'Select log channel…')],
      ephemeral: true,
    });
  }

  if (id === 'setup_create_log') {
    try {
      const ch = await guild.channels.create({
        name: 'serverblock-logs',
        type: 0, // GuildText
        topic: 'ServerBlock system logs',
        reason: 'Created via ServerBlock setup',
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks'] },
        ],
      });
      const old = db.getGuildConfig(guild.id).logChannelId;
      db.updateGuildConfig(guild.id, { logChannelId: ch.id });
      db.addConfigAudit({
        guildId: guild.id,
        changedBy: interaction.user.id,
        setting: 'log_channel',
        oldValue: old || 'none',
        newValue: ch.id,
      });
      await logger.logConfigChange(guild, {
        changedBy: interaction.user.id,
        setting: 'log_channel',
        oldValue: old || 'none',
        newValue: `<#${ch.id}>`,
      });
      return interaction.reply({ content: `✅ Created and set log channel: <#${ch.id}>`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `❌ Failed to create channel: ${e.message}`, ephemeral: true });
    }
  }

  if (id === 'setup_messages' || id === 'cfg_messages') {
    return interaction.reply({
      content: '💬 Select a message to customize:',
      components: [setup.buildMessagesMenu()],
      ephemeral: true,
    });
  }

  if (id === 'setup_appeals' || id === 'cfg_appeals') {
    return interaction.showModal(setup.buildAppealsModal());
  }

  if (id === 'cfg_general') {
    const cfg = db.getGuildConfig(guild.id);
    return interaction.showModal(setup.buildGeneralModal(cfg));
  }

  if (id === 'setup_quick') {
    return setup.handleQuickSetup(interaction);
  }

  if (id === 'setup_checker' || id === 'cfg_checker') {
    return interaction.reply({ embeds: [setup.buildCheckerEmbed(guild)], ephemeral: true });
  }

  if (id === 'setup_config') {
    return interaction.reply({ ...setup.buildConfigPanel(guild), ephemeral: true });
  }

  if (id === 'cfg_export') {
    const data = db.exportConfig(guild.id);
    const json = JSON.stringify(data, null, 2);
    // Discord message limit; if too long, still try
    if (json.length > 1900) {
      return interaction.reply({
        content: '💾 Configuration exported (truncated — full export is large):\n```json\n' + json.slice(0, 1800) + '\n...```',
        ephemeral: true,
      });
    }
    return interaction.reply({
      content: '💾 **Configuration Export**\n```json\n' + json + '\n```',
      ephemeral: true,
    });
  }

  if (id === 'cfg_reset') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('reset_confirm').setLabel('Confirm Reset').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('reset_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({
      content: '⚠️ **Are you sure?** This will reset all ServerBlock configuration for this server to defaults.\nServerBlock records and history will **not** be deleted.',
      components: [row],
      ephemeral: true,
    });
  }

  if (id === 'reset_confirm') {
    db.resetConfig(guild.id, interaction.user.id);
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'reset_config',
      oldValue: 'full configuration',
      newValue: 'defaults',
    });
    return interaction.update({ content: '🔄 Configuration has been reset to defaults.', components: [] });
  }

  if (id === 'reset_cancel') {
    return interaction.update({ content: 'Cancelled.', components: [] });
  }

  // Message reset confirmation could be added later
}

async function handleSelect(interaction, client) {
  const id = interaction.customId;
  const guild = interaction.guild;
  if (!guild) return;

  if (!permissions.canConfigure(interaction.member)) {
    return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
  }

  const values = interaction.values || [];

  if (id === 'select_sb_roles') {
    const old = db.getGuildConfig(guild.id).sbRoles;
    db.updateGuildConfig(guild.id, { sbRoles: values });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'sb_roles',
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(values),
    });
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'sb_roles',
      oldValue: old.join(', ') || 'none',
      newValue: values.map(v => `<@&${v}>`).join(', ') || 'none',
    });
    return interaction.reply({ content: `✅ SB Roles updated: ${values.map(v => `<@&${v}>`).join(', ') || 'None'}`, ephemeral: true });
  }

  if (id === 'select_sb_staff') {
    const old = db.getGuildConfig(guild.id).sbStaffRoles;
    db.updateGuildConfig(guild.id, { sbStaffRoles: values });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'sb_staff_roles',
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(values),
    });
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'sb_staff_roles',
      oldValue: old.join(', ') || 'none',
      newValue: values.map(v => `<@&${v}>`).join(', ') || 'none',
    });
    return interaction.reply({ content: `✅ SB Staff Roles updated.`, ephemeral: true });
  }

  if (id === 'select_accept') {
    const old = db.getGuildConfig(guild.id).acceptRoles;
    db.updateGuildConfig(guild.id, { acceptRoles: values });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'accept_roles',
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(values),
    });
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'accept_roles',
      oldValue: old.join(', ') || 'none',
      newValue: values.map(v => `<@&${v}>`).join(', ') || 'none',
    });
    return interaction.reply({ content: `✅ Accept roles updated.`, ephemeral: true });
  }

  if (id === 'select_deny') {
    const old = db.getGuildConfig(guild.id).denyRoles;
    db.updateGuildConfig(guild.id, { denyRoles: values });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'deny_roles',
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(values),
    });
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'deny_roles',
      oldValue: old.join(', ') || 'none',
      newValue: values.map(v => `<@&${v}>`).join(', ') || 'none',
    });
    return interaction.reply({ content: `✅ Deny roles updated.`, ephemeral: true });
  }

  if (id === 'select_log') {
    const newId = values[0] || null;
    const old = db.getGuildConfig(guild.id).logChannelId;
    db.updateGuildConfig(guild.id, { logChannelId: newId });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'log_channel',
      oldValue: old || 'none',
      newValue: newId || 'none',
    });
    await logger.logConfigChange(guild, {
      changedBy: interaction.user.id,
      setting: 'log_channel',
      oldValue: old ? `<#${old}>` : 'none',
      newValue: newId ? `<#${newId}>` : 'none',
    });
    return interaction.reply({ content: `✅ Log channel set to ${newId ? `<#${newId}>` : 'None'}.`, ephemeral: true });
  }

  if (id === 'msg_select') {
    const key = values[0];
    const modal = setup.buildMessageEditorModal(key);
    // Pre-fill if possible would require more complex state; keep simple
    return interaction.showModal(modal);
  }
}

async function handleModal(interaction, client) {
  const id = interaction.customId;
  const guild = interaction.guild;
  if (!guild) return;

  if (!permissions.canConfigure(interaction.member)) {
    return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
  }

  if (id.startsWith('msg_edit_')) {
    const key = id.replace('msg_edit_', '');
    const type = interaction.fields.getTextInputValue('msg_type')?.toLowerCase() || 'embed';
    const title = interaction.fields.getTextInputValue('msg_title') || '';
    const description = interaction.fields.getTextInputValue('msg_description') || '';
    const footer = interaction.fields.getTextInputValue('msg_footer') || '';
    const colorStr = interaction.fields.getTextInputValue('msg_color') || '';

    let color = 0x5865F2;
    if (colorStr) {
      const hex = colorStr.replace('#', '');
      const parsed = parseInt(hex, 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const msgObj = type === 'text'
      ? { type: 'text', content: description }
      : { type: 'embed', title, description, footer, color, timestamp: true };

    const cfg = db.getGuildConfig(guild.id);
    const custom = { ...cfg.customMessages, [key]: msgObj };
    db.updateGuildConfig(guild.id, { customMessages: custom });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: `message_${key}`,
      oldValue: 'previous',
      newValue: 'updated',
    });

    return interaction.reply({ content: `✅ Message **${key}** updated.`, ephemeral: true });
  }

  if (id === 'appeals_edit') {
    const appealUrl = interaction.fields.getTextInputValue('appeal_url') || null;
    const appealServer = interaction.fields.getTextInputValue('appeal_server') || null;
    const appealInstructions = interaction.fields.getTextInputValue('appeal_instructions') || null;

    db.updateGuildConfig(guild.id, {
      appealUrl,
      appealServer,
      appealInstructions,
    });
    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'appeals',
      oldValue: 'previous',
      newValue: JSON.stringify({ appealUrl, appealServer }),
    });

    return interaction.reply({ content: '✅ Appeal settings updated.', ephemeral: true });
  }

  if (id === 'general_edit') {
    const prefix = interaction.fields.getTextInputValue('prefix') || '?';
    const status = interaction.fields.getTextInputValue('status') || config.defaults.status;
    const toggles = (interaction.fields.getTextInputValue('toggles') || '1,1,1,1,1').split(',').map(t => t.trim() === '1');

    db.updateGuildConfig(guild.id, {
      prefix: prefix.slice(0, 5),
      status,
      dmUsers: toggles[0] ?? true,
      restoreRoles: toggles[1] ?? true,
      logActions: toggles[2] ?? true,
      permissionBypass: toggles[3] ?? true,
      appealsEnabled: toggles[4] ?? true,
    });

    // Update presence if possible
    try {
      await client.user.setPresence({
        activities: [{ name: status, type: 3 }],
        status: 'online',
      });
    } catch {}

    db.addConfigAudit({
      guildId: guild.id,
      changedBy: interaction.user.id,
      setting: 'general',
      oldValue: 'previous',
      newValue: `prefix=${prefix}`,
    });

    return interaction.reply({ content: '✅ General settings updated.', ephemeral: true });
  }
}

module.exports = { register };
