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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">포스트별 성과 (최근 ${days}일)</div>
        <div class="period-selector">
          ${[['time','시간순'],['likes','좋아요'],['comments','댓글'],['shares','공유'],['total','종합']].map(([k,l]) =>
            `<button class="period-btn ${AppState.postPerformanceSort === k ? 'active' : ''}" onclick="changePostPerfSort('${k}')">${l}</button>`
          ).join('')}
        </div>
      </div>
      <div class="chart-container tall"><canvas id="chart-post-performance"></canvas></div>
    </div>

    <div class="card" id="dashboard-trend-widget">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">핫 트렌드</div>
        <button class="btn-secondary btn-small" onclick="switchView('trends')">트렌드 분석 →</button>
      </div>
      <div id="dashboard-trend-content" style="color:var(--text-dim);font-size:13px">로딩 중...</div>
    </div>
  `;

  AppState._dashboardPosts = posts;
  renderFollowersChart(threadsStats, igStats, tiktokStats);
  renderReachChart(threadsStats, igStats, tiktokStats);
  renderPostPerformanceChart(posts);
  loadDashboardTrendWidget();
}

async function loadDashboardTrendWidget() {
  const container = document.getElementById('dashboard-trend-content');
  if (!container) return;

  try {
    // 핫 토픽 (RSS 기반, DB 캐시)
    const snapshot = await window.api.getTrendSnapshot('hot-topics');
    if (!snapshot?.data?.length) {
      container.innerHTML = '<span style="color:var(--text-dim)">트렌드 데이터 수집 중... 트렌드 탭에서 새로고침하세요.</span>';
      return;
    }

    const topics = snapshot.data.slice(0, 8);
    container.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${topics.map((t, i) => `
          <span class="keyword-tag" style="font-size:12px;padding:4px 10px" onclick="switchView('trends')">
            <span style="color:var(--accent);font-weight:600;margin-right:3px">${i+1}</span>
            ${t.keyword}
            ${t.traffic ? `<span style="font-size:10px;color:var(--text-dim);margin-left:3px">${t.traffic}</span>` : ''}
          </span>
        `).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:8px">업데이트: ${relativeTime(snapshot.collected_at)}</div>
    `;
  } catch {
    container.innerHTML = '<span style="color:var(--text-dim)">트렌드 위젯 로딩 실패</span>';
  }
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

  let sorted = posts.slice().reverse().slice(-30); // last 30 posts, chronological

  const sortKey = AppState.postPerformanceSort;
  if (sortKey === 'likes') {
    sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sortKey === 'comments') {
    sorted.sort((a, b) => (b.comments || 0) - (a.comments || 0));
  } else if (sortKey === 'shares') {
    sorted.sort((a, b) => (b.shares || 0) - (a.shares || 0));
  } else if (sortKey === 'total') {
    const total = p => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
    sorted.sort((a, b) => total(b) - total(a));
  }
  // 'time' keeps chronological order

  AppState._chartPostMap = sorted;

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
      },
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const post = AppState._chartPostMap[idx];
        if (post) showPostDetail(post.id);
      },
      onHover(evt, elements) {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
    },
  });
}

function changePostPerfSort(key) {
  AppState.postPerformanceSort = key;
  // Update button active states
  const card = document.getElementById('chart-post-performance')?.closest('.card');
  if (card) {
    card.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === {time:'시간순',likes:'좋아요',comments:'댓글',shares:'공유',total:'종합'}[key]);
    });
  }
  if (AppState._dashboardPosts) {
    renderPostPerformanceChart(AppState._dashboardPosts);
  }
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
