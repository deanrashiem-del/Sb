const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'serverblock.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  // Guild configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT DEFAULT '?',
      status TEXT DEFAULT '🛡️ Protecting the server',
      dm_users INTEGER DEFAULT 1,
      restore_roles INTEGER DEFAULT 1,
      log_actions INTEGER DEFAULT 1,
      allow_user_ids INTEGER DEFAULT 1,
      allow_mentions INTEGER DEFAULT 1,
      allow_outside_users INTEGER DEFAULT 1,
      appeals_enabled INTEGER DEFAULT 1,
      permission_bypass INTEGER DEFAULT 1,
      sb_roles TEXT DEFAULT '[]',
      sb_staff_roles TEXT DEFAULT '[]',
      accept_roles TEXT DEFAULT '[]',
      deny_roles TEXT DEFAULT '[]',
      log_channel_id TEXT,
      appeal_url TEXT,
      appeal_channel_id TEXT,
      appeal_server TEXT,
      appeal_instructions TEXT,
      custom_messages TEXT DEFAULT '{}',
      case_counter INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ServerBlocks
  db.exec(`
    CREATE TABLE IF NOT EXISTS serverblocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      blocked_by TEXT NOT NULL,
      blocked_at TEXT DEFAULT (datetime('now')),
      active INTEGER DEFAULT 1,
      roles_given TEXT DEFAULT '[]',
      appeal_status TEXT DEFAULT 'none',
      appeal_reason TEXT,
      appeal_reviewed_by TEXT,
      appeal_reviewed_at TEXT,
      removed_by TEXT,
      removed_at TEXT,
      removal_reason TEXT
    )
  `);

  // Create index for faster lookups (active SBs)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sb_guild_user ON serverblocks(guild_id, user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sb_case ON serverblocks(case_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sb_active ON serverblocks(guild_id, active)`);

  // History / Timeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT,
      case_id TEXT,
      action TEXT NOT NULL,
      staff_id TEXT,
      reason TEXT,
      metadata TEXT DEFAULT '{}',
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_guild ON history(guild_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_case ON history(case_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_user ON history(guild_id, user_id)`);

  // Staff notes (private)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      note TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  // Configuration audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      setting TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  // Staff statistics helpers (computed on the fly mostly, but we keep history)

  console.log('[Database] SQLite initialized successfully.');
}

// ========== GUILD CONFIG ==========

function getGuildConfig(guildId) {
  let row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  }
  return parseConfig(row);
}

function parseConfig(row) {
  if (!row) return null;
  return {
    guildId: row.guild_id,
    prefix: row.prefix,
    status: row.status,
    dmUsers: !!row.dm_users,
    restoreRoles: !!row.restore_roles,
    logActions: !!row.log_actions,
    allowUserIds: !!row.allow_user_ids,
    allowMentions: !!row.allow_mentions,
    allowOutsideUsers: !!row.allow_outside_users,
    appealsEnabled: !!row.appeals_enabled,
    permissionBypass: !!row.permission_bypass,
    sbRoles: JSON.parse(row.sb_roles || '[]'),
    sbStaffRoles: JSON.parse(row.sb_staff_roles || '[]'),
    acceptRoles: JSON.parse(row.accept_roles || '[]'),
    denyRoles: JSON.parse(row.deny_roles || '[]'),
    logChannelId: row.log_channel_id,
    appealUrl: row.appeal_url,
    appealChannelId: row.appeal_channel_id,
    appealServer: row.appeal_server,
    appealInstructions: row.appeal_instructions,
    customMessages: JSON.parse(row.custom_messages || '{}'),
    caseCounter: row.case_counter || 0,
  };
}

function updateGuildConfig(guildId, updates) {
  const current = getGuildConfig(guildId);
  const fields = [];
  const values = [];

  const map = {
    prefix: 'prefix',
    status: 'status',
    dmUsers: 'dm_users',
    restoreRoles: 'restore_roles',
    logActions: 'log_actions',
    allowUserIds: 'allow_user_ids',
    allowMentions: 'allow_mentions',
    allowOutsideUsers: 'allow_outside_users',
    appealsEnabled: 'appeals_enabled',
    permissionBypass: 'permission_bypass',
    sbRoles: 'sb_roles',
    sbStaffRoles: 'sb_staff_roles',
    acceptRoles: 'accept_roles',
    denyRoles: 'deny_roles',
    logChannelId: 'log_channel_id',
    appealUrl: 'appeal_url',
    appealChannelId: 'appeal_channel_id',
    appealServer: 'appeal_server',
    appealInstructions: 'appeal_instructions',
    customMessages: 'custom_messages',
    caseCounter: 'case_counter',
  };

  for (const [key, col] of Object.entries(map)) {
    if (updates[key] !== undefined) {
      fields.push(`${col} = ?`);
      let val = updates[key];
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        val = JSON.stringify(val);
      } else if (typeof val === 'boolean') {
        val = val ? 1 : 0;
      }
      values.push(val);
    }
  }

  if (fields.length === 0) return current;

  fields.push(`updated_at = datetime('now')`);
  values.push(guildId);

  db.prepare(`UPDATE guild_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
  return getGuildConfig(guildId);
}

function getNextCaseId(guildId) {
  const config = getGuildConfig(guildId);
  const next = (config.caseCounter || 0) + 1;
  updateGuildConfig(guildId, { caseCounter: next });
  return `SB-${String(next).padStart(6, '0')}`;
}

// ========== SERVERBLOCKS ==========

function createServerBlock({ guildId, userId, caseId, reason, blockedBy, rolesGiven }) {
  const stmt = db.prepare(`
    INSERT INTO serverblocks (guild_id, user_id, case_id, reason, blocked_by, roles_given, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  stmt.run(guildId, userId, caseId, reason, blockedBy, JSON.stringify(rolesGiven || []));
  return getServerBlockByCase(caseId);
}

function getActiveServerBlock(guildId, userId) {
  const row = db.prepare(`
    SELECT * FROM serverblocks WHERE guild_id = ? AND user_id = ? AND active = 1
    ORDER BY blocked_at DESC LIMIT 1
  `).get(guildId, userId);
  return row ? parseSB(row) : null;
}

function getServerBlockByCase(caseId) {
  const row = db.prepare('SELECT * FROM serverblocks WHERE case_id = ?').get(caseId);
  return row ? parseSB(row) : null;
}

function getServerBlocksByUser(guildId, userId) {
  const rows = db.prepare(`
    SELECT * FROM serverblocks WHERE guild_id = ? AND user_id = ?
    ORDER BY blocked_at DESC
  `).all(guildId, userId);
  return rows.map(parseSB);
}

function getAllServerBlocks(guildId, filter = null) {
  let sql = 'SELECT * FROM serverblocks WHERE guild_id = ?';
  const params = [guildId];
  if (filter === 'active') {
    sql += ' AND active = 1';
  } else if (filter === 'removed') {
    sql += ' AND active = 0';
  } else if (filter === 'accepted') {
    sql += ` AND appeal_status = 'accepted'`;
  } else if (filter === 'denied') {
    sql += ` AND appeal_status = 'denied'`;
  }
  sql += ' ORDER BY blocked_at DESC';
  return db.prepare(sql).all(...params).map(parseSB);
}

function deactivateServerBlock(caseId, removedBy, removalReason = null) {
  db.prepare(`
    UPDATE serverblocks SET active = 0, removed_by = ?, removed_at = datetime('now'), removal_reason = ?
    WHERE case_id = ?
  `).run(removedBy, removalReason, caseId);
  return getServerBlockByCase(caseId);
}

function updateAppealStatus(caseId, status, reviewedBy, appealReason = null) {
  db.prepare(`
    UPDATE serverblocks SET appeal_status = ?, appeal_reviewed_by = ?, appeal_reviewed_at = datetime('now'),
    appeal_reason = COALESCE(?, appeal_reason)
    WHERE case_id = ?
  `).run(status, reviewedBy, appealReason, caseId);
  return getServerBlockByCase(caseId);
}

function updateReason(caseId, newReason) {
  db.prepare('UPDATE serverblocks SET reason = ? WHERE case_id = ?').run(newReason, caseId);
  return getServerBlockByCase(caseId);
}

function parseSB(row) {
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    caseId: row.case_id,
    reason: row.reason,
    blockedBy: row.blocked_by,
    blockedAt: row.blocked_at,
    active: !!row.active,
    rolesGiven: JSON.parse(row.roles_given || '[]'),
    appealStatus: row.appeal_status || 'none',
    appealReason: row.appeal_reason,
    appealReviewedBy: row.appeal_reviewed_by,
    appealReviewedAt: row.appeal_reviewed_at,
    removedBy: row.removed_by,
    removedAt: row.removed_at,
    removalReason: row.removal_reason,
  };
}

// ========== HISTORY ==========

function addHistory({ guildId, userId, caseId, action, staffId, reason, metadata }) {
  db.prepare(`
    INSERT INTO history (guild_id, user_id, case_id, action, staff_id, reason, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, userId || null, caseId || null, action, staffId || null, reason || null, JSON.stringify(metadata || {}));
}

function getHistoryByCase(caseId) {
  return db.prepare('SELECT * FROM history WHERE case_id = ? ORDER BY timestamp ASC').all(caseId).map(parseHistory);
}

function getHistoryByUser(guildId, userId) {
  return db.prepare(`
    SELECT * FROM history WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC
  `).all(guildId, userId).map(parseHistory);
}

function getHistoryByGuild(guildId, limit = 50, offset = 0) {
  return db.prepare(`
    SELECT * FROM history WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?
  `).all(guildId, limit, offset).map(parseHistory);
}

function parseHistory(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    caseId: row.case_id,
    action: row.action,
    staffId: row.staff_id,
    reason: row.reason,
    metadata: JSON.parse(row.metadata || '{}'),
    timestamp: row.timestamp,
  };
}

// ========== NOTES ==========

function addNote({ guildId, caseId, staffId, note }) {
  db.prepare(`
    INSERT INTO notes (guild_id, case_id, staff_id, note) VALUES (?, ?, ?, ?)
  `).run(guildId, caseId, staffId, note);
}

function getNotes(caseId) {
  return db.prepare('SELECT * FROM notes WHERE case_id = ? ORDER BY timestamp ASC').all(caseId).map(r => ({
    id: r.id,
    guildId: r.guild_id,
    caseId: r.case_id,
    staffId: r.staff_id,
    note: r.note,
    timestamp: r.timestamp,
  }));
}

// ========== CONFIG AUDIT ==========

function addConfigAudit({ guildId, changedBy, setting, oldValue, newValue }) {
  db.prepare(`
    INSERT INTO config_audit (guild_id, changed_by, setting, old_value, new_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, changedBy, setting, String(oldValue ?? ''), String(newValue ?? ''));
}

function getConfigAudit(guildId, limit = 30) {
  return db.prepare(`
    SELECT * FROM config_audit WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?
  `).all(guildId, limit);
}

// ========== STATS ==========

function getGuildStats(guildId) {
  const total = db.prepare('SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ?').get(guildId).c;
  const active = db.prepare('SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND active = 1').get(guildId).c;
  const removed = total - active;
  const appeals = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND appeal_status != 'none'`).get(guildId).c;
  const accepted = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND appeal_status = 'accepted'`).get(guildId).c;
  const denied = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND appeal_status = 'denied'`).get(guildId).c;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const thisWeek = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND blocked_at >= ?`).get(guildId, weekAgo).c;
  const thisMonth = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND blocked_at >= ?`).get(guildId, monthAgo).c;

  return { total, active, removed, appeals, accepted, denied, thisWeek, thisMonth };
}

