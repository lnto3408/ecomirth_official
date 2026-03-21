// Settings: token status, categories, scheduler

async function renderSettings() {
  const view = document.getElementById('view-settings');
  const tokenStatus = await window.api.getTokenStatus();
  const settings = await window.api.loadAnalyzerSettings();

  const categories = settings.categories || CATEGORIES;
  const autoCollect = settings.autoCollect || false;
  const collectInterval = settings.collectInterval || 1;

  view.innerHTML = `
    <div class="view-header">
      <h1>설정</h1>
    </div>

    <div class="card">
      <div class="card-title">API 연결 상태</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">
        API 토큰은 card-news-maker 앱의 설정에서 관리됩니다. (읽기 전용)
      </p>
      <table class="data-table">
        <thead><tr><th>플랫폼</th><th>상태</th><th>계정 ID</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="platform-badge threads">Threads</span></td>
            <td><span class="status-dot ${tokenStatus.threads.hasToken ? 'success' : 'error'}"></span>
              ${tokenStatus.threads.hasToken ? '연결됨' : '미설정'}</td>
            <td>${tokenStatus.threads.userId || '-'}</td>
          </tr>
          <tr>
            <td><span class="platform-badge instagram">Instagram</span></td>
            <td><span class="status-dot ${tokenStatus.instagram.hasToken ? 'success' : 'error'}"></span>
              ${tokenStatus.instagram.hasToken ? '연결됨' : '미설정'}</td>
            <td>${tokenStatus.instagram.accountId || '-'}</td>
          </tr>
          <tr>
            <td><span class="platform-badge tiktok">TikTok</span></td>
            <td><span class="status-dot success"></span>에뮬레이터</td>
            <td>uiautomator2 스크래핑</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">카테고리 관리</div>
      <div id="category-list">
        ${categories.map((c, i) => `
          <div class="inline-form" style="margin-bottom:6px">
            <input class="input-field" value="${c}" data-cat-idx="${i}" style="max-width:200px">
            <button class="btn-danger btn-small" onclick="removeCategory(${i})">삭제</button>
          </div>
        `).join('')}
      </div>
      <div class="inline-form" style="margin-top:8px">
        <input class="input-field" id="new-category" placeholder="새 카테고리 키..." style="max-width:200px">
        <button class="btn-secondary btn-small" onclick="addCategory()">추가</button>
      </div>
      <button class="btn-primary btn-small" style="margin-top:12px" onclick="saveCategories()">카테고리 저장</button>
    </div>

    <div class="card">
      <div class="card-title">자동 수집 스케줄러</div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="settings-auto-collect" ${autoCollect ? 'checked' : ''}>
          자동 수집 활성화
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">수집 간격 (분)</label>
        <input class="input-field" type="number" id="settings-collect-interval" value="${collectInterval}" min="1" max="1440" style="width:100px">
      </div>
      <button class="btn-primary btn-small" onclick="saveScheduleSettings()">스케줄러 저장</button>
    </div>

    <div class="card">
      <div class="card-title">네이버 API (트렌드 분석용)</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">
        <a href="https://developers.naver.com/apps/#/register" target="_blank" style="color:var(--accent)">네이버 개발자센터</a>에서 애플리케이션 등록 후 Client ID/Secret을 입력하세요.
      </p>
      <div class="form-group">
        <label class="form-label">Client ID</label>
        <input class="input-field" id="settings-naver-client-id" value="${settings.naverApi?.clientId || ''}" placeholder="네이버 Client ID">
      </div>
      <div class="form-group">
        <label class="form-label">Client Secret</label>
        <input class="input-field" id="settings-naver-client-secret" type="password" value="${settings.naverApi?.clientSecret || ''}" placeholder="네이버 Client Secret">
      </div>
      <button class="btn-primary btn-small" onclick="saveNaverApiSettings()">네이버 API 저장</button>
    </div>

    <div class="card">
      <div class="card-title">YouTube API (트렌드 분석용)</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:var(--accent)">Google Cloud Console</a>에서 YouTube Data API v3 키를 발급하세요.
      </p>
      <div class="form-group">
        <label class="form-label">API Key</label>
        <input class="input-field" id="settings-youtube-api-key" type="password" value="${settings.youtubeApiKey || ''}" placeholder="YouTube Data API v3 Key">
      </div>
      <button class="btn-primary btn-small" onclick="saveYoutubeApiSettings()">YouTube API 저장</button>
    </div>

    <div class="card">
      <div class="card-title">데이터 관리</div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" onclick="showExportMenu()">데이터 내보내기</button>
      </div>
    </div>
  `;
}

async function removeCategory(idx) {
  const settings = await window.api.loadAnalyzerSettings();
  const categories = settings.categories || [...CATEGORIES];
  categories.splice(idx, 1);
  settings.categories = categories;
  await window.api.saveAnalyzerSettings(settings);
  renderSettings();
}

async function addCategory() {
  const input = document.getElementById('new-category');
  const val = input?.value?.trim();
  if (!val) return;

  const settings = await window.api.loadAnalyzerSettings();
  const categories = settings.categories || [...CATEGORIES];
  if (categories.includes(val)) { showToast('이미 존재하는 카테고리입니다', 'error'); return; }
  categories.push(val);
  settings.categories = categories;
  await window.api.saveAnalyzerSettings(settings);
  showToast('카테고리 추가됨');
  renderSettings();
}

async function saveCategories() {
  const inputs = document.querySelectorAll('[data-cat-idx]');
  const categories = [];
  inputs.forEach(inp => {
    const val = inp.value.trim();
    if (val) categories.push(val);
  });

  const settings = await window.api.loadAnalyzerSettings();
  settings.categories = categories;
  await window.api.saveAnalyzerSettings(settings);
  showToast('카테고리 저장됨');
}

async function saveNaverApiSettings() {
  const settings = await window.api.loadAnalyzerSettings();
  settings.naverApi = {
    clientId: document.getElementById('settings-naver-client-id')?.value?.trim() || '',
    clientSecret: document.getElementById('settings-naver-client-secret')?.value?.trim() || '',
  };
  await window.api.saveAnalyzerSettings(settings);
  showToast('네이버 API 설정 저장됨');
}

async function saveYoutubeApiSettings() {
  const settings = await window.api.loadAnalyzerSettings();
  settings.youtubeApiKey = document.getElementById('settings-youtube-api-key')?.value?.trim() || '';
  await window.api.saveAnalyzerSettings(settings);
  showToast('YouTube API 설정 저장됨');
}

async function saveScheduleSettings() {
  const settings = await window.api.loadAnalyzerSettings();
  settings.autoCollect = document.getElementById('settings-auto-collect')?.checked || false;
  settings.collectInterval = parseInt(document.getElementById('settings-collect-interval')?.value) || 1;
  await window.api.saveAnalyzerSettings(settings);
  showToast('스케줄러 설정 저장됨');
}
