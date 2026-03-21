const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDbPath(userDataPath) {
  const dir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'sns-analyzer.db');
}

function init(userDataPath) {
  if (db) return db;
  db = new Database(getDbPath(userDataPath));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate();
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_group TEXT,
      platform TEXT NOT NULL,
      platform_post_id TEXT,
      caption TEXT,
      hashtags TEXT,
      category TEXT,
      posted_at TEXT NOT NULL,
      slide_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      collected_at TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS account_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      date TEXT NOT NULL,
      followers INTEGER DEFAULT 0,
      following INTEGER DEFAULT 0,
      total_reach INTEGER DEFAULT 0,
      total_impressions INTEGER DEFAULT 0,
      profile_views INTEGER DEFAULT 0,
      UNIQUE(platform, date)
    );

    CREATE TABLE IF NOT EXISTS collection_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT DEFAULT 'running',
      message TEXT,
      posts_updated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trend_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      score REAL DEFAULT 0,
      UNIQUE(keyword, source, date)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
    CREATE INDEX IF NOT EXISTS idx_posts_content_group ON posts(content_group);
    CREATE INDEX IF NOT EXISTS idx_metrics_post_id ON metrics(post_id);
    CREATE INDEX IF NOT EXISTS idx_account_stats_platform_date ON account_stats(platform, date);
    CREATE INDEX IF NOT EXISTS idx_trends_source_date ON trends(source, collected_at);
    CREATE INDEX IF NOT EXISTS idx_trend_keywords ON trend_keywords(keyword, source, date);
  `);
}

// ── Posts CRUD ──

function addPost({ content_group, platform, platform_post_id, caption, hashtags, category, posted_at, slide_count }) {
  const stmt = db.prepare(`
    INSERT INTO posts (content_group, platform, platform_post_id, caption, hashtags, category, posted_at, slide_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(content_group || null, platform, platform_post_id || null, caption || null,
    JSON.stringify(hashtags || []), category || 'other', posted_at, slide_count || 1);
  return result.lastInsertRowid;
}

