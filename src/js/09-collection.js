// Data collection trigger and status

async function renderCollection() {
  const view = document.getElementById('view-collection');
  const tokenStatus = await window.api.getTokenStatus();
  const logs = await window.api.getCollectionLogs(20);

  // 플랫폼별 마지막 수집 시간
  const lastCollect = {};
  for (const log of logs) {
    if (!lastCollect[log.platform] && log.status === 'success') {
      lastCollect[log.platform] = log.completed_at;
    }
  }

  view.innerHTML = `
    <div class="view-header">
      <h1>데이터 수집</h1>
    </div>

    <div style="margin-bottom:24px">
      ${renderCollectionCard('threads', 'T', tokenStatus.threads, lastCollect.threads)}
      ${renderCollectionCard('instagram', 'IG', tokenStatus.instagram, lastCollect.instagram)}
      ${renderCollectionCard('tiktok', 'TT', tokenStatus.tiktok, lastCollect.tiktok)}
    </div>

    <div class="card">
      <div class="card-title">수집 로그</div>
      <div id="collection-logs">
        <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
      </div>
    </div>
  `;

  renderCollectionLogs(logs);
}

function renderCollectionCard(platform, icon, status, lastCollectTime) {
  const hasToken = status?.hasToken || status?.mode === 'emulator';
  const statusText = platform === 'tiktok'
    ? '에뮬레이터 스크래핑'
    : (hasToken ? 'API 연결됨' : 'API 토큰 미설정');
  const statusClass = hasToken ? 'success' : 'error';
  const lastTime = lastCollectTime ? relativeTime(lastCollectTime) : '';

  return `
    <div class="collection-card">
      <div class="platform-icon ${platform}">${icon}</div>
      <div class="collection-info">
        <h4>${PLATFORM_LABELS[platform]}</h4>
        <p>
          <span class="status-dot ${statusClass}"></span>${statusText}
          ${lastTime ? `<span style="margin-left:8px;color:var(--text-dim);font-size:11px">${lastTime}</span>` : ''}
        </p>
      </div>
      <button class="btn-primary" id="collect-btn-${platform}"
        onclick="startCollection('${platform}')"
        ${!hasToken && platform !== 'tiktok' ? 'disabled' : ''}>
        수집 시작
      </button>
    </div>
  `;
}

async function startCollection(platform) {
  const btn = document.getElementById(`collect-btn-${platform}`);
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const result = await window.api.collect(platform);
    if (result.success) {
      showToast(result.message);
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast(`수집 실패: ${err.message}`, 'error');
  }

  btn.disabled = false;
  btn.textContent = '수집 시작';
  renderCollection();
}

async function loadCollectionLogs() {
  const logs = await window.api.getCollectionLogs(20);
  renderCollectionLogs(logs);
}

function renderCollectionLogs(logs) {
  const container = document.getElementById('collection-logs');
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">아직 수집 기록이 없습니다.</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>플랫폼</th><th>상태</th><th>메시지</th><th class="num">신규</th><th>시작</th><th>완료</th>
      </tr></thead>
      <tbody>
        ${logs.map(log => `<tr>
          <td><span class="platform-badge ${log.platform}">${PLATFORM_LABELS[log.platform]}</span></td>
          <td><span class="status-dot ${log.status}"></span>${log.status === 'success' ? '성공' : log.status === 'error' ? '실패' : '진행중'}</td>
          <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${log.message || '-'}</td>
          <td class="num">${log.posts_updated}</td>
          <td>${formatDateTime(log.started_at)}</td>
          <td>${log.completed_at ? formatDateTime(log.completed_at) : '-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}
