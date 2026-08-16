const db = require('./database');
const logger = require('./logger');
const messages = require('./messages');
const { resolveUser, resolveMember, formatTimestamp } = require('./utils');

/**
 * Create a ServerBlock for a user.
 * Returns { success, message, caseId, error }
 */
async function createSB(client, guild, moderator, targetUserId, reason) {
  if (!reason || !reason.trim()) {
    return { success: false, message: 'missing_reason' };
  }

  const config = db.getGuildConfig(guild.id);
  const existing = db.getActiveServerBlock(guild.id, targetUserId);
  if (existing) {
    return {
      success: false,
      message: 'already_blocked',
      caseId: existing.caseId,
      existing,
    };
  }

  const user = await resolveUser(client, targetUserId);
  if (!user && !config.allowOutsideUsers) {
    return { success: false, message: 'invalid_user' };
  }

  const caseId = db.getNextCaseId(guild.id);
  const rolesGiven = [];
  const failedRoles = [];

  // Assign all configured SB roles if member is in guild
  const member = await resolveMember(guild, targetUserId);
  if (member && config.sbRoles.length > 0) {
    const botMember = guild.members.me;
    const botHighest = botMember.roles.highest.position;

    for (const roleId of config.sbRoles) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;

      if (role.position >= botHighest) {
        failedRoles.push(roleId);
        continue;
      }

      try {
        await member.roles.add(roleId, `ServerBlock ${caseId}`);
        rolesGiven.push(roleId);
      } catch (e) {
        failedRoles.push(roleId);
        console.error(`[SB] Failed to add role ${roleId}:`, e.message);
      }
    }
  }

  // Persist
  db.createServerBlock({
    guildId: guild.id,
    userId: targetUserId,
    caseId,
    reason: reason.trim(),
    blockedBy: moderator.id,
    rolesGiven,
  });

  db.addHistory({
    guildId: guild.id,
    userId: targetUserId,
    caseId,
    action: 'serverblocked',
    staffId: moderator.id,
    reason: reason.trim(),
    metadata: { rolesGiven, failedRoles },
  });

  // DM user
  let dmResult = { success: false };
  if (user) {
    const vars = messages.getVars({
      user,
      moderator,
      guild,
      reason: reason.trim(),
      caseId,
      appealLink: config.appealUrl || '',
    });
    dmResult = await messages.sendDm(user, guild.id, 'sbDm', vars);
  }

  // Log
  await logger.logSbCreated(guild, {
    user: user || { id: targetUserId },
    caseId,
    reason: reason.trim(),
    moderator,
    rolesGiven,
  });

  const isInServer = !!member;
  const confirmation = messages.fixedSbConfirmation(targetUserId, isInServer);

  return {
    success: true,
    confirmation,
    caseId,
    rolesGiven,
    failedRoles,
    dmResult,
    user,
  };
}

/**
 * Remove (deactivate) a ServerBlock
 */
async function removeSB(client, guild, moderator, targetUserId, removalReason = null) {
  const existing = db.getActiveServerBlock(guild.id, targetUserId);
  if (!existing) {
    return { success: false, message: 'no_active_sb' };
  }

  const config = db.getGuildConfig(guild.id);

  // Remove SB roles
  const member = await resolveMember(guild, targetUserId);
  if (member && config.sbRoles.length > 0) {
    for (const roleId of config.sbRoles) {
      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, `SB Removed ${existing.caseId}`);
        }
      } catch (e) {
        console.error(`[SB] Failed to remove role ${roleId}:`, e.message);
      }
    }
  }

  db.deactivateServerBlock(existing.caseId, moderator.id, removalReason);

  db.addHistory({
    guildId: guild.id,
    userId: targetUserId,
    caseId: existing.caseId,
    action: 'removed',
    staffId: moderator.id,
    reason: removalReason,
  });

  const user = await resolveUser(client, targetUserId);

  // DM
  if (user) {
    const vars = messages.getVars({
      user,
      moderator,
      guild,
      caseId: existing.caseId,
      reason: removalReason || '',
    });
    await messages.sendDm(user, guild.id, 'sbRemoved', vars);
  }

  await logger.logSbRemoved(guild, {
    user: user || { id: targetUserId },
    caseId: existing.caseId,
    moderator,
    reason: removalReason,
  });

  return {
    success: true,
    caseId: existing.caseId,
    user,
  };
}

