const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const db = require('./database');
const webhookServer = require('./webhook-server');

app.commandLine.appendSwitch('remote-debugging-port', '9223');

// NOTE: app.setName()은 app.getPath('userData') 경로를 변경시키므로 사용하지 않는다.
// Dock 이름은 .app 번들의 Info.plist CFBundleName으로 설정한다.
// 참고: docs/guides/electron-app-icon-and-name.md

if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(__dirname, 'assets', 'icon_512.png'));
}

let mainWindow = null;

// card-news-maker config (read-only)
const CNM_DATA_DIR = path.join(path.dirname(app.getPath('userData')), 'card-news-maker');
const CNM_CONFIG_PATH = path.join(CNM_DATA_DIR, 'config.json');
const CNM_PROJECTS_DIR = path.join(CNM_DATA_DIR, 'projects');
const ANALYZER_CONFIG_PATH = path.join(app.getPath('userData'), 'analyzer-config.json');

function loadCnmConfig() {
  if (!fs.existsSync(CNM_CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CNM_CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

function loadAnalyzerSettings() {
  if (!fs.existsSync(ANALYZER_CONFIG_PATH)) return { categories: ['policy', 'finance', 'trend', 'lifestyle', 'tech', 'other'], autoCollect: true, collectInterval: 30 };
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
    icon: path.join(__dirname, 'assets', 'icon_512.png'),
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

// ── Category Mapping (from card-news-maker projects) ──

// card-news-maker category IDs → analyzer category IDs
const CNM_CATEGORY_MAP = {
  'tech-ai': 'tech',
  'career': 'lifestyle',
  'life': 'lifestyle',
  'money': 'finance',
  'news': 'policy',
};

function loadCnmProjects() {
  if (!fs.existsSync(CNM_PROJECTS_DIR)) return [];
  const files = fs.readdirSync(CNM_PROJECTS_DIR).filter(f => f.endsWith('.json'));
  const projects = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CNM_PROJECTS_DIR, file), 'utf-8'));
      if (data.category && data.snsText) {
        projects.push({
          name: data.name || '',
          category: CNM_CATEGORY_MAP[data.category] || data.category,
          cnmCategory: data.category,
          snsText: data.snsText,
        });
      }
    } catch { /* skip invalid files */ }
  }
  return projects;
}

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').replace(/#[\w\uAC00-\uD7A3]+/g, '').trim().slice(0, 100);
}

// Keyword-based fallback (same as card-news-maker's autoCategorize)
const CATEGORY_KEYWORDS = {
  'tech': ['AI', 'GPT', '챗봇', '딥러닝', '머신러닝', '자동화', '에이전트', '로봇', '디지털', '앱', '테크', '코딩', '개발', '알고리즘', '플랫폼', 'IT'],
  'lifestyle': ['직장', '이직', '퇴사', '연봉', '면접', '채용', '커리어', '근무', '승진', '워라밸', '건강', '운동', '수면', '다이어트', '여행', '취미', '독서', '커뮤니티', '라이프', '힐링', '공무원', '유튜버'],
  'finance': ['재테크', '투자', '주식', '부동산', '금', '경제', '돈', '자산', '연금', '소비', '절약', '저축', '금리', '환율', '코인', '펀드', '적금', '대출', '커피값', 'tariff', 'economy', 'recession', 'inflation', 'market', 'stock', 'trade', 'price'],
  'policy': ['정부', '국회', '선거', '법안', '정책', '외교', '국방', '재난', '사고', 'government', 'policy', 'regulation', 'law'],
};

function keywordCategorize(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  let bestCat = null;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return bestScore >= 1 ? bestCat : null;
}

function matchCategory(caption, platform) {
  if (!caption) return null;
  const projects = loadCnmProjects();
  const captionNorm = normalizeText(caption);
  if (!captionNorm) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const proj of projects) {
    // 1. Match via snsText
    const snsEntry = proj.snsText[platform];
    if (snsEntry?.text) {
      const snsNorm = normalizeText(snsEntry.text);
      if (snsNorm) {
        const captionFirst = captionNorm.split('\n')[0].trim();
        const snsFirst = snsNorm.split('\n')[0].trim();

        if (captionFirst && snsFirst) {
          if (captionFirst === snsFirst) return proj.category;
          if (captionFirst.length >= 10 && snsFirst.length >= 10) {
            if (captionFirst.includes(snsFirst) || snsFirst.includes(captionFirst)) {
              return proj.category;
            }
          }
        }

        // Fuzzy word overlap
        const captionWords = captionNorm.split(/\s+/).filter(w => w.length >= 2);
        const snsWords = new Set(snsNorm.split(/\s+/).filter(w => w.length >= 2));
        const overlap = captionWords.filter(w => snsWords.has(w)).length;
        const score = overlap / Math.max(captionWords.length, 1);
        if (score > bestScore && score >= 0.3) {
          bestScore = score;
          bestMatch = proj.category;
        }
      }
    }

    // 2. Match via project name
    if (proj.name && captionNorm.includes(proj.name.slice(0, 15))) {
      return proj.category;
    }
  }

  // 3. Fallback: keyword-based categorization
  return bestMatch || keywordCategorize(caption);
}

