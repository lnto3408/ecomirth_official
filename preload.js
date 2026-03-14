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

  // Settings
  getTokenStatus: () => ipcRenderer.invoke('get-token-status'),
  saveAnalyzerSettings: (settings) => ipcRenderer.invoke('save-analyzer-settings', settings),
  loadAnalyzerSettings: () => ipcRenderer.invoke('load-analyzer-settings'),

  // Export
  exportData: (format) => ipcRenderer.invoke('export-data', format),
});