function getStaffStats(guildId, staffId) {
  const issued = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND blocked_by = ?`).get(guildId, staffId).c;
  const removed = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND removed_by = ?`).get(guildId, staffId).c;
  const accepted = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND appeal_reviewed_by = ? AND appeal_status = 'accepted'`).get(guildId, staffId).c;
  const denied = db.prepare(`SELECT COUNT(*) as c FROM serverblocks WHERE guild_id = ? AND appeal_reviewed_by = ? AND appeal_status = 'denied'`).get(guildId, staffId).c;

  const recent = db.prepare(`
    SELECT * FROM history WHERE guild_id = ? AND staff_id = ? ORDER BY timestamp DESC LIMIT 10
  `).all(guildId, staffId).map(parseHistory);

  return { issued, removed, accepted, denied, recent };
}

function getTopReasons(guildId, limit = 10) {
  const rows = db.prepare(`
    SELECT reason, COUNT(*) as count FROM serverblocks
    WHERE guild_id = ? GROUP BY reason ORDER BY count DESC LIMIT ?
  `).all(guildId, limit);
  return rows;
}

function exportConfig(guildId) {
  const config = getGuildConfig(guildId);
  // Strip nothing sensitive beyond what's already guild-local
  return {
    prefix: config.prefix,
    status: config.status,
    dmUsers: config.dmUsers,
    restoreRoles: config.restoreRoles,
    logActions: config.logActions,
    allowUserIds: config.allowUserIds,
    allowMentions: config.allowMentions,
    allowOutsideUsers: config.allowOutsideUsers,
    appealsEnabled: config.appealsEnabled,
    permissionBypass: config.permissionBypass,
    sbRoles: config.sbRoles,
    sbStaffRoles: config.sbStaffRoles,
    acceptRoles: config.acceptRoles,
    denyRoles: config.denyRoles,
    logChannelId: config.logChannelId,
    appealUrl: config.appealUrl,
    appealChannelId: config.appealChannelId,
    appealServer: config.appealServer,
    appealInstructions: config.appealInstructions,
    customMessages: config.customMessages,
  };
}

function importConfig(guildId, data, changedBy) {
  const old = getGuildConfig(guildId);
  updateGuildConfig(guildId, data);
  addConfigAudit({
    guildId,
    changedBy,
    setting: 'import_config',
    oldValue: 'previous configuration',
    newValue: 'imported configuration',
  });
  return getGuildConfig(guildId);
}

function resetConfig(guildId, changedBy) {
  const old = getGuildConfig(guildId);
  db.prepare('DELETE FROM guild_config WHERE guild_id = ?').run(guildId);
  addConfigAudit({
    guildId,
    changedBy,
    setting: 'reset_config',
    oldValue: 'full configuration',
    newValue: 'defaults',
  });
  return getGuildConfig(guildId);
}

module.exports = {
  init,
  db,
  getGuildConfig,
  updateGuildConfig,
  getNextCaseId,
  createServerBlock,
  getActiveServerBlock,
  getServerBlockByCase,
  getServerBlocksByUser,
  getAllServerBlocks,
  deactivateServerBlock,
  updateAppealStatus,
  updateReason,
  addHistory,
  getHistoryByCase,
  getHistoryByUser,
  getHistoryByGuild,
  addNote,
  getNotes,
  addConfigAudit,
  getConfigAudit,
  getGuildStats,
  getStaffStats,
  getTopReasons,
  exportConfig,
  importConfig,
  resetConfig,
};
