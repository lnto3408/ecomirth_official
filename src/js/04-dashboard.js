// Growth tracking dashboard

async function renderDashboard() {
  const view = document.getElementById('view-dashboard');
  const days = AppState.dashboardPeriod;

  // Fetch data
  const [threadsStats, igStats, tiktokStats, posts] = await Promise.all([
    window.api.getAccountStats('threads', days),
    window.api.getAccountStats('instagram', days),
    window.api.getAccountStats('tiktok', days),
    window.api.getPostsWithLatestMetrics({ days }),
  ]);

  // Summary stats
  const latestFollowers = {};
  for (const p of PLATFORMS) {
    const latest = await window.api.getLatestAccountStats(p);
    latestFollowers[p] = latest?.followers || 0;
  }
  const totalFollowers = Object.values(latestFollowers).reduce((a, b) => a + b, 0);
  const totalPosts = posts.length;
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const avgEngagement = posts.length ? (posts.reduce((s, p) => s + parseFloat(engagementRate(p)), 0) / posts.length).toFixed(2) : 0;

  view.innerHTML = `
    <div class="view-header">
      <h1>성장 대시보드</h1>
      ${renderPeriodSelector(days, 'changeDashboardPeriod')}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">총 팔로워</div>
        <div class="stat-value">${formatNumber(totalFollowers)}</div>
        <div style="margin-top:6px;font-size:11px;color:var(--text-dim)">
          ${PLATFORMS.map(p => `<span class="platform-badge ${p}" style="margin-right:4px">${PLATFORM_LABELS[p]} ${formatNumber(latestFollowers[p])}</span>`).join('')}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">총 포스트 (${days}일)</div>
        <div class="stat-value">${totalPosts}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">총 조회수</div>
        <div class="stat-value">${formatNumber(totalViews)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">평균 참여율</div>
        <div class="stat-value">${avgEngagement}%</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">팔로워 추이</div>
        <div class="chart-container"><canvas id="chart-followers"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">도달/노출 추이</div>
        <div class="chart-container"><canvas id="chart-reach"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">포스트별 성과 (최근 ${days}일)</div>
      <div class="chart-container tall"><canvas id="chart-post-performance"></canvas></div>
    </div>
  `;

  renderFollowersChart(threadsStats, igStats, tiktokStats);
  renderReachChart(threadsStats, igStats, tiktokStats);
  renderPostPerformanceChart(posts);
}

function changeDashboardPeriod(days) {
  AppState.dashboardPeriod = days;
  renderDashboard();
}

function renderFollowersChart(threads, ig, tiktok) {
  destroyChart('chart-followers');
  const ctx = document.getElementById('chart-followers');
  if (!ctx) return;

  const allDates = [...new Set([...threads, ...ig, ...tiktok].map(s => s.date))].sort();

  const makeData = (stats) => {
    const map = Object.fromEntries(stats.map(s => [s.date, s.followers]));
    return allDates.map(d => map[d] || null);
  };

  AppState.charts['chart-followers'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        { label: 'Threads', data: makeData(threads), borderColor: PLATFORM_COLORS.threads, backgroundColor: PLATFORM_COLORS.threads + '20', tension: 0.3, fill: false },
        { label: 'Instagram', data: makeData(ig), borderColor: PLATFORM_COLORS.instagram, backgroundColor: PLATFORM_COLORS.instagram + '20', tension: 0.3, fill: false },
        { label: 'TikTok', data: makeData(tiktok), borderColor: PLATFORM_COLORS.tiktok, backgroundColor: PLATFORM_COLORS.tiktok + '20', tension: 0.3, fill: false },
      ]
    },
    options: chartOptions('팔로워'),
  });
}

function renderReachChart(threads, ig, tiktok) {
  destroyChart('chart-reach');
  const ctx = document.getElementById('chart-reach');
  if (!ctx) return;

  const allDates = [...new Set([...threads, ...ig, ...tiktok].map(s => s.date))].sort();
  const makeData = (stats) => {
    const map = Object.fromEntries(stats.map(s => [s.date, s.total_reach]));
    return allDates.map(d => map[d] || null);
  };

  AppState.charts['chart-reach'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        { label: 'Threads', data: makeData(threads), borderColor: PLATFORM_COLORS.threads, tension: 0.3, fill: true, backgroundColor: PLATFORM_COLORS.threads + '10' },
        { label: 'Instagram', data: makeData(ig), borderColor: PLATFORM_COLORS.instagram, tension: 0.3, fill: true, backgroundColor: PLATFORM_COLORS.instagram + '10' },
        { label: 'TikTok', data: makeData(tiktok), borderColor: PLATFORM_COLORS.tiktok, tension: 0.3, fill: true, backgroundColor: PLATFORM_COLORS.tiktok + '10' },
      ]
    },
    options: chartOptions('도달'),
  });
}

function renderPostPerformanceChart(posts) {
  destroyChart('chart-post-performance');
  const ctx = document.getElementById('chart-post-performance');
  if (!ctx || !posts.length) return;

  const sorted = posts.slice().reverse().slice(-30); // last 30 posts, chronological

  AppState.charts['chart-post-performance'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(p => (p.caption || '').substring(0, 15) + '...'),
      datasets: [
        { label: '좋아요', data: sorted.map(p => p.likes || 0), backgroundColor: '#4a9eff88' },
        { label: '댓글', data: sorted.map(p => p.comments || 0), backgroundColor: '#4caf5088' },
        { label: '공유', data: sorted.map(p => p.shares || 0), backgroundColor: '#ff980088' },
      ]
    },
    options: {
      ...chartOptions(''),
      scales: {
        x: { stacked: true, ticks: { color: '#888', maxRotation: 45 }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#888' }, grid: { color: '#2a2a2a' } }
      }
    },
  });
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { labels: { color: '#888', usePointStyle: true, padding: 16 } },
      tooltip: { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', borderWidth: 1, titleColor: '#fff', bodyColor: '#e0e0e0' },
    },
    scales: {
      x: { ticks: { color: '#888' }, grid: { display: false } },
      y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' }, title: yLabel ? { display: true, text: yLabel, color: '#888' } : undefined },
    },
  };
}