/**
 * Accept an appeal
 */
async function acceptAppeal(client, guild, moderator, targetUserId) {
  const existing = db.getActiveServerBlock(guild.id, targetUserId);
  if (!existing) {
    return { success: false, message: 'no_active_sb' };
  }

  const config = db.getGuildConfig(guild.id);

  // Remove roles
  const member = await resolveMember(guild, targetUserId);
  if (member && config.sbRoles.length > 0) {
    for (const roleId of config.sbRoles) {
      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, `Appeal Accepted ${existing.caseId}`);
        }
      } catch (e) {
        console.error(`[SB] Failed to remove role on accept:`, e.message);
      }
    }
  }

  db.updateAppealStatus(existing.caseId, 'accepted', moderator.id);
  db.deactivateServerBlock(existing.caseId, moderator.id, 'Appeal accepted');

  db.addHistory({
    guildId: guild.id,
    userId: targetUserId,
    caseId: existing.caseId,
    action: 'appeal_accepted',
    staffId: moderator.id,
  });

  const user = await resolveUser(client, targetUserId);
  if (user) {
    const vars = messages.getVars({
      user,
      moderator,
      guild,
      caseId: existing.caseId,
    });
    await messages.sendDm(user, guild.id, 'appealAccepted', vars);
  }

  await logger.logAppealAccepted(guild, {
    user: user || { id: targetUserId },
    caseId: existing.caseId,
    moderator,
  });

  return { success: true, caseId: existing.caseId, user };
}

/**
 * Deny an appeal
 */
async function denyAppeal(client, guild, moderator, targetUserId, denialReason = null) {
  const existing = db.getActiveServerBlock(guild.id, targetUserId);
  if (!existing) {
    return { success: false, message: 'no_active_sb' };
  }

  db.updateAppealStatus(existing.caseId, 'denied', moderator.id, denialReason);

  db.addHistory({
    guildId: guild.id,
    userId: targetUserId,
    caseId: existing.caseId,
    action: 'appeal_denied',
    staffId: moderator.id,
    reason: denialReason,
  });

  const user = await resolveUser(client, targetUserId);
  if (user) {
    const vars = messages.getVars({
      user,
      moderator,
      guild,
      caseId: existing.caseId,
      reason: denialReason || 'No reason provided',
    });
    await messages.sendDm(user, guild.id, 'appealDenied', vars);
  }

  await logger.logAppealDenied(guild, {
    user: user || { id: targetUserId },
    caseId: existing.caseId,
    moderator,
    reason: denialReason,
  });

  return { success: true, caseId: existing.caseId, user };
}

/**
 * Restore SB roles on rejoin
 */
async function restoreRolesOnJoin(member) {
  const config = db.getGuildConfig(member.guild.id);
  if (!config.restoreRoles) return;

  const existing = db.getActiveServerBlock(member.guild.id, member.id);
  if (!existing) return;

  const rolesGiven = [];
  const botMember = member.guild.members.me;
  const botHighest = botMember.roles.highest.position;

  for (const roleId of config.sbRoles) {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;
    if (role.position >= botHighest) continue;
    if (member.roles.cache.has(roleId)) continue;

    try {
      await member.roles.add(roleId, `SB Role Restore ${existing.caseId}`);
      rolesGiven.push(roleId);
    } catch (e) {
      console.error(`[SB] Restore role failed:`, e.message);
    }
  }

  if (rolesGiven.length > 0) {
    db.addHistory({
      guildId: member.guild.id,
      userId: member.id,
      caseId: existing.caseId,
      action: 'roles_restored',
      metadata: { rolesGiven },
    });

    await logger.logRolesRestored(member.guild, {
      userId: member.id,
      rolesCount: rolesGiven.length,
    });
  }
}

/**
 * Get info object for a user
 */
async function getSbInfo(client, guild, userId) {
  const active = db.getActiveServerBlock(guild.id, userId);
  const all = db.getServerBlocksByUser(guild.id, userId);
  const user = await resolveUser(client, userId);
  const member = await resolveMember(guild, userId);

  return {
    user,
    member,
    active,
    history: all,
    isInServer: !!member,
  };
}

module.exports = {
  createSB,
  removeSB,
  acceptAppeal,
  denyAppeal,
  restoreRolesOnJoin,
  getSbInfo,
};
