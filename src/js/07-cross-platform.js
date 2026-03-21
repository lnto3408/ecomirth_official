// Cross-platform comparison (content_group based)

async function renderCrossPlatform() {
  const view = document.getElementById('view-cross-platform');

  view.innerHTML = `
    <div class="view-header">
      <h1>플랫폼 간 교차 비교</h1>
    </div>
    <div id="cross-platform-body">
      <div style="text-align:center;padding:40px"><span class="spinner"></span></div>
    </div>
  `;

  let data = [];
  try {
    data = await window.api.getContentGroupComparison();
  } catch (err) {
    console.error('getContentGroupComparison 실패:', err.message);
  }
  const body = document.getElementById('cross-platform-body');

  if (!data.length) {
    body.innerHTML = emptyState(
      '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>',
      '교차 비교 데이터 없음', '같은 content_group을 가진 포스트를 여러 플랫폼에 등록하세요.'
    );
    return;
  }

  // Group by content_group
  const groups = {};
  for (const row of data) {
    if (!row.content_group) continue;
    if (!groups[row.content_group]) groups[row.content_group] = {};
    groups[row.content_group][row.platform] = row;
  }

  // Filter groups that have 2+ platforms
  const multiPlatformGroups = Object.entries(groups)
    .filter(([_, platforms]) => Object.keys(platforms).length >= 2)
    .sort((a, b) => {
      const aDate = Object.values(a[1])[0]?.posted_at || '';
      const bDate = Object.values(b[1])[0]?.posted_at || '';
      return bDate.localeCompare(aDate);
    });

  if (!multiPlatformGroups.length) {
    body.innerHTML = emptyState(
      '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>',
      '비교 가능한 그룹 없음', '동일 콘텐츠를 2개 이상 플랫폼에 게시하고 같은 content_group을 지정하세요.'
    );
    return;
  }

  body.innerHTML = `
    <div class="card">
      <div class="card-title">레이더 차트 비교</div>
      <div class="chart-container tall"><canvas id="chart-radar-compare"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">콘텐츠 그룹별 성과 비교</div>
      <table class="data-table">
        <thead><tr>
          <th>콘텐츠 그룹</th><th>카테고리</th>
          ${PLATFORMS.map(p => `<th class="num">${PLATFORM_LABELS[p]} 좋아요</th>`).join('')}
          ${PLATFORMS.map(p => `<th class="num">${PLATFORM_LABELS[p]} 조회</th>`).join('')}
        </tr></thead>
        <tbody>
          ${multiPlatformGroups.map(([group, platforms]) => {
            const cat = Object.values(platforms)[0]?.category || 'other';
            return `<tr>
              <td>${group}</td>
              <td><span class="category-badge ${cat}">${CATEGORY_LABELS[cat] || cat}</span></td>
              ${PLATFORMS.map(p => `<td class="num">${platforms[p] ? formatNumber(platforms[p].likes || 0) : '-'}</td>`).join('')}
              ${PLATFORMS.map(p => `<td class="num">${platforms[p] ? formatNumber(platforms[p].views || 0) : '-'}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  renderRadarChart(multiPlatformGroups);
}

function renderRadarChart(groups) {
  destroyChart('chart-radar-compare');
  const ctx = document.getElementById('chart-radar-compare');
  if (!ctx) return;

  // Use the first 5 content groups for the radar
  const topGroups = groups.slice(0, 5);
  const labels = topGroups.map(([name]) => name.length > 20 ? name.substring(0, 20) + '...' : name);

  const datasets = PLATFORMS.map(p => ({
    label: PLATFORM_LABELS[p],
    data: topGroups.map(([_, platforms]) => {
      const post = platforms[p];
      if (!post) return 0;
      return (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
    }),
    borderColor: PLATFORM_COLORS[p],
    backgroundColor: PLATFORM_COLORS[p] + '20',
    pointBackgroundColor: PLATFORM_COLORS[p],
  }));

  AppState.charts['chart-radar-compare'] = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#888' } } },
      scales: {
        r: {
          ticks: { color: '#888', backdropColor: 'transparent' },
          grid: { color: '#2a2a2a' },
          pointLabels: { color: '#aaa', font: { size: 11 } },
        }
      }
    },
  });
}
