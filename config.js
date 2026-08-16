require('dotenv').config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,

  // Default settings (overridden per-guild via database)
  defaults: {
    prefix: '?',
    status: '🛡️ Protecting the server',
    dmUsers: true,
    restoreRoles: true,
    logActions: true,
    allowUserIds: true,
    allowMentions: true,
    allowOutsideUsers: true,
    appealsEnabled: true,
    permissionBypass: true, // Server owners / admins bypass permission checks
    cooldownMs: 3000,
  },

  // Default messages (can be customized per-guild)
  defaultMessages: {
    // Channel confirmation when someone is successfully ServerBlocked
    // Supports type: "text" or "embed". Variables: {mention} {userid} {username} {reason} {case_id} {moderator} {server} etc.
    sbSuccess: {
      type: 'text',
      content: '✔️ {mention} was successfully serverblocked.',
    },
    sbDm: {
      type: 'embed',
      title: '🚫 You Have Been Server Blocked',
      description: 'You have been server blocked from **{server}**.\n\n**Reason:**\n{reason}\n\n**Case:**\n{case_id}\n\nIf you believe this action was incorrect, you may submit an appeal.',
      color: 0xED4245,
      footer: 'ServerBlock System',
      timestamp: true,
    },
    alreadyBlocked: {
      type: 'text',
      content: '⚠️ This user already has an active ServerBlock.\n**Case:** {case_id}',
    },
    missingReason: {
      type: 'text',
      content: '❌ Please provide a reason for the ServerBlock.\nUsage: `{prefix}sb @user reason`',
    },
    noPermission: {
      type: 'text',
      content: '❌ You do not have permission to use this command.',
    },
    invalidUser: {
      type: 'text',
      content: '❌ Could not find that user. Provide a valid mention or User ID.',
    },
    dmDisabled: {
      type: 'text',
      content: '⚠️ Could not DM the user (DMs disabled or blocked).',
    },
    sbRemoved: {
      type: 'embed',
      title: '✅ ServerBlock Removed',
      description: 'Your ServerBlock on **{server}** has been removed.\n\n**Case:** {case_id}',
      color: 0x57F287,
      footer: 'ServerBlock System',
      timestamp: true,
    },
    appealAccepted: {
      type: 'embed',
      title: '✅ Appeal Accepted',
      description: 'Your appeal for case **{case_id}** on **{server}** has been accepted.\nYour ServerBlock has been lifted.',
      color: 0x57F287,
      footer: 'ServerBlock System',
      timestamp: true,
    },
    appealDenied: {
      type: 'embed',
      title: '❌ Appeal Denied',
      description: 'Your appeal for case **{case_id}** on **{server}** has been denied.\n\n**Reason:** {reason}',
      color: 0xED4245,
      footer: 'ServerBlock System',
      timestamp: true,
    },
    configSaved: {
      type: 'text',
      content: '✅ Configuration saved successfully.',
    },
    setupRequired: {
      type: 'text',
      content: '⚠️ ServerBlock is not fully configured. Use `/setup` to get started.',
    },
    roleHierarchy: {
      type: 'text',
      content: '⚠️ I cannot assign {role} because my highest role is below it.\nMove my bot role above the configured ServerBlock roles.',
    },
    noActiveSb: {
      type: 'text',
      content: '❌ This user does not have an active ServerBlock.',
    },
    appealInstructions: {
      type: 'embed',
      title: '📋 How to Appeal',
      description: 'If you believe your ServerBlock was issued in error, please submit an appeal.\n\n{appeal_link}',
      color: 0x5865F2,
      footer: 'ServerBlock Appeals',
    },
  },
};
