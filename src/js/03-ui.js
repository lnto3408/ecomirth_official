// View switching and sidebar

function switchView(viewName) {
  AppState.currentView = viewName;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn[data-view]').forEach(b => b.classList.remove('active'));

  const view = document.querySelector(`.view[data-view="${viewName}"]`);
  const btn = document.querySelector(`.sidebar-btn[data-view="${viewName}"]`);
  if (view) view.classList.add('active');
  if (btn) btn.classList.add('active');

  // Trigger view render
  const renderers = {
    'dashboard': renderDashboard,
    'content-analysis': renderContentAnalysis,
    'time-analysis': renderTimeAnalysis,
    'cross-platform': renderCrossPlatform,
    'posts': renderPosts,
    'collection': renderCollection,
    'settings': renderSettings,
  };
  if (renderers[viewName]) renderers[viewName]();
}

function initSidebar() {
  document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-export')?.addEventListener('click', showExportMenu);
}

async function showExportMenu() {
  const format = await showExportDialog();
  if (!format) return;
  try {
    const result = await window.api.exportData(format);
    if (result.success) showToast(`${format.toUpperCase()} 내보내기 완료`);
  } catch (err) {
    showToast('내보내기 실패: ' + err.message, 'error');
  }
}

function showExportDialog() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width:320px">
        <div class="modal-title">데이터 내보내기</div>
        <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">내보내기 형식을 선택하세요.</p>
        <div class="modal-actions" style="justify-content:center;gap:12px">
          <button class="btn-primary" data-fmt="csv">CSV</button>
          <button class="btn-primary" data-fmt="json">JSON</button>
          <button class="btn-secondary" data-fmt="">취소</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      const fmt = e.target.dataset?.fmt;
      if (fmt !== undefined) { overlay.remove(); resolve(fmt || null); }
    });
    document.body.appendChild(overlay);
  });
}

function renderPlatformTabs(selected, onChange) {
  const tabs = [{ key: 'all', label: '전체' }, ...PLATFORMS.map(p => ({ key: p, label: PLATFORM_LABELS[p] }))];
  return `<div class="tab-bar">${tabs.map(t =>
    `<button class="tab-btn ${selected === t.key ? 'active' : ''}" onclick="${onChange}('${t.key}')">${t.label}</button>`
  ).join('')}</div>`;
}

function renderPeriodSelector(selected, onChange) {
  const periods = [{ days: 7, label: '7일' }, { days: 30, label: '30일' }, { days: 90, label: '90일' }];
  return `<div class="period-selector">${periods.map(p =>
    `<button class="period-btn ${selected === p.days ? 'active' : ''}" onclick="${onChange}(${p.days})">${p.label}</button>`
  ).join('')}</div>`;
}
