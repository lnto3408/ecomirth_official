// Post list, manual entry, tagging

let postsFilter = { platform: null, category: null };
let postsSort = { key: 'date', dir: 'desc' }; // key: 'likes' | 'views' | 'date'

async function renderPosts() {
  const view = document.getElementById('view-posts');

  view.innerHTML = `
    <div class="view-header">
      <h1>포스트 관리</h1>
      <div class="view-header-actions">
        <select class="input-field" style="width:120px" id="posts-filter-platform" onchange="filterPosts()">
          <option value="">전체 플랫폼</option>
          ${PLATFORMS.map(p => `<option value="${p}" ${postsFilter.platform === p ? 'selected' : ''}>${PLATFORM_LABELS[p]}</option>`).join('')}
        </select>
        <select class="input-field" style="width:120px" id="posts-filter-category" onchange="filterPosts()">
          <option value="">전체 카테고리</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${postsFilter.category === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`).join('')}
        </select>
        <button class="btn-primary" onclick="showAddPostModal()">+ 포스트 추가</button>
      </div>
    </div>
    <div id="posts-list">
      <div style="text-align:center;padding:40px"><span class="spinner"></span></div>
    </div>
  `;

  await loadPosts();
}

async function loadPosts() {
  const filters = {};
  if (postsFilter.platform) filters.platform = postsFilter.platform;
  if (postsFilter.category) filters.category = postsFilter.category;

  const posts = await window.api.getPosts(filters);
  const container = document.getElementById('posts-list');

  if (!posts.length) {
    container.innerHTML = emptyState(
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>',
      '포스트 없음', '수동으로 추가하거나 API 수집을 실행하세요.'
    );
    return;
  }

  // Fetch metrics for all posts, then sort
  const postsWithMetrics = await Promise.all(posts.map(async p => {
    try {
      const m = await window.api.getLatestMetrics(p.id);
      return { ...p, _likes: m?.likes || 0, _views: m?.views || 0 };
    } catch {
      return { ...p, _likes: 0, _views: 0 };
    }
  }));

  const asc = postsSort.dir === 'asc' ? -1 : 1;
  if (postsSort.key === 'likes') {
    postsWithMetrics.sort((a, b) => (b._likes - a._likes) * asc);
  } else if (postsSort.key === 'views') {
    postsWithMetrics.sort((a, b) => (b._views - a._views) * asc);
  } else {
    postsWithMetrics.sort((a, b) => (new Date(b.posted_at || 0) - new Date(a.posted_at || 0)) * asc);
  }

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>플랫폼</th><th>캡션</th><th>카테고리</th><th>그룹</th>
        <th class="num" style="cursor:pointer;user-select:none" onclick="changePostsSort('likes')">좋아요 ${postsSort.key === 'likes' ? (postsSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
        <th class="num" style="cursor:pointer;user-select:none" onclick="changePostsSort('views')">조회 ${postsSort.key === 'views' ? (postsSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
        <th style="cursor:pointer;user-select:none" onclick="changePostsSort('date')">발행일 ${postsSort.key === 'date' ? (postsSort.dir === 'desc' ? '▼' : '▲') : ''}</th><th></th>
      </tr></thead>
      <tbody>
        ${postsWithMetrics.map(p => `<tr style="cursor:pointer" onclick="if(!event.target.closest('select,button')){showPostDetail(${p.id})}">
            <td><span class="platform-badge ${p.platform}">${PLATFORM_LABELS[p.platform]}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.caption || '-'}</td>
            <td>
              <select class="input-field" style="width:100px;padding:2px 6px;font-size:11px"
                onchange="updatePostCategory(${p.id}, this.value)">
                ${CATEGORIES.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`).join('')}
              </select>
            </td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.content_group || '-'}</td>
            <td class="num">${formatNumber(p._likes)}</td>
            <td class="num">${formatNumber(p._views)}</td>
            <td>${formatDate(p.posted_at)}</td>
            <td>
              <button class="btn-secondary btn-small" onclick="showEditPostModal(${p.id})">편집</button>
              <button class="btn-danger btn-small" onclick="confirmDeletePost(${p.id})">삭제</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function filterPosts() {
  postsFilter.platform = document.getElementById('posts-filter-platform')?.value || null;
  postsFilter.category = document.getElementById('posts-filter-category')?.value || null;
  loadPosts();
}

function changePostsSort(key) {
  if (postsSort.key === key) {
    postsSort.dir = postsSort.dir === 'desc' ? 'asc' : 'desc';
  } else {
    postsSort.key = key;
    postsSort.dir = 'desc';
  }
  loadPosts();
}

async function updatePostCategory(id, category) {
  await window.api.updatePost(id, { category });
  showToast('카테고리 변경됨');
}

function showAddPostModal() {
  document.getElementById('post-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'post-modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">포스트 추가</div>
      <div class="form-group">
        <label class="form-label">플랫폼</label>
        <select class="input-field" id="post-platform">
          ${PLATFORMS.map(p => `<option value="${p}">${PLATFORM_LABELS[p]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">캡션</label>
        <textarea class="input-field" id="post-caption" rows="3"></textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select class="input-field" id="post-category">
            ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">콘텐츠 그룹</label>
          <input class="input-field" id="post-content-group" placeholder="예: 20260314-oil-prices">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">발행일시</label>
          <input class="input-field" type="datetime-local" id="post-date">
        </div>
        <div class="form-group">
          <label class="form-label">슬라이드 수</label>
          <input class="input-field" type="number" id="post-slides" value="1" min="1">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">해시태그 (쉼표 구분)</label>
        <input class="input-field" id="post-hashtags" placeholder="#경제, #뉴스">
      </div>
      <div class="card-title" style="margin-top:16px">지표 (선택)</div>
      <div class="grid-3">
        <div class="form-group"><label class="form-label">조회수</label><input class="input-field" type="number" id="post-views" value="0"></div>
        <div class="form-group"><label class="form-label">좋아요</label><input class="input-field" type="number" id="post-likes" value="0"></div>
        <div class="form-group"><label class="form-label">댓글</label><input class="input-field" type="number" id="post-comments" value="0"></div>
        <div class="form-group"><label class="form-label">공유</label><input class="input-field" type="number" id="post-shares" value="0"></div>
        <div class="form-group"><label class="form-label">저장</label><input class="input-field" type="number" id="post-saves" value="0"></div>
        <div class="form-group"><label class="form-label">도달</label><input class="input-field" type="number" id="post-reach" value="0"></div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closePostModal()">취소</button>
        <button class="btn-primary" onclick="saveNewPost()">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Set default date
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('post-date').value = now.toISOString().slice(0, 16);
}

function closePostModal() {
  document.getElementById('post-modal-overlay')?.remove();
}

async function saveNewPost() {
  const platform = document.getElementById('post-platform').value;
  const caption = document.getElementById('post-caption').value;
  const category = document.getElementById('post-category').value;
  const content_group = document.getElementById('post-content-group').value || null;
  const posted_at = document.getElementById('post-date').value ? new Date(document.getElementById('post-date').value).toISOString() : new Date().toISOString();
  const slide_count = parseInt(document.getElementById('post-slides').value) || 1;
  const hashtagStr = document.getElementById('post-hashtags').value;
  const hashtags = hashtagStr ? hashtagStr.split(',').map(h => h.trim()).filter(Boolean) : [];

  const postId = await window.api.addPost({ platform, caption, category, content_group, posted_at, slide_count, hashtags });

  // Add metrics if any non-zero
  const views = parseInt(document.getElementById('post-views').value) || 0;
  const likes = parseInt(document.getElementById('post-likes').value) || 0;
  const comments = parseInt(document.getElementById('post-comments').value) || 0;
  const shares = parseInt(document.getElementById('post-shares').value) || 0;
  const saves = parseInt(document.getElementById('post-saves').value) || 0;
  const reach = parseInt(document.getElementById('post-reach').value) || 0;

  if (views || likes || comments || shares || saves || reach) {
    await window.api.addMetrics(postId, { views, likes, comments, shares, saves, reach });
  }

  closePostModal();
  showToast('포스트 추가됨');
  loadPosts();
}

async function showEditPostModal(id) {
  const post = await window.api.getPostById(id);
  if (!post) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'post-modal-overlay';

  const hashtags = (() => { try { return JSON.parse(post.hashtags || '[]'); } catch { return []; } })();

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">포스트 편집</div>
      <div class="form-group">
        <label class="form-label">플랫폼</label>
        <select class="input-field" id="edit-platform">
          ${PLATFORMS.map(p => `<option value="${p}" ${post.platform === p ? 'selected' : ''}>${PLATFORM_LABELS[p]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">캡션</label>
        <textarea class="input-field" id="edit-caption" rows="3">${post.caption || ''}</textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select class="input-field" id="edit-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${post.category === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">콘텐츠 그룹</label>
          <input class="input-field" id="edit-content-group" value="${post.content_group || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">해시태그 (쉼표 구분)</label>
        <input class="input-field" id="edit-hashtags" value="${hashtags.join(', ')}">
      </div>
      <div class="card-title" style="margin-top:16px">지표 추가 (현재 시점)</div>
      <div class="grid-3">
        <div class="form-group"><label class="form-label">조회수</label><input class="input-field" type="number" id="edit-views" value="0"></div>
        <div class="form-group"><label class="form-label">좋아요</label><input class="input-field" type="number" id="edit-likes" value="0"></div>
        <div class="form-group"><label class="form-label">댓글</label><input class="input-field" type="number" id="edit-comments" value="0"></div>
        <div class="form-group"><label class="form-label">공유</label><input class="input-field" type="number" id="edit-shares" value="0"></div>
        <div class="form-group"><label class="form-label">저장</label><input class="input-field" type="number" id="edit-saves" value="0"></div>
        <div class="form-group"><label class="form-label">도달</label><input class="input-field" type="number" id="edit-reach" value="0"></div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closePostModal()">취소</button>
        <button class="btn-primary" onclick="saveEditPost(${id})">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function saveEditPost(id) {
  const hashtagStr = document.getElementById('edit-hashtags').value;
  const hashtags = hashtagStr ? hashtagStr.split(',').map(h => h.trim()).filter(Boolean) : [];

  await window.api.updatePost(id, {
    platform: document.getElementById('edit-platform').value,
    caption: document.getElementById('edit-caption').value,
    category: document.getElementById('edit-category').value,
    content_group: document.getElementById('edit-content-group').value || null,
    hashtags,
  });

  // Add new metrics snapshot
  const views = parseInt(document.getElementById('edit-views').value) || 0;
  const likes = parseInt(document.getElementById('edit-likes').value) || 0;
  const comments = parseInt(document.getElementById('edit-comments').value) || 0;
  const shares = parseInt(document.getElementById('edit-shares').value) || 0;
  const saves = parseInt(document.getElementById('edit-saves').value) || 0;
  const reach = parseInt(document.getElementById('edit-reach').value) || 0;

  if (views || likes || comments || shares || saves || reach) {
    await window.api.addMetrics(id, { views, likes, comments, shares, saves, reach });
  }

  closePostModal();
  showToast('포스트 수정됨');
  loadPosts();
}

async function confirmDeletePost(id) {
  if (!confirm('이 포스트를 삭제하시겠습니까?')) return;
  await window.api.deletePost(id);
  showToast('포스트 삭제됨');
  loadPosts();
}

// ── Post Detail ──

async function showPostDetail(postId) {
  AppState._postDetailBackView = AppState.currentView;

  // Switch to posts view without triggering renderPosts
  AppState.currentView = 'posts';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn[data-view]').forEach(b => b.classList.remove('active'));
  const postsView = document.querySelector('.view[data-view="posts"]');
  const postsBtn = document.querySelector('.sidebar-btn[data-view="posts"]');
  if (postsView) postsView.classList.add('active');
  if (postsBtn) postsBtn.classList.add('active');

  const view = document.getElementById('view-posts');
  view.innerHTML = `<div style="text-align:center;padding:40px"><span class="spinner"></span></div>`;

  const [post, metrics, history] = await Promise.all([
    window.api.getPostById(postId),
    window.api.getLatestMetrics(postId),
    window.api.getMetricsHistory(postId),
  ]);

  if (!post) {
    view.innerHTML = emptyState(
      '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      '포스트를 찾을 수 없음', '삭제되었거나 유효하지 않은 포스트입니다.'
    );
    return;
  }

  const accountStats = await window.api.getLatestAccountStats(post.platform);
  const hashtags = (() => { try { return JSON.parse(post.hashtags || '[]'); } catch { return []; } })();

  const likes = metrics?.likes || 0;
  const comments = metrics?.comments || 0;
  const shares = metrics?.shares || 0;
  const saves = metrics?.saves || 0;
  const views = metrics?.views || 0;
  const reach = metrics?.reach || 0;
  const engRate = engagementRate(metrics || {});
  const followers = accountStats?.followers || 0;
  const reachRate = followers ? ((reach / followers) * 100).toFixed(2) : '-';

  view.innerHTML = `
    <div class="view-header" style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn-secondary" onclick="backFromPostDetail()" style="padding:6px 12px">← 뒤로</button>
        <h1 style="margin:0;font-size:18px">포스트 상세</h1>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="platform-badge ${post.platform}">${PLATFORM_LABELS[post.platform]}</span>
        <span class="category-badge" style="background:${CATEGORY_COLORS[post.category] || '#888'}22;color:${CATEGORY_COLORS[post.category] || '#888'};padding:4px 10px;border-radius:6px;font-size:12px">${CATEGORY_LABELS[post.category] || '기타'}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">포스트 정보</div>
      <p style="font-size:13px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;margin:0 0 12px 0">${post.caption || '(캡션 없음)'}</p>
      ${hashtags.length ? `<div style="margin-bottom:12px">${hashtags.map(h => `<span style="display:inline-block;background:var(--bg-tertiary);color:var(--text-dim);padding:2px 8px;border-radius:4px;font-size:11px;margin:2px 4px 2px 0">${h}</span>`).join('')}</div>` : ''}
      <div style="display:flex;gap:16px;font-size:12px;color:var(--text-dim)">
        <span>게시일: ${formatDateTime(post.posted_at)}</span>
        ${post.slide_count > 1 ? `<span>슬라이드: ${post.slide_count}장</span>` : ''}
        ${post.content_group ? `<span>그룹: ${post.content_group}</span>` : ''}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">조회수</div>
        <div class="stat-value">${formatNumber(views)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">좋아요</div>
        <div class="stat-value">${formatNumber(likes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">댓글</div>
        <div class="stat-value">${formatNumber(comments)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">공유</div>
        <div class="stat-value">${formatNumber(shares)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">저장</div>
        <div class="stat-value">${formatNumber(saves)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">참여율</div>
        <div class="stat-value">${engRate}%</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">지표 변화 추이</div>
      <div class="chart-container tall" id="post-detail-trend-container">
        <canvas id="chart-post-detail-trend"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-title">계정 컨텍스트</div>
      <div style="display:flex;gap:24px;font-size:14px">
        <div><span style="color:var(--text-dim)">현재 팔로워:</span> <strong>${formatNumber(followers)}</strong></div>
        <div><span style="color:var(--text-dim)">도달률:</span> <strong>${reachRate === '-' ? '-' : reachRate + '%'}</strong></div>
      </div>
    </div>

    <div class="card">
      ${emptyState(
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        '조회 소스 / 오디언스',
        '향후 API 연동 시 제공 예정 (조회 소스, 지역, 인구통계)'
      )}
    </div>
  `;

  renderPostMetricsTrendChart(history);
}

function renderPostMetricsTrendChart(history) {
  destroyChart('chart-post-detail-trend');
  const ctx = document.getElementById('chart-post-detail-trend');
  if (!ctx) return;

  if (!history || history.length < 2) {
    document.getElementById('post-detail-trend-container').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:13px">수집 데이터가 부족합니다 (최소 2개 필요)</div>';
    return;
  }

  const labels = history.map(h => formatDateTime(h.collected_at));

  const datasets = [];
  const colors = { likes: '#4a9eff', comments: '#4caf50', shares: '#ff9800', saves: '#e1306c' };
  const labelMap = { likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장' };

  for (const [key, color] of Object.entries(colors)) {
    const data = history.map(h => h[key] || 0);
    if (data.some(v => v > 0)) {
      datasets.push({
        label: labelMap[key], data, borderColor: color, backgroundColor: color + '20',
        tension: 0.3, fill: false, yAxisID: 'y',
      });
    }
  }

  const viewsData = history.map(h => h.views || 0);
  const hasViews = viewsData.some(v => v > 0);
  if (hasViews) {
    datasets.push({
      label: '조회수', data: viewsData, borderColor: '#888', backgroundColor: '#88888820',
      tension: 0.3, fill: false, yAxisID: 'y1', borderDash: [5, 3],
    });
  }

  AppState.charts['chart-post-detail-trend'] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...chartOptions(''),
      scales: {
        x: { ticks: { color: '#888', maxRotation: 45 }, grid: { display: false } },
        y: {
          type: 'linear', position: 'left',
          ticks: { color: '#888' }, grid: { color: '#2a2a2a' },
          title: { display: true, text: '좋아요/댓글/공유/저장', color: '#888' },
        },
        ...(hasViews ? {
          y1: {
            type: 'linear', position: 'right',
            ticks: { color: '#888' }, grid: { drawOnChartArea: false },
            title: { display: true, text: '조회수', color: '#888' },
          }
        } : {}),
      },
    },
  });
}

function backFromPostDetail() {
  const backView = AppState._postDetailBackView || 'dashboard';
  switchView(backView);
}
