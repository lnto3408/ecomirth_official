// Weekly Report view

async function renderReport() {
  const view = document.getElementById('view-report');

  // Date range: this week (Mon ~ Sun) ending today
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const fmtShort = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const dateRange = `${fmtShort(startDate)} ~ ${fmtShort(endDate)}`;

  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];

  view.innerHTML = `
    <div class="view-header">
      <h1>주간 리포트 (${dateRange})</h1>
      <button class="btn-primary btn-small" onclick="exportReportPDF()">PDF 내보내기</button>
    </div>
    <div style="text-align:center;padding:40px;color:var(--text-dim)"><div class="spinner"></div> 데이터 로딩 중...</div>
  `;

  try {
    // Fetch all data in parallel
    const [posts, threadsStats, igStats, tiktokStats, hotTopics, categoryStats] = await Promise.all([
      window.api.getPostsWithLatestMetrics({ days: 7 }),
      window.api.getAccountStats('threads', 7),
      window.api.getAccountStats('instagram', 7),
      window.api.getAccountStats('tiktok', 7),
      window.api.getTrendSnapshot('hot-topics'),
      Promise.all(PLATFORMS.map(p => window.api.getCategoryStats(p, 7))),
    ]);

    // --- KPI Calculations ---
    const totalNewPosts = posts.length;
    const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);

    // Follower change
    const calcFollowerChange = (stats) => {
      if (!stats || stats.length < 2) return 0;
      const sorted = stats.slice().sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].followers || 0;
      const last = sorted[sorted.length - 1].followers || 0;
      return last - first;
    };
    const followerChange = calcFollowerChange(threadsStats) + calcFollowerChange(igStats) + calcFollowerChange(tiktokStats);
    const followerChangeStr = followerChange >= 0 ? `+${formatNumber(followerChange)}` : formatNumber(followerChange);
    const followerChangeClass = followerChange >= 0 ? 'positive' : 'negative';

    // --- Top 3 Posts ---
    const topPosts = posts.slice()
      .sort((a, b) => ((b.likes || 0) + (b.views || 0)) - ((a.likes || 0) + (a.views || 0)))
      .slice(0, 3);

    const topPostsHTML = topPosts.length
      ? topPosts.map((p, i) => {
          const caption = (p.caption || '').substring(0, 40) + ((p.caption || '').length > 40 ? '...' : '');
          const platform = p.platform || 'threads';
          return `
            <div class="report-top-item" onclick="showPostDetail && showPostDetail(${p.id})">
              <div class="report-top-rank">${i + 1}</div>
              <div class="report-top-content">
                <div class="report-top-caption">
                  <span class="platform-badge ${platform}" style="margin-right:6px;font-size:10px">${PLATFORM_LABELS[platform] || platform}</span>
                  ${caption}
                </div>
                <div class="report-top-metrics">
                  <span style="color:var(--danger)">&#9829; ${formatNumber(p.likes || 0)}</span>
                  <span style="color:var(--text-dim)">&#128065; ${formatNumber(p.views || 0)}</span>
                  <span style="color:var(--text-dim)">&#128172; ${formatNumber(p.comments || 0)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')
      : '<div style="color:var(--text-dim);font-size:13px;padding:12px">이번 주 포스트 데이터가 없습니다.</div>';

    // --- Category Stats ---
    const catMap = {};
    categoryStats.flat().forEach(c => {
      const cat = c.category || 'other';
      if (!catMap[cat]) catMap[cat] = { count: 0, likes: 0, views: 0 };
      catMap[cat].count += (c.post_count || 0);
      catMap[cat].likes += (c.total_likes || 0);
      catMap[cat].views += (c.total_views || 0);
    });
    const catEntries = Object.entries(catMap).sort((a, b) => b[1].views - a[1].views);

    // --- Trend Keywords ---
    const trendKeywords = (hotTopics?.data || []).slice(0, 6);
    const trendHTML = trendKeywords.length
      ? `<div class="keyword-cloud">${trendKeywords.map(t =>
          `<span class="keyword-tag">${t.keyword}</span>`
        ).join('')}</div>`
      : '<div style="color:var(--text-dim);font-size:13px">트렌드 데이터가 없습니다. 트렌드 탭에서 수집을 실행하세요.</div>';

    // --- Best posting days (by engagement) ---
    const dowStats = {};
    posts.forEach(p => {
      const d = new Date(p.posted_at || p.created_at);
      const dow = d.getDay(); // 0=Sun
      if (!dowStats[dow]) dowStats[dow] = { total: 0, count: 0 };
      dowStats[dow].total += (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
      dowStats[dow].count += 1;
    });
    const dowAvg = Object.entries(dowStats)
      .map(([dow, s]) => ({ dow: parseInt(dow), avg: s.count ? s.total / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
    const bestDays = dowAvg.slice(0, 2).map(d => DOW_LABELS[d.dow]);
    const bestDaysStr = bestDays.length ? bestDays.join(', ') : '-';

    // --- Recommended keywords from top performing categories ---
    const topCats = catEntries.slice(0, 2).map(([cat]) => CATEGORY_LABELS[cat] || cat);
    const recommendKeywords = trendKeywords.slice(0, 3).map(t => t.keyword);
    const recommendKeywordsStr = recommendKeywords.length ? recommendKeywords.join(', ') : '-';

    // --- Render ---
    view.innerHTML = `
      <div class="view-header">
        <h1>주간 리포트 (${dateRange})</h1>
      </div>

      <div class="report-grid">
        <div class="report-card report-kpi">
          <div class="report-card-label">신규 포스트</div>
          <div class="report-card-value">${totalNewPosts}</div>
        </div>
        <div class="report-card report-kpi">
          <div class="report-card-label">총 조회수</div>
          <div class="report-card-value">${formatNumber(totalViews)}</div>
        </div>
        <div class="report-card report-kpi">
          <div class="report-card-label">총 좋아요</div>
          <div class="report-card-value">${formatNumber(totalLikes)}</div>
        </div>
        <div class="report-card report-kpi">
          <div class="report-card-label">팔로워 변화</div>
          <div class="report-card-value ${followerChangeClass}">${followerChangeStr}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">성과 TOP 3 포스트</div>
          <div class="report-top-list">
            ${topPostsHTML}
          </div>
        </div>

        <div class="card">
          <div class="card-title">카테고리별 성과</div>
          <div class="chart-container" style="height:220px"><canvas id="chart-report-category"></canvas></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">이번 주 트렌드 키워드</div>
          ${trendHTML}
          ${hotTopics?.collected_at ? `<div style="font-size:11px;color:var(--text-dim);margin-top:8px">업데이트: ${relativeTime(hotTopics.collected_at)}</div>` : ''}
        </div>

        <div class="card">
          <div class="card-title">다음 주 추천</div>
          <div class="report-recommend-list">
            <div class="report-recommend-item">
              <div class="report-recommend-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <div class="report-recommend-label">최적 발행 요일</div>
                <div class="report-recommend-value">${bestDaysStr}</div>
              </div>
            </div>
            <div class="report-recommend-item">
              <div class="report-recommend-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
              <div>
                <div class="report-recommend-label">추천 키워드</div>
                <div class="report-recommend-value">${recommendKeywordsStr}</div>
              </div>
            </div>
            <div class="report-recommend-item">
              <div class="report-recommend-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div>
                <div class="report-recommend-label">주력 카테고리</div>
                <div class="report-recommend-value">${topCats.length ? topCats.join(', ') : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // --- Category Bar Chart ---
    renderReportCategoryChart(catEntries);

  } catch (err) {
    console.error('Report render error:', err);
    view.innerHTML = `
      <div class="view-header"><h1>주간 리포트</h1></div>
      ${emptyState(
        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
        '리포트 로딩 실패',
        err.message || '데이터를 불러오는 중 오류가 발생했습니다.'
      )}
    `;
  }
}

function renderReportCategoryChart(catEntries) {
  destroyChart('chart-report-category');
  const ctx = document.getElementById('chart-report-category');
  if (!ctx || !catEntries.length) return;

  const labels = catEntries.map(([cat]) => CATEGORY_LABELS[cat] || cat);
  const views = catEntries.map(([, s]) => s.views);
  const likes = catEntries.map(([, s]) => s.likes);
  const colors = catEntries.map(([cat]) => CATEGORY_COLORS[cat] || '#888');

  AppState.charts['chart-report-category'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '조회수',
          data: views,
          backgroundColor: colors.map(c => c + '88'),
          borderColor: colors,
          borderWidth: 1,
        },
        {
          label: '좋아요',
          data: likes,
          backgroundColor: colors.map(c => c + '44'),
          borderColor: colors.map(c => c + '88'),
          borderWidth: 1,
        },
      ],
    },
    options: {
      ...chartOptions(''),
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#888', font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

async function exportReportPDF() {
  try {
    showToast('PDF 생성 중...');
    const result = await window.api.exportReport('pdf');
    if (result.success) {
      showToast(`PDF 저장됨: ${result.path}`);
    } else {
      showToast(result.message || 'PDF 생성 실패', 'error');
    }
  } catch (err) {
    showToast('PDF 내보내기 실패: ' + err.message, 'error');
  }
}
