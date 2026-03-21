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
    try {
      const stats = await window.api.getCategoryStats(p, 90);
      allStats.push(...stats.map(s => ({ ...s, platform: p })));
    } catch (err) {
      console.error(`getCategoryStats(${p}) 실패:`, err.message);
    }
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
  if (!body) return;

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
  const engCtx = document.getElementById('chart-category-engagement');
  if (!engCtx) return;
  AppState.charts['chart-category-engagement'] = new Chart(engCtx, {
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
  const countCtx = document.getElementById('chart-category-count');
  if (!countCtx) return;
  AppState.charts['chart-category-count'] = new Chart(countCtx, {
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
    const platCatCtx = document.getElementById('chart-platform-category');
    if (!platCatCtx) return;
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
    AppState.charts['chart-platform-category'] = new Chart(platCatCtx, {
      type: 'bar',
      data: { labels: CATEGORIES.map(c => CATEGORY_LABELS[c]), datasets },
      options: { ...chartOptions('평균 좋아요'), scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } } } },
    });
  }

  // Hashtag analysis section
  await renderHashtagAnalysis(body, platform);
}

async function renderHashtagAnalysis(container, platform) {
  const platforms = platform === 'all' ? PLATFORMS : [platform];
  const allHashtags = {};
  const allPairs = {};

  for (const p of platforms) {
    try {
      const result = await window.api.getHashtagStats(p, 90);
      for (const h of result.hashtags) {
        const key = h.hashtag.toLowerCase();
        if (!allHashtags[key]) {
          allHashtags[key] = { hashtag: h.hashtag, count: 0, total_likes: 0, total_views: 0, total_engagement: 0 };
        }
        allHashtags[key].count += h.count;
        allHashtags[key].total_likes += h.avg_likes * h.count;
        allHashtags[key].total_views += h.avg_views * h.count;
        allHashtags[key].total_engagement += h.avg_engagement * h.count;
      }
      for (const p2 of result.pairs) {
        if (!allPairs[p2.pair]) {
          allPairs[p2.pair] = { pair: p2.pair, count: 0, total_engagement: 0 };
        }
        allPairs[p2.pair].count += p2.count;
        allPairs[p2.pair].total_engagement += p2.avg_engagement * p2.count;
      }
    } catch (err) {
      console.error(`getHashtagStats(${p}) 실패:`, err.message);
    }
  }

  const hashtags = Object.values(allHashtags).map(h => ({
    hashtag: h.hashtag,
    count: h.count,
    avg_likes: h.count ? Math.round(h.total_likes / h.count) : 0,
    avg_views: h.count ? Math.round(h.total_views / h.count) : 0,
    avg_engagement: h.count ? Math.round(h.total_engagement / h.count) : 0,
  })).sort((a, b) => b.avg_engagement - a.avg_engagement);

  const pairs = Object.values(allPairs).map(p => ({
    pair: p.pair,
    count: p.count,
    avg_engagement: p.count ? Math.round(p.total_engagement / p.count) : 0,
  })).sort((a, b) => b.avg_engagement - a.avg_engagement).slice(0, 10);

  if (!hashtags.length) return;

  const top10 = hashtags.slice(0, 10);

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="section-divider">
      <h2 class="section-title">해시태그 성과 분석</h2>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">TOP 10 해시태그 (평균 참여도)</div>
        <div class="chart-container tall"><canvas id="chart-hashtag-engagement"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">베스트 해시태그 조합</div>
        ${pairs.length ? `
        <table class="data-table">
          <thead><tr>
            <th>해시태그 조합</th><th class="num">포스트</th><th class="num">평균 참여도</th>
          </tr></thead>
          <tbody>
            ${pairs.map(p => `<tr>
              <td class="hashtag-pair-cell">${p.pair}</td>
              <td class="num">${p.count}</td>
              <td class="num">${formatNumber(p.avg_engagement)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ` : '<div style="padding:24px;text-align:center;color:var(--text-dim)">2회 이상 함께 사용된 조합이 없습니다.</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">해시태그별 상세 성과</div>
      <div class="hashtag-table-scroll">
        <table class="data-table" id="hashtag-stats-table">
          <thead><tr>
            <th data-sort="hashtag">해시태그</th>
            <th class="num" data-sort="count">포스트</th>
            <th class="num" data-sort="avg_likes">평균 좋아요</th>
            <th class="num" data-sort="avg_views">평균 조회</th>
            <th class="num" data-sort="avg_engagement">평균 참여도</th>
          </tr></thead>
          <tbody>
            ${hashtags.slice(0, 20).map(h => `<tr>
              <td><span class="hashtag-badge">${h.hashtag}</span></td>
              <td class="num">${h.count}</td>
              <td class="num">${formatNumber(h.avg_likes)}</td>
              <td class="num">${formatNumber(h.avg_views)}</td>
              <td class="num">${formatNumber(h.avg_engagement)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.appendChild(section);

  // Hashtag engagement bar chart
  destroyChart('chart-hashtag-engagement');
  const engCtx = document.getElementById('chart-hashtag-engagement');
  if (!engCtx) return;

  const barColors = top10.map((_, i) => {
    const colors = ['#4a9eff', '#4caf50', '#ff9800', '#e1306c', '#9c27b0', '#00bcd4', '#ff5722', '#8bc34a', '#ffc107', '#607d8b'];
    return colors[i % colors.length] + 'cc';
  });

  AppState.charts['chart-hashtag-engagement'] = new Chart(engCtx, {
    type: 'bar',
    data: {
      labels: top10.map(h => h.hashtag),
      datasets: [{
        label: '평균 참여도',
        data: top10.map(h => h.avg_engagement),
        backgroundColor: barColors,
        borderRadius: 4,
      }]
    },
    options: {
      ...chartOptions(''),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', borderWidth: 1, titleColor: '#fff', bodyColor: '#e0e0e0' },
      },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#ccc', font: { size: 12 } }, grid: { display: false } },
      },
    },
  });

  // Sortable headers
  const table = document.getElementById('hashtag-stats-table');
  if (table) {
    let currentSort = { key: 'avg_engagement', asc: false };
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (currentSort.key === key) currentSort.asc = !currentSort.asc;
        else { currentSort.key = key; currentSort.asc = false; }

        const sorted = [...hashtags].sort((a, b) => {
          const va = a[key], vb = b[key];
          if (typeof va === 'string') return currentSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
          return currentSort.asc ? va - vb : vb - va;
        });

        const tbody = table.querySelector('tbody');
        tbody.innerHTML = sorted.slice(0, 20).map(h => `<tr>
          <td><span class="hashtag-badge">${h.hashtag}</span></td>
          <td class="num">${h.count}</td>
          <td class="num">${formatNumber(h.avg_likes)}</td>
          <td class="num">${formatNumber(h.avg_views)}</td>
          <td class="num">${formatNumber(h.avg_engagement)}</td>
        </tr>`).join('');

        table.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');
      });
    });
  }
}

function changeContentPlatform(platform) {
  AppState.contentPlatform = platform;
  renderContentAnalysis();
}
