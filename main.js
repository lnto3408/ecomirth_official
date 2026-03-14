const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const db = require('./database');

app.commandLine.appendSwitch('remote-debugging-port', '9223');

let mainWindow = null;

// card-news-maker config (read-only)
const CNM_CONFIG_PATH = path.join(path.dirname(app.getPath('userData')), 'card-news-maker', 'config.json');
const ANALYZER_CONFIG_PATH = path.join(app.getPath('userData'), 'analyzer-config.json');

function loadCnmConfig() {
  if (!fs.existsSync(CNM_CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CNM_CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

function loadAnalyzerSettings() {
  if (!fs.existsSync(ANALYZER_CONFIG_PATH)) return { categories: ['policy', 'finance', 'trend', 'lifestyle', 'tech', 'other'] };
  try { return JSON.parse(fs.readFileSync(ANALYZER_CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

function saveAnalyzerSettings(settings) {
  fs.writeFileSync(ANALYZER_CONFIG_PATH, JSON.stringify(settings, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  mainWindow.loadFile('src/index.html');
}

// ── HTTP helper ──

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const method = (options.method || 'GET').toUpperCase();
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: options.headers || {},
    };

    if (options.body) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = mod.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          } else {
            resolve(json);
          }
        } catch {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          else resolve(body);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Collectors ──

const threadsCollector = require('./collectors/threads');
const instagramCollector = require('./collectors/instagram');
const tiktokBridge = require('./collectors/tiktok-bridge');

async function runCollector(platform) {
  const cnmConfig = loadCnmConfig();
  const snsAccounts = cnmConfig.snsAccounts || {};
  const logId = db.startCollection(platform);

  try {
    let result;
    switch (platform) {
      case 'threads':
        result = await threadsCollector.collect(snsAccounts.threads, db, fetchJson);
        break;
      case 'instagram':
        result = await instagramCollector.collect(snsAccounts.instagram, db, fetchJson);
        break;
      case 'tiktok':
        result = await tiktokBridge.collect(db);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
    db.completeCollection(logId, 'success', result.message, result.postsUpdated);
    return { success: true, message: result.message, postsUpdated: result.postsUpdated };
  } catch (err) {
    db.completeCollection(logId, 'error', err.message, 0);
    return { success: false, message: err.message };
  }
}

// ── IPC Handlers ──

app.whenReady().then(() => {
  db.init(app.getPath('userData'));

  // Posts
  ipcMain.handle('add-post', (_, data) => db.addPost(data));
  ipcMain.handle('update-post', (_, id, fields) => { db.updatePost(id, fields); return true; });
  ipcMain.handle('delete-post', (_, id) => { db.deletePost(id); return true; });
  ipcMain.handle('get-posts', (_, filters) => db.getPosts(filters || {}));
  ipcMain.handle('get-post', (_, id) => db.getPostById(id));

  // Metrics
  ipcMain.handle('add-metrics', (_, postId, data) => { db.addMetrics(postId, data); return true; });
  ipcMain.handle('get-latest-metrics', (_, postId) => db.getLatestMetrics(postId));
  ipcMain.handle('get-metrics-history', (_, postId) => db.getMetricsHistory(postId));

  // Account Stats
  ipcMain.handle('upsert-account-stats', (_, platform, date, data) => { db.upsertAccountStats(platform, date, data); return true; });
  ipcMain.handle('get-account-stats', (_, platform, days) => db.getAccountStats(platform, days || 30));
  ipcMain.handle('get-latest-account-stats', (_, platform) => db.getLatestAccountStats(platform));

  // Analytics
  ipcMain.handle('get-posts-with-metrics', (_, filters) => db.getPostsWithLatestMetrics(filters || {}));
  ipcMain.handle('get-category-stats', (_, platform, days) => db.getCategoryStats(platform, days || 90));
  ipcMain.handle('get-hourly-stats', (_, platform, days) => db.getHourlyStats(platform, days || 90));
  ipcMain.handle('get-content-group-comparison', () => db.getContentGroupComparison());

  // Collection
  ipcMain.handle('collect', (_, platform) => runCollector(platform));
  ipcMain.handle('get-collection-logs', (_, limit) => db.getCollectionLogs(limit || 20));

  // Settings
  ipcMain.handle('get-token-status', () => {
    const cnm = loadCnmConfig();
    const sns = cnm.snsAccounts || {};
    return {
      threads: { hasToken: !!(sns.threads?.accessToken), userId: sns.threads?.userId || '' },
      instagram: { hasToken: !!(sns.instagram?.accessToken), accountId: sns.instagram?.accountId || '' },
      tiktok: { mode: 'emulator' },
    };
  });
  ipcMain.handle('save-analyzer-settings', (_, settings) => { saveAnalyzerSettings(settings); return true; });
  ipcMain.handle('load-analyzer-settings', () => loadAnalyzerSettings());

  // Export
  ipcMain.handle('export-data', async (_, format) => {
    const posts = db.getPostsWithLatestMetrics();
    if (format === 'csv') {
      const headers = 'id,platform,category,content_group,caption,posted_at,views,likes,comments,shares,saves,reach,impressions';
      const rows = posts.map(p =>
        [p.id, p.platform, p.category, p.content_group || '', `"${(p.caption || '').replace(/"/g, '""')}"`,
         p.posted_at, p.views||0, p.likes||0, p.comments||0, p.shares||0, p.saves||0, p.reach||0, p.impressions||0].join(',')
      );
      const csv = [headers, ...rows].join('\n');
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `sns-data-${new Date().toISOString().slice(0,10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (filePath) { fs.writeFileSync(filePath, '\uFEFF' + csv); return { success: true, path: filePath }; }
      return { success: false, message: 'Cancelled' };
    } else {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `sns-data-${new Date().toISOString().slice(0,10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (filePath) { fs.writeFileSync(filePath, JSON.stringify(posts, null, 2)); return { success: true, path: filePath }; }
      return { success: false, message: 'Cancelled' };
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  db.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
