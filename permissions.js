const db = require('./database');

/**
 * Check if a member has a specific permission category.
 * Categories: 'sb', 'accept', 'deny', 'admin'
 */
function hasPermission(member, category) {
  if (!member || !member.guild) return false;

  const config = db.getGuildConfig(member.guild.id);

  // Server owner always has full access
  if (member.id === member.guild.ownerId) return true;

  // Administrator permission bypass (optional)
  if (config.permissionBypass && member.permissions.has('Administrator')) {
    return true;
  }

  const roleIds = member.roles.cache.map(r => r.id);

  switch (category) {
    case 'sb':
      return config.sbStaffRoles.some(id => roleIds.includes(id));
    case 'accept':
      return config.acceptRoles.some(id => roleIds.includes(id));
    case 'deny':
      return config.denyRoles.some(id => roleIds.includes(id));
    case 'admin':
      // Config access: owner, admin bypass, or any SB staff
      return (
        member.id === member.guild.ownerId ||
        (config.permissionBypass && member.permissions.has('Administrator')) ||
        config.sbStaffRoles.some(id => roleIds.includes(id))
      );
    case 'any_staff':
      return (
        config.sbStaffRoles.some(id => roleIds.includes(id)) ||
        config.acceptRoles.some(id => roleIds.includes(id)) ||
        config.denyRoles.some(id => roleIds.includes(id))
      );
    default:
      return false;
  }
}

function canUseSb(member) {
  return hasPermission(member, 'sb');
}

function canAccept(member) {
  return hasPermission(member, 'accept');
}

function canDeny(member) {
  return hasPermission(member, 'deny');
}

function canConfigure(member) {
  return hasPermission(member, 'admin');
}

function canViewNotes(member) {
  return hasPermission(member, 'any_staff') || hasPermission(member, 'admin');
}

module.exports = {
  hasPermission,
  canUseSb,
  canAccept,
  canDeny,
  canConfigure,
  canViewNotes,
};
