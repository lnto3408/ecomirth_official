// Post list, manual entry, tagging

let postsFilter = { platform: null, category: null };

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

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>플랫폼</th><th>캡션</th><th>카테고리</th><th>그룹</th>
        <th class="num">좋아요</th><th class="num">조회</th><th>발행일</th><th></th>
      </tr></thead>
      <tbody>
        ${await Promise.all(posts.map(async p => {
          const m = await window.api.getLatestMetrics(p.id);
          return `<tr>
            <td><span class="platform-badge ${p.platform}">${PLATFORM_LABELS[p.platform]}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.caption || '-'}</td>
            <td>
              <select class="input-field" style="width:100px;padding:2px 6px;font-size:11px"
                onchange="updatePostCategory(${p.id}, this.value)">
                ${CATEGORIES.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`).join('')}
              </select>
            </td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.content_group || '-'}</td>
            <td class="num">${formatNumber(m?.likes || 0)}</td>
            <td class="num">${formatNumber(m?.views || 0)}</td>
            <td>${formatDate(p.posted_at)}</td>
            <td>
              <button class="btn-secondary btn-small" onclick="showEditPostModal(${p.id})">편집</button>
              <button class="btn-danger btn-small" onclick="confirmDeletePost(${p.id})">삭제</button>
            </td>
          </tr>`;
        })).then(rows => rows.join(''))}
      </tbody>
    </table>
  `;
}

function filterPosts() {
  postsFilter.platform = document.getElementById('posts-filter-platform')?.value || null;
  postsFilter.category = document.getElementById('posts-filter-category')?.value || null;
  loadPosts();
}

async function updatePostCategory(id, category) {
  await window.api.updatePost(id, { category });
  showToast('카테고리 변경됨');
}

function showAddPostModal() {
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
