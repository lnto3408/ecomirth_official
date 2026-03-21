const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Posts
  addPost: (data) => ipcRenderer.invoke('add-post', data),
  updatePost: (id, fields) => ipcRenderer.invoke('update-post', id, fields),
  deletePost: (id) => ipcRenderer.invoke('delete-post', id),
  getPosts: (filters) => ipcRenderer.invoke('get-posts', filters),
  getPostById: (id) => ipcRenderer.invoke('get-post', id),

  // Metrics
  addMetrics: (postId, data) => ipcRenderer.invoke('add-metrics', postId, data),
  getLatestMetrics: (postId) => ipcRenderer.invoke('get-latest-metrics', postId),
  getMetricsHistory: (postId) => ipcRenderer.invoke('get-metrics-history', postId),

  // Account Stats
  upsertAccountStats: (platform, date, data) => ipcRenderer.invoke('upsert-account-stats', platform, date, data),
  getAccountStats: (platform, days) => ipcRenderer.invoke('get-account-stats', platform, days),
  getLatestAccountStats: (platform) => ipcRenderer.invoke('get-latest-account-stats', platform),

  // Analytics
  getPostsWithLatestMetrics: (filters) => ipcRenderer.invoke('get-posts-with-metrics', filters),
  getCategoryStats: (platform, days) => ipcRenderer.invoke('get-category-stats', platform, days),
  getHourlyStats: (platform, days) => ipcRenderer.invoke('get-hourly-stats', platform, days),
  getContentGroupComparison: () => ipcRenderer.invoke('get-content-group-comparison'),

  // Collection
  collect: (platform) => ipcRenderer.invoke('collect', platform),
  getCollectionLogs: (limit) => ipcRenderer.invoke('get-collection-logs', limit),

  // Category sync
  syncCategories: () => ipcRenderer.invoke('sync-categories'),

  // Settings
  getTokenStatus: () => ipcRenderer.invoke('get-token-status'),
  saveAnalyzerSettings: (settings) => ipcRenderer.invoke('save-analyzer-settings', settings),
  loadAnalyzerSettings: () => ipcRenderer.invoke('load-analyzer-settings'),

  // Export
  exportData: (format) => ipcRenderer.invoke('export-data', format),

  // Trends
  // Google Trends API는 프론트에서 호출 금지 — 백그라운드 스케줄러 전용
  fetchNaverTrend: (keywordGroups, days) => ipcRenderer.invoke('fetch-naver-trend', keywordGroups, days),
  fetchNaverNews: (query, display) => ipcRenderer.invoke('fetch-naver-news', query, display),
  getTrendSnapshot: (source) => ipcRenderer.invoke('get-trend-snapshot', source),
  getTrendSnapshots: (source, limit) => ipcRenderer.invoke('get-trend-snapshots', source, limit),
  fetchNaverShopping: (category, days) => ipcRenderer.invoke('fetch-naver-shopping', category, days),
  fetchHotTopics: () => ipcRenderer.invoke('fetch-hot-topics'),
  fetchYoutubeTrending: () => ipcRenderer.invoke('fetch-youtube-trending'),
  fetchPolicyFeeds: () => ipcRenderer.invoke('fetch-policy-feeds'),
  fetchNewsFeeds: () => ipcRenderer.invoke('fetch-news-feeds'),

  // DM / Webhook
  startWebhook: () => ipcRenderer.invoke('start-webhook'),
  stopWebhook: () => ipcRenderer.invoke('stop-webhook'),
  getWebhookPort: () => ipcRenderer.invoke('get-webhook-port'),
  sendInstagramDM: (recipientId, text) => ipcRenderer.invoke('send-instagram-dm', recipientId, text),
  getInstagramConversations: () => ipcRenderer.invoke('get-instagram-conversations'),
  getInstagramMessages: (conversationId) => ipcRenderer.invoke('get-instagram-messages', conversationId),

  // Events
  onAutoCollectDone: (callback) => ipcRenderer.on('auto-collect-done', callback),
  onTrendAlert: (callback) => ipcRenderer.on('trend-alert', (_, keywords) => callback(keywords)),
  onDMReceived: (callback) => ipcRenderer.on('dm-received', (_, msg) => callback(msg)),
  onCommentReceived: (callback) => ipcRenderer.on('comment-received', (_, comment) => callback(comment)),
});