function syncCategoriesFromCnm() {
  const posts = db.getPosts({});
  let updated = 0;
  for (const post of posts) {
    if (post.category && post.category !== 'other') continue; // skip already categorized
    const matched = matchCategory(post.caption, post.platform);
    if (matched) {
      db.updatePost(post.id, { category: matched });
      updated++;
    }
  }
  return { updated, total: posts.length };
}

// ── Collectors ──

const threadsCollector = require('./collectors/threads');
const instagramCollector = require('./collectors/instagram');
const tiktokBridge = require('./collectors/tiktok-bridge');
const googleTrends = require('./collectors/trends/google-trends');
const naverDatalab = require('./collectors/trends/naver-datalab');
const rssFeed = require('./collectors/trends/rss-feed');
const youtubeTrending = require('./collectors/trends/youtube-trending');

async function runCollector(platform) {
  const cnmConfig = loadCnmConfig();
  const snsAccounts = cnmConfig.snsAccounts || {};
  const logId = db.startCollection(platform);

  try {
    let result;
    switch (platform) {
      case 'threads':
        result = await threadsCollector.collect(snsAccounts.threads, db, fetchJson, matchCategory);
        break;
      case 'instagram':
        result = await instagramCollector.collect(snsAccounts.instagram, db, fetchJson, matchCategory);
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
  ipcMain.handle('get-hashtag-stats', (_, platform, days) => db.getHashtagStats(platform, days || 90));

  // Collection
  ipcMain.handle('collect', (_, platform) => runCollector(platform));
  ipcMain.handle('get-collection-logs', (_, limit) => db.getCollectionLogs(limit || 20));

  // Category sync
  ipcMain.handle('sync-categories', () => syncCategoriesFromCnm());

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
  ipcMain.handle('save-analyzer-settings', (_, settings) => {
    saveAnalyzerSettings(settings);
    setupAutoCollect();
    return true;
  });
  ipcMain.handle('load-analyzer-settings', () => loadAnalyzerSettings());

  // Export
  // PDF Report Export
  ipcMain.handle('export-report', async (_, format) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `sns-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (!filePath) return { success: false, message: 'Cancelled' };

      const pdfData = await mainWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      });
      fs.writeFileSync(filePath, pdfData);
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

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

  // Trends (Google API는 백그라운드 스케줄러 전용 — IPC 미노출)
  ipcMain.handle('fetch-naver-trend', async (_, keywordGroups, days) => {
    try {
      const settings = loadAnalyzerSettings();
      const creds = settings.naverApi;
      const data = await naverDatalab.getSearchTrend(creds, keywordGroups, days || 30);
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
  ipcMain.handle('fetch-naver-news', async (_, query, display) => {
    try {
      const settings = loadAnalyzerSettings();
      const creds = settings.naverApi;
      const data = await naverDatalab.searchNews(creds, query, display || 10);
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
  ipcMain.handle('fetch-naver-shopping', async (_, category, days) => {
    try {
      const settings = loadAnalyzerSettings();
      const creds = settings.naverApi;
      const data = await naverDatalab.getShoppingTrend(creds, category, days || 30);
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
  ipcMain.handle('get-trend-snapshot', (_, source) => db.getLatestTrendSnapshot(source));
  ipcMain.handle('get-trend-snapshots', (_, source, limit) => db.getRecentTrendSnapshots(source, limit || 10));

  // YouTube Trending
  ipcMain.handle('fetch-youtube-trending', async () => {
    try {
      const settings = loadAnalyzerSettings();
      const apiKey = settings.youtubeApiKey;
      const videos = await youtubeTrending.getTrendingVideos(apiKey, 20);
      db.saveTrendSnapshot('youtube', videos);
      const keywords = youtubeTrending.extractVideoKeywords(videos);
      return { success: true, data: videos, keywords };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // Hot Topics (Google News RSS 기반 — Google Trends 대안)
  ipcMain.handle('fetch-hot-topics', async () => {
    try {
      const topics = await rssFeed.collectHotTopics();
      db.saveTrendSnapshot('hot-topics', topics);
      return { success: true, data: topics };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // RSS Feeds
  ipcMain.handle('fetch-policy-feeds', async () => {
    try {
      const feeds = await rssFeed.collectPolicyFeeds();
      const allItems = feeds.flatMap(f => f.items);
      db.saveTrendSnapshot('policy', feeds);
      const keywords = rssFeed.extractKeywords(allItems);
      return { success: true, data: feeds, keywords };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
  ipcMain.handle('fetch-news-feeds', async () => {
    try {
      const feeds = await rssFeed.collectNewsFeeds();
      const allItems = feeds.flatMap(f => f.items);
      db.saveTrendSnapshot('news', feeds);
      const keywords = rssFeed.extractKeywords(allItems);
      return { success: true, data: feeds, keywords };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // DM Webhook
  ipcMain.handle('start-webhook', () => {
    const settings = loadAnalyzerSettings();
    const verifyToken = settings.webhookVerifyToken || 'sns-analyzer-verify-token';
    const appSecret = settings.metaAppSecret || '';

    webhookServer.start(verifyToken, appSecret, (msg) => {
      // DM 수신 시 renderer에 알림
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dm-received', msg);
      }
    });

    return { success: true, port: webhookServer.getPort() };
  });
  ipcMain.handle('stop-webhook', () => { webhookServer.stop(); return { success: true }; });
  ipcMain.handle('get-webhook-port', () => webhookServer.getPort());

  // DM 발송 (Instagram Messaging API)
  ipcMain.handle('send-instagram-dm', async (_, recipientId, text) => {
    try {
      const cnm = loadCnmConfig();
      const ig = cnm.snsAccounts?.instagram;
      if (!ig?.accessToken || !ig?.accountId) throw new Error('Instagram API 토큰 미설정');

      const result = await fetchJson(`https://graph.instagram.com/v21.0/${ig.accountId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
        headers: { 'Authorization': `Bearer ${ig.accessToken}` },
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // DM 대화 목록
  ipcMain.handle('get-instagram-conversations', async () => {
    try {
      const cnm = loadCnmConfig();
      const ig = cnm.snsAccounts?.instagram;
      if (!ig?.accessToken || !ig?.accountId) throw new Error('Instagram API 토큰 미설정');

      const result = await fetchJson(
        `https://graph.instagram.com/v21.0/${ig.accountId}/conversations?fields=id,participants,updated_time&access_token=${ig.accessToken}`
      );
      return { success: true, data: result.data || [] };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // 대화 메시지 조회
  ipcMain.handle('get-instagram-messages', async (_, conversationId) => {
    try {
      const cnm = loadCnmConfig();
      const ig = cnm.snsAccounts?.instagram;
      if (!ig?.accessToken) throw new Error('Instagram API 토큰 미설정');

      const result = await fetchJson(
        `https://graph.instagram.com/v21.0/${conversationId}?fields=messages{id,message,from,created_time}&access_token=${ig.accessToken}`
      );
      return { success: true, data: result.messages?.data || [] };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  createWindow();

  // Webhook 항상 자동 시작
  const webhookSettings = loadAnalyzerSettings();
  const vt = webhookSettings.webhookVerifyToken || 'sns-analyzer-verify-token';
  webhookServer.start(vt, webhookSettings.metaAppSecret || '', (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dm-received', msg);
    }
  });

  // 댓글 → 자동 DM 핸들러 (팔로우 확인 플로우)
  webhookServer.setCommentCallback(async (comment) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('comment-received', comment);
    }

    try {
      const rules = await mainWindow.webContents.executeJavaScript('getAutoReplyRules()');
      const commentText = (comment.text || '').toLowerCase();
      const senderId = comment.from?.id;
      if (!senderId) return;

      for (const rule of rules) {
        if (!rule.enabled) continue;

        // 트리거 조건 확인
        const triggerMatch = rule.trigger === 'all'
          || (rule.trigger === 'keyword' && rule.keywords.some(k => commentText.includes(k.toLowerCase())));

        if (!triggerMatch) continue;

        const cnm = loadCnmConfig();
        const ig = cnm.snsAccounts?.instagram;
        if (!ig?.accessToken || !ig?.accountId) break;

        // 1. 팔로우 상태 확인
        let isFollower = false;
        try {
          const followResp = await fetchJson(
            `https://graph.instagram.com/v21.0/${senderId}?fields=is_following&access_token=${ig.accessToken}`
          );
          isFollower = followResp.is_following === true;
        } catch {
          // API 제한 시 팔로우 확인 실패 → 일단 미팔로우 메시지 발송
          isFollower = false;
        }

        // 2. 팔로우 상태에 따라 다른 메시지 발송
        const message = isFollower ? rule.msgFollow : rule.msgUnfollow;
        const label = isFollower ? '팔로워' : '미팔로워';

        console.log(`[AutoDM] ${label} ${senderId}에게 DM 발송`);

        await fetchJson(`https://graph.instagram.com/v21.0/${ig.accountId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ recipient: { id: senderId }, message: { text: message } }),
          headers: { 'Authorization': `Bearer ${ig.accessToken}` },
        });

        console.log(`[AutoDM] 발송 완료: ${senderId} (${label})`);
        break;
      }
    } catch (err) {
      console.error('[AutoDM] 실패:', err.message);
    }
  });

  // 앱 시작 시 항상 즉시 한 번 수집 (자동 수집 설정과 무관)
  runAutoCollectCycle();

  // 자동 수집 스케줄러 (설정에서 활성화한 경우)
  setupAutoCollect();
});

// ── Auto Collect Scheduler ──

let autoCollectTimer = null;

async function runAutoCollectCycle() {
  console.log(`[AutoCollect] 수집 실행: ${new Date().toLocaleString()}`);
  const cnmConfig = loadCnmConfig();
  const sns = cnmConfig.snsAccounts || {};

  const platforms = [];
  if (sns.threads?.accessToken) platforms.push('threads');
  if (sns.instagram?.accessToken) platforms.push('instagram');

  for (const platform of platforms) {
    try {
      const result = await runCollector(platform);
      console.log(`[AutoCollect] ${platform}: ${result.message}`);
    } catch (err) {
      console.error(`[AutoCollect] ${platform} 실패:`, err.message);
    }
  }

  // RSS 핫 토픽 수집 (기본 트렌드 소스 — 항상 안정적)
  try {
    const hotTopics = await rssFeed.collectHotTopics();
    db.saveTrendSnapshot('hot-topics', hotTopics);
    console.log(`[AutoCollect] 핫 토픽: ${hotTopics.length}개 수집`);

    // 알림: 새 핫 키워드
    const prevHot = db.getRecentTrendSnapshots('hot-topics', 2);
    if (prevHot.length >= 2) {
      const prevKws = new Set(prevHot[1].data.map(t => t.keyword));
      const newKws = hotTopics.filter(t => !prevKws.has(t.keyword)).slice(0, 3);
      if (newKws.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trend-alert', newKws.map(t => t.keyword));
      }
    }
  } catch (err) {
    console.error('[AutoCollect] 핫 토픽 실패:', err.message);
  }

  // Google Trends (2시간 간격, 백그라운드에서만 조용히 시도)
  try {
    const prevSnapshot = db.getLatestTrendSnapshot('google');
    const prevAge = prevSnapshot ? Date.now() - new Date(prevSnapshot.collected_at).getTime() : Infinity;

    if (prevAge >= 2 * 60 * 60 * 1000) { // 2시간
      const trends = await googleTrends.getDailyTrends();
      db.saveTrendSnapshot('google', trends);
      console.log(`[AutoCollect] Google 트렌드: ${trends.length}개 수집`);
    }
  } catch (err) {
    // Google 실패는 조용히 무시 (RSS가 기본)
    console.log('[AutoCollect] Google 트렌드 skip (rate limit)');
  }

  // RSS 정책/뉴스도 수집
  try {
    const policyFeeds = await rssFeed.collectPolicyFeeds();
    db.saveTrendSnapshot('policy', policyFeeds);
    const newsFeeds = await rssFeed.collectNewsFeeds();
    db.saveTrendSnapshot('news', newsFeeds);
    console.log('[AutoCollect] RSS 피드 수집 완료');
  } catch (err) {
    console.error('[AutoCollect] RSS 수집 실패:', err.message);
  }

  // 수집 완료 후 renderer에 알림
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auto-collect-done');
  }
}

function setupAutoCollect() {
  if (autoCollectTimer) {
    clearInterval(autoCollectTimer);
    autoCollectTimer = null;
  }

  const settings = loadAnalyzerSettings();
  // autoCollect가 명시적으로 false인 경우에만 비활성화 (기본: 활성)
  if (settings.autoCollect === false) return;

  const intervalMin = settings.collectInterval || 30;
  const intervalMs = intervalMin * 60 * 1000;

  console.log(`[AutoCollect] 자동 수집 스케줄러 - ${intervalMin}분 간격`);

  // 즉시 실행은 app.whenReady에서 하므로 여기서는 간격만 설정
  autoCollectTimer = setInterval(runAutoCollectCycle, intervalMs);
}

app.on('window-all-closed', () => {
  if (autoCollectTimer) clearInterval(autoCollectTimer);
  webhookServer.stop();
  db.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
