// Time-based analysis (heatmap)

async function renderTimeAnalysis() {
  const view = document.getElementById('view-time-analysis');
  const platform = AppState.timePlatform;

  view.innerHTML = `
    <div class="view-header">
      <h1>시간대/요일별 분석</h1>
    </div>
    ${renderPlatformTabs(platform, 'changeTimePlatform')}
    <div id="time-analysis-body">
      <div style="text-align:center;padding:40px"><span class="spinner"></span></div>
    </div>
  `;

  const platforms = platform === 'all' ? PLATFORMS : [platform];
  const allData = [];
  for (const p of platforms) {
    try {
      const stats = await window.api.getHourlyStats(p, 90);
      allData.push(...stats);
    } catch (err) {
      console.error(`getHourlyStats(${p}) 실패:`, err.message);
    }
  }

  const body = document.getElementById('time-analysis-body');

  if (!allData.length) {
    // 데이터 없는 이유 확인
    let posts = [];
    try { posts = await window.api.getPostsWithLatestMetrics({ days: 90 }); } catch {}
    body.innerHTML = emptyState(
      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      '데이터 없음',
      posts.length > 0
        ? `포스트 ${posts.length}개가 있지만 시간 데이터가 없습니다. 포스트의 발행 시간(posted_at)을 확인하세요.`
        : '포스트가 쌓이면 최적 발행 시간을 분석합니다.'
    );
    return;
  }

  // Aggregate into dow x hour grid
  const grid = {}; // key: "dow-hour"
  let maxVal = 0;
  for (const d of allData) {
    const key = `${d.dow}-${d.hour}`;
    if (!grid[key]) grid[key] = { count: 0, avg_likes: 0, total_likes: 0 };
    grid[key].count += d.count;
    grid[key].total_likes += (d.avg_likes || 0) * d.count;
    grid[key].avg_likes = grid[key].total_likes / grid[key].count;
    if (grid[key].avg_likes > maxVal) maxVal = grid[key].avg_likes;
  }

  // Find best time slots
  const slots = Object.entries(grid)
    .map(([k, v]) => { const [dow, hour] = k.split('-').map(Number); return { dow, hour, ...v }; })
    .sort((a, b) => b.avg_likes - a.avg_likes);

  const bestSlots = slots.slice(0, 5);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-title">요일 x 시간 히트맵 (평균 좋아요)</div>
        <div id="heatmap-container"></div>
      </div>
      <div class="card">
        <div class="card-title">최적 발행 시간 TOP 5</div>
        <table class="data-table">
          <thead><tr><th>요일</th><th>시간</th><th class="num">포스트 수</th><th class="num">평균 좋아요</th></tr></thead>
          <tbody>
            ${bestSlots.map(s => `<tr>
              <td>${DOW_LABELS[s.dow]}</td>
              <td>${String(s.hour).padStart(2,'0')}:00</td>
              <td class="num">${s.count}</td>
              <td class="num">${formatNumber(Math.round(s.avg_likes))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:16px">
          <div class="card-title">시간대별 포스트 분포</div>
          <div class="chart-container"><canvas id="chart-hourly-dist"></canvas></div>
        </div>
      </div>
    </div>
  `;

  renderHeatmap(grid, maxVal);
  renderHourlyDistChart(allData);
}

function renderHeatmap(grid, maxVal) {
  const container = document.getElementById('heatmap-container');
  if (!container) return;

  // Header row (hours)
  let html = '<div class="heatmap-grid">';
  html += '<div class="heatmap-label"></div>';
  for (let h = 0; h < 24; h++) {
    html += `<div class="heatmap-label">${h}</div>`;
  }

  // Data rows (days)
  for (let dow = 0; dow < 7; dow++) {
    html += `<div class="heatmap-label">${DOW_LABELS[dow]}</div>`;
    for (let h = 0; h < 24; h++) {
      const cell = grid[`${dow}-${h}`];
      const val = cell ? cell.avg_likes : 0;
      const intensity = maxVal > 0 ? val / maxVal : 0;
      const bg = intensity > 0
        ? `rgba(74, 158, 255, ${0.1 + intensity * 0.8})`
        : 'rgba(255,255,255,0.03)';
      const text = cell ? cell.count : '';
      html += `<div class="heatmap-cell" style="background:${bg}" title="${DOW_LABELS[dow]} ${h}시 - ${cell ? cell.count + '개 포스트, 평균 ' + Math.round(val) + ' 좋아요' : '데이터 없음'}">${text}</div>`;
    }
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderHourlyDistChart(allData) {
  destroyChart('chart-hourly-dist');
  const ctx = document.getElementById('chart-hourly-dist');
  if (!ctx) return;

  const hourly = Array(24).fill(0);
  for (const d of allData) hourly[d.hour] += d.count;

  AppState.charts['chart-hourly-dist'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length:24}, (_, i) => `${i}시`),
      datasets: [{ label: '포스트 수', data: hourly, backgroundColor: '#4a9eff55', borderColor: '#4a9eff', borderWidth: 1 }]
    },
    options: { ...chartOptions(''), plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } } }
    },
  });
}

function changeTimePlatform(platform) {
  AppState.timePlatform = platform;
  renderTimeAnalysis();
}
