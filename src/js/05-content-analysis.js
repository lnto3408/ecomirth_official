// Content type analysis

async function renderContentAnalysis() {
  const view = document.getElementById('view-content-analysis');
  const platform = AppState.contentPlatform;

  view.innerHTML = `
    <div class="view-header">
      <h1>콘텐츠 유형별 분석</h1>
    </div>
    ${renderPlatformTabs(platform, 'changeContentPlatform')}
    <div id="content-analysis-body">
      <div style="text-align:center;padding:40px"><span class="spinner"></span></div>
    </div>
  `;

  const platforms = platform === 'all' ? PLATFORMS : [platform];
  const allStats = [];
  for (const p of platforms) {
    const stats = await window.api.getCategoryStats(p, 90);
    allStats.push(...stats.map(s => ({ ...s, platform: p })));
  }

  // Merge by category if showing all platforms
  const byCategory = {};
  for (const s of allStats) {
    if (!byCategory[s.category]) {
      byCategory[s.category] = { category: s.category, count: 0, avg_views: 0, avg_likes: 0, avg_comments: 0, avg_shares: 0, avg_saves: 0, _n: 0 };
    }
    const c = byCategory[s.category];
    c.count += s.count;
    c.avg_views += (s.avg_views || 0) * s.count;
    c.avg_likes += (s.avg_likes || 0) * s.count;
    c.avg_comments += (s.avg_comments || 0) * s.count;
    c.avg_shares += (s.avg_shares || 0) * s.count;
    c.avg_saves += (s.avg_saves || 0) * s.count;
    c._n += s.count;
  }
  const merged = Object.values(byCategory).map(c => ({
    ...c,
    avg_views: c._n ? c.avg_views / c._n : 0,
    avg_likes: c._n ? c.avg_likes / c._n : 0,
    avg_comments: c._n ? c.avg_comments / c._n : 0,
    avg_shares: c._n ? c.avg_shares / c._n : 0,
    avg_saves: c._n ? c.avg_saves / c._n : 0,
  }));

  const body = document.getElementById('content-analysis-body');

  if (!merged.length) {
    body.innerHTML = emptyState(
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      '데이터 없음', '포스트를 추가하고 카테고리를 지정하세요.'
    );
    return;
  }

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-title">카테고리별 평균 참여도</div>
        <div class="chart-container tall"><canvas id="chart-category-engagement"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">카테고리별 포스트 수</div>
        <div class="chart-container tall"><canvas id="chart-category-count"></canvas></div>
      </div>
    </div>
    ${platform === 'all' ? `
    <div class="card">
      <div class="card-title">플랫폼 x 카테고리 비교</div>
      <div class="chart-container tall"><canvas id="chart-platform-category"></canvas></div>
    </div>
    ` : ''}
    <div class="card">
      <div class="card-title">카테고리별 상세</div>
      <table class="data-table">
        <thead><tr>
          <th>카테고리</th><th class="num">포스트</th><th class="num">평균 조회</th>
          <th class="num">평균 좋아요</th><th class="num">평균 댓글</th><th class="num">평균 공유</th>
        </tr></thead>
        <tbody>
          ${merged.map(c => `<tr>
            <td><span class="category-badge ${c.category}">${CATEGORY_LABELS[c.category] || c.category}</span></td>
            <td class="num">${c.count}</td>
            <td class="num">${formatNumber(Math.round(c.avg_views))}</td>
            <td class="num">${formatNumber(Math.round(c.avg_likes))}</td>
            <td class="num">${formatNumber(Math.round(c.avg_comments))}</td>
            <td class="num">${formatNumber(Math.round(c.avg_shares))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Category engagement chart
  destroyChart('chart-category-engagement');
  const cats = merged.map(c => CATEGORY_LABELS[c.category] || c.category);
  AppState.charts['chart-category-engagement'] = new Chart(document.getElementById('chart-category-engagement'), {
    type: 'bar',
    data: {
      labels: cats,
      datasets: [
        { label: '평균 좋아요', data: merged.map(c => Math.round(c.avg_likes)), backgroundColor: '#4a9eff88' },
        { label: '평균 댓글', data: merged.map(c => Math.round(c.avg_comments)), backgroundColor: '#4caf5088' },
        { label: '평균 공유', data: merged.map(c => Math.round(c.avg_shares)), backgroundColor: '#ff980088' },
        { label: '평균 저장', data: merged.map(c => Math.round(c.avg_saves)), backgroundColor: '#e1306c88' },
      ]
    },
    options: { ...chartOptions(''), plugins: { legend: { labels: { color: '#888' } } },
      scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } } }
    },
  });

  // Category count chart
  destroyChart('chart-category-count');
  AppState.charts['chart-category-count'] = new Chart(document.getElementById('chart-category-count'), {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets: [{ data: merged.map(c => c.count), backgroundColor: merged.map(c => CATEGORY_COLORS[c.category] || '#888') }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#888' } } } },
  });

  // Platform x Category comparison
  if (platform === 'all') {
    destroyChart('chart-platform-category');
    const datasets = PLATFORMS.map(p => {
      const pStats = allStats.filter(s => s.platform === p);
      return {
        label: PLATFORM_LABELS[p],
        data: CATEGORIES.map(cat => {
          const found = pStats.find(s => s.category === cat);
          return found ? Math.round(found.avg_likes || 0) : 0;
        }),
        backgroundColor: PLATFORM_COLORS[p] + '88',
      };
    });
    AppState.charts['chart-platform-category'] = new Chart(document.getElementById('chart-platform-category'), {
      type: 'bar',
      data: { labels: CATEGORIES.map(c => CATEGORY_LABELS[c]), datasets },
      options: { ...chartOptions('평균 좋아요'), scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } } } },
    });
  }
}

function changeContentPlatform(platform) {
  AppState.contentPlatform = platform;
  renderContentAnalysis();
}
