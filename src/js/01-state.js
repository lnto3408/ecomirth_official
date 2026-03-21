// Global app state
const AppState = {
  currentView: 'dashboard',
  charts: {},          // Chart.js instances by id
  dashboardPeriod: 30, // 7, 30, 90
  postPerformanceSort: 'time', // 'time' | 'likes' | 'comments' | 'shares' | 'total'
  contentPlatform: 'all',
  timePlatform: 'all',
  tokenStatus: null,
  settings: null,
};

const PLATFORMS = ['threads', 'instagram', 'tiktok'];
const PLATFORM_LABELS = { threads: 'Threads', instagram: 'Instagram', tiktok: 'TikTok' };
const PLATFORM_COLORS = { threads: '#ffffff', instagram: '#e1306c', tiktok: '#00f2ea' };

const CATEGORIES = ['policy', 'finance', 'trend', 'lifestyle', 'tech', 'other'];
const CATEGORY_LABELS = {
  policy: '정부/정책', finance: '금융/혜택', trend: '트렌드',
  lifestyle: '라이프스타일', tech: '기술/IT', other: '기타'
};
const CATEGORY_COLORS = {
  policy: '#ff9800', finance: '#4caf50', trend: '#4a9eff',
  lifestyle: '#e1306c', tech: '#00f2ea', other: '#888'
};