function updatePost(id, fields) {
  const allowed = ['content_group', 'platform', 'platform_post_id', 'caption', 'hashtags', 'category', 'posted_at', 'slide_count'];
  const updates = [];
  const values = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.includes(k)) continue;
    updates.push(`${k} = ?`);
    values.push(k === 'hashtags' ? JSON.stringify(v) : v);
  }
  if (updates.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function deletePost(id) {
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
}

function getPosts({ platform, category, limit, offset } = {}) {
  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params = [];
  if (platform) { sql += ' AND platform = ?'; params.push(platform); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY posted_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(limit); }
  if (offset) { sql += ' OFFSET ?'; params.push(offset); }
  return db.prepare(sql).all(...params);
}

function getPostById(id) {
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
}

function getPostByPlatformId(platform, platform_post_id) {
  return db.prepare('SELECT * FROM posts WHERE platform = ? AND platform_post_id = ?').get(platform, platform_post_id);
}

// ── Metrics ──

function addMetrics(post_id, data) {
  const stmt = db.prepare(`
    INSERT INTO metrics (post_id, collected_at, views, likes, comments, shares, saves, reach, impressions)
    VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(post_id, data.views || 0, data.likes || 0, data.comments || 0,
    data.shares || 0, data.saves || 0, data.reach || 0, data.impressions || 0);
}

function getLatestMetrics(post_id) {
  return db.prepare('SELECT * FROM metrics WHERE post_id = ? ORDER BY collected_at DESC LIMIT 1').get(post_id);
}

function getMetricsHistory(post_id) {
  return db.prepare('SELECT * FROM metrics WHERE post_id = ? ORDER BY collected_at ASC').all(post_id);
}

// ── Account Stats ──

function upsertAccountStats(platform, date, data) {
  const stmt = db.prepare(`
    INSERT INTO account_stats (platform, date, followers, following, total_reach, total_impressions, profile_views)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, date) DO UPDATE SET
      followers = excluded.followers,
      following = excluded.following,
      total_reach = excluded.total_reach,
      total_impressions = excluded.total_impressions,
      profile_views = excluded.profile_views
  `);
  stmt.run(platform, date, data.followers || 0, data.following || 0,
    data.total_reach || 0, data.total_impressions || 0, data.profile_views || 0);
}

function getAccountStats(platform, days = 30) {
  return db.prepare(`
    SELECT * FROM account_stats WHERE platform = ? AND date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(platform, days);
}

function getLatestAccountStats(platform) {
  return db.prepare('SELECT * FROM account_stats WHERE platform = ? ORDER BY date DESC LIMIT 1').get(platform);
}

// ── Collection Log ──

function localNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function startCollection(platform) {
  const stmt = db.prepare(`INSERT INTO collection_log (platform, started_at) VALUES (?, ?)`);
  return stmt.run(platform, localNow()).lastInsertRowid;
}

function completeCollection(id, status, message, posts_updated) {
  db.prepare(`UPDATE collection_log SET completed_at = ?, status = ?, message = ?, posts_updated = ? WHERE id = ?`)
    .run(localNow(), status, message, posts_updated, id);
}

function getCollectionLogs(limit = 20) {
  return db.prepare('SELECT * FROM collection_log ORDER BY started_at DESC LIMIT ?').all(limit);
}

// ── Analytics Queries ──

function getPostsWithLatestMetrics({ platform, category, days } = {}) {
  let sql = `
    SELECT p.*, m.views, m.likes, m.comments, m.shares, m.saves, m.reach, m.impressions, m.collected_at as metrics_at
    FROM posts p
    LEFT JOIN metrics m ON m.id = (SELECT id FROM metrics WHERE post_id = p.id ORDER BY collected_at DESC LIMIT 1)
    WHERE 1=1
  `;
  const params = [];
  if (platform) { sql += ' AND p.platform = ?'; params.push(platform); }
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (days) { sql += ` AND p.posted_at >= date('now', '-' || ? || ' days')`; params.push(days); }
  sql += ' ORDER BY p.posted_at DESC';
  return db.prepare(sql).all(...params);
}

function getCategoryStats(platform, days = 90) {
  return db.prepare(`
    SELECT p.category, COUNT(p.id) as count,
      AVG(m.views) as avg_views, AVG(m.likes) as avg_likes,
      AVG(m.comments) as avg_comments, AVG(m.shares) as avg_shares,
      AVG(m.saves) as avg_saves, AVG(m.reach) as avg_reach
    FROM posts p
    LEFT JOIN metrics m ON m.id = (SELECT id FROM metrics WHERE post_id = p.id ORDER BY collected_at DESC LIMIT 1)
    WHERE p.platform = ? AND p.posted_at >= date('now', '-' || ? || ' days')
    GROUP BY p.category
    ORDER BY avg_likes DESC
  `).all(platform, days);
}

function getHourlyStats(platform, days = 90) {
  return db.prepare(`
    SELECT
      CAST(strftime('%w', p.posted_at) AS INTEGER) as dow,
      CAST(strftime('%H', p.posted_at) AS INTEGER) as hour,
      COUNT(p.id) as count,
      AVG(m.views) as avg_views, AVG(m.likes) as avg_likes,
      AVG(m.comments) as avg_comments
    FROM posts p
    LEFT JOIN metrics m ON m.id = (SELECT id FROM metrics WHERE post_id = p.id ORDER BY collected_at DESC LIMIT 1)
    WHERE p.platform = ? AND p.posted_at >= date('now', '-' || ? || ' days')
    GROUP BY dow, hour
  `).all(platform, days);
}

function getContentGroupComparison() {
  return db.prepare(`
    SELECT p.content_group, p.platform,
      m.views, m.likes, m.comments, m.shares, m.saves, m.reach,
      p.category, p.posted_at
    FROM posts p
    LEFT JOIN metrics m ON m.id = (SELECT id FROM metrics WHERE post_id = p.id ORDER BY collected_at DESC LIMIT 1)
    WHERE p.content_group IS NOT NULL
    ORDER BY p.content_group, p.platform
  `).all();
}

// ── Trends ──

function saveTrendSnapshot(source, data) {
  db.prepare('INSERT INTO trends (source, collected_at, data) VALUES (?, ?, ?)')
    .run(source, localNow(), JSON.stringify(data));
}

function getLatestTrendSnapshot(source) {
  const row = db.prepare('SELECT * FROM trends WHERE source = ? ORDER BY collected_at DESC LIMIT 1').get(source);
  if (row) row.data = JSON.parse(row.data);
  return row;
}

function saveTrendKeywords(source, date, keywordScores) {
  const stmt = db.prepare(`
    INSERT INTO trend_keywords (keyword, source, date, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(keyword, source, date) DO UPDATE SET score = excluded.score
  `);
  const tx = db.transaction((items) => {
    for (const { keyword, score } of items) {
      stmt.run(keyword, source, date, score);
    }
  });
  tx(keywordScores);
}

function getTrendKeywords(source, keyword, days = 30) {
  return db.prepare(`
    SELECT * FROM trend_keywords
    WHERE source = ? AND keyword = ? AND date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(source, keyword, days);
}

function getRecentTrendSnapshots(source, limit = 10) {
  const rows = db.prepare('SELECT * FROM trends WHERE source = ? ORDER BY collected_at DESC LIMIT ?').all(source, limit);
  for (const row of rows) row.data = JSON.parse(row.data);
  return rows;
}

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = {
  init, close,
  addPost, updatePost, deletePost, getPosts, getPostById, getPostByPlatformId,
  addMetrics, getLatestMetrics, getMetricsHistory,
  upsertAccountStats, getAccountStats, getLatestAccountStats,
  startCollection, completeCollection, getCollectionLogs,
  getPostsWithLatestMetrics, getCategoryStats, getHourlyStats, getContentGroupComparison,
  saveTrendSnapshot, getLatestTrendSnapshot, saveTrendKeywords, getTrendKeywords, getRecentTrendSnapshots
};
