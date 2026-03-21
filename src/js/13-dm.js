// Instagram DM management view

const _dmMessages = [];
let _dmSelectedConversation = null;

async function renderDM() {
  const view = document.getElementById('view-dm');
  const tokenStatus = await window.api.getTokenStatus();
  const hasToken = tokenStatus.instagram?.hasToken;

  view.innerHTML = `
    <div class="view-header">
      <h1>DM 관리</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="status-dot ${hasToken ? 'success' : 'error'}"></span>
        <span style="font-size:12px;color:var(--text-dim)">${hasToken ? 'Webhook 연결됨' : 'Instagram 토큰 미설정'}</span>
      </div>
    </div>

    ${!hasToken ? `
      <div class="card">
        <div class="empty-state" style="padding:40px">
          <h3>Instagram API 연결 필요</h3>
          <p>card-news-maker 앱에서 Instagram API 토큰을 설정하세요.</p>
        </div>
      </div>
    ` : `
      <!-- 자동 DM 규칙 -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">댓글 자동 DM 규칙</div>
        </div>
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:16px">
          게시물에 댓글이 달리면 자동으로 DM을 보냅니다. 팔로우 확인 → 미팔로우 시 팔로우 요청 → 팔로우 확인 후 정보 제공.
        </p>

        <!-- 규칙 추가 폼 -->
        <div class="dm-rule-form card" style="background:var(--bg);padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px">새 규칙 추가</div>
          <div class="form-group">
            <label class="form-label">트리거 조건</label>
            <div style="display:flex;gap:8px;align-items:center">
              <select class="input-field" id="rule-trigger-type" style="width:150px" onchange="updateTriggerUI()">
                <option value="all">모든 댓글</option>
                <option value="keyword">특정 키워드</option>
              </select>
              <input class="input-field" id="rule-trigger-keyword" placeholder="키워드 (쉼표 구분)" style="flex:1;display:none">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">미팔로우 시 메시지</label>
            <input class="input-field" id="rule-msg-unfollow" value="안녕하세요! 저희 계정을 팔로우하시면 요청하신 정보를 보내드릴게요 🙏" placeholder="팔로우 요청 메시지">
          </div>
          <div class="form-group">
            <label class="form-label">팔로우 확인 후 메시지 (정보 제공)</label>
            <textarea class="input-field" id="rule-msg-follow" rows="3" placeholder="팔로우 후 제공할 정보 메시지">감사합니다! 요청하신 정보입니다 😊

👉 자세한 내용은 아래 링크를 확인하세요:
https://example.com/info</textarea>
          </div>
          <button class="btn-primary btn-small" onclick="addAutoReplyRule()">규칙 추가</button>
        </div>

        <!-- 규칙 목록 -->
        <div id="dm-auto-rules"></div>
      </div>

      <!-- DM 대화 -->
      <div class="dm-layout">
        <div class="card dm-conversations">
          <div class="card-title">대화 목록</div>
          <button class="btn-secondary btn-small" style="margin-bottom:12px;width:100%" onclick="loadConversations()">대화 불러오기</button>
          <div id="dm-conversation-list">
            <div style="padding:16px;color:var(--text-dim);font-size:13px;text-align:center">대화를 불러오세요</div>
          </div>
        </div>

        <div class="card dm-chat">
          <div class="card-title" id="dm-chat-title">메시지</div>
          <div id="dm-message-list" class="dm-messages">
            <div style="padding:40px;color:var(--text-dim);font-size:13px;text-align:center">대화를 선택하세요</div>
          </div>
          <div id="dm-reply-area" class="dm-reply" style="display:none">
            <input class="input-field" id="dm-reply-input" placeholder="답장 입력..." style="flex:1"
              onkeydown="if(event.key==='Enter')sendDMReply()">
            <button class="btn-primary btn-small" onclick="sendDMReply()">전송</button>
          </div>
        </div>
      </div>

      <!-- 실시간 수신 로그 -->
      <div class="card" style="margin-top:16px">
        <div class="card-title">실시간 수신 로그</div>
        <div id="dm-realtime-log">
          <div style="padding:16px;color:var(--text-dim);font-size:13px;text-align:center">DM/댓글을 수신하면 여기에 표시됩니다</div>
        </div>
      </div>
    `}
  `;

  // 규칙 목록 렌더
  const rulesContainer = document.getElementById('dm-auto-rules');
  if (rulesContainer) rulesContainer.innerHTML = renderAutoReplyRules();
}

// ── Trigger UI ──

function updateTriggerUI() {
  const type = document.getElementById('rule-trigger-type')?.value;
  const kwInput = document.getElementById('rule-trigger-keyword');
  if (kwInput) kwInput.style.display = type === 'keyword' ? '' : 'none';
}

// ── Auto Reply Rules ──

function getAutoReplyRules() {
  const stored = localStorage.getItem('dm_auto_rules');
  if (stored) return JSON.parse(stored);
  return [{
    trigger: 'all',
    keywords: [],
    msgUnfollow: '안녕하세요! 저희 계정을 팔로우하시면 요청하신 정보를 보내드릴게요 🙏',
    msgFollow: '감사합니다! 요청하신 정보입니다 😊\n\n👉 자세한 내용은 프로필 링크를 확인하세요!',
    enabled: true,
  }];
}

function saveAutoReplyRules(rules) {
  localStorage.setItem('dm_auto_rules', JSON.stringify(rules));
}

function renderAutoReplyRules() {
  const rules = getAutoReplyRules();
  if (!rules.length) return '<div style="color:var(--text-dim);font-size:13px;padding:8px">규칙이 없습니다</div>';

  return rules.map((r, i) => `
    <div class="dm-rule-card">
      <div class="dm-rule-header">
        <div>
          <span class="status-dot ${r.enabled ? 'success' : 'error'}"></span>
          <strong>${r.trigger === 'all' ? '모든 댓글' : `키워드: ${r.keywords.join(', ')}`}</strong>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary btn-small" onclick="toggleAutoRule(${i})">${r.enabled ? '비활성화' : '활성화'}</button>
          <button class="btn-danger btn-small" onclick="deleteAutoRule(${i})">삭제</button>
        </div>
      </div>
      <div class="dm-rule-flow">
        <div class="dm-rule-step">
          <div class="dm-rule-step-label">1. 댓글 감지</div>
          <div class="dm-rule-step-icon">💬</div>
        </div>
        <div class="dm-rule-arrow">→</div>
        <div class="dm-rule-step">
          <div class="dm-rule-step-label">2. 팔로우 확인</div>
          <div class="dm-rule-step-icon">🔍</div>
        </div>
        <div class="dm-rule-arrow">→</div>
        <div class="dm-rule-step unfollowed">
          <div class="dm-rule-step-label">미팔로우</div>
          <div class="dm-rule-step-msg">${r.msgUnfollow?.slice(0, 40) || ''}...</div>
        </div>
        <div class="dm-rule-arrow">→</div>
        <div class="dm-rule-step followed">
          <div class="dm-rule-step-label">팔로우 확인</div>
          <div class="dm-rule-step-msg">${r.msgFollow?.slice(0, 40) || ''}...</div>
        </div>
      </div>
    </div>
  `).join('');
}

function addAutoReplyRule() {
  const triggerType = document.getElementById('rule-trigger-type')?.value || 'all';
  const keywordInput = document.getElementById('rule-trigger-keyword')?.value || '';
  const msgUnfollow = document.getElementById('rule-msg-unfollow')?.value?.trim();
  const msgFollow = document.getElementById('rule-msg-follow')?.value?.trim();

  if (!msgUnfollow || !msgFollow) {
    showToast('메시지를 모두 입력하세요', 'error');
    return;
  }

  const keywords = triggerType === 'keyword'
    ? keywordInput.split(',').map(k => k.trim()).filter(Boolean)
    : [];

  if (triggerType === 'keyword' && !keywords.length) {
    showToast('키워드를 입력하세요', 'error');
    return;
  }

  const rules = getAutoReplyRules();
  rules.push({
    trigger: triggerType,
    keywords,
    msgUnfollow,
    msgFollow,
    enabled: true,
  });
  saveAutoReplyRules(rules);

  const container = document.getElementById('dm-auto-rules');
  if (container) container.innerHTML = renderAutoReplyRules();
  showToast('규칙 추가됨');
}

function toggleAutoRule(idx) {
  const rules = getAutoReplyRules();
  if (rules[idx]) rules[idx].enabled = !rules[idx].enabled;
  saveAutoReplyRules(rules);
  const container = document.getElementById('dm-auto-rules');
  if (container) container.innerHTML = renderAutoReplyRules();
}

function deleteAutoRule(idx) {
  const rules = getAutoReplyRules();
  rules.splice(idx, 1);
  saveAutoReplyRules(rules);
  const container = document.getElementById('dm-auto-rules');
  if (container) container.innerHTML = renderAutoReplyRules();
  showToast('규칙 삭제됨');
}

// ── Conversations ──

async function loadConversations() {
  const container = document.getElementById('dm-conversation-list');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:16px"><span class="spinner"></span></div>';

  let result;
  try {
    result = await window.api.getInstagramConversations();
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">연결 실패: ${err.message}</div>`;
    return;
  }

  if (!result.success) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
    return;
  }

  if (!result.data?.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:13px">대화 없음 (검수 통과 후 사용 가능)</div>';
    return;
  }

  container.innerHTML = result.data.map(conv => {
    const participant = conv.participants?.data?.find(p => p.id !== conv.id)?.username || conv.id;
    return `
      <div class="dm-conv-item ${_dmSelectedConversation === conv.id ? 'active' : ''}"
        onclick="selectConversation('${conv.id}', '${participant}')">
        <div class="dm-conv-name">${participant}</div>
        <div class="dm-conv-time">${relativeTime(conv.updated_time)}</div>
      </div>
    `;
  }).join('');
}

async function selectConversation(conversationId, participantName) {
  _dmSelectedConversation = conversationId;

  const titleEl = document.getElementById('dm-chat-title');
  if (titleEl) titleEl.textContent = `@${participantName}`;

  const replyArea = document.getElementById('dm-reply-area');
  if (replyArea) replyArea.style.display = 'flex';

  const container = document.getElementById('dm-message-list');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';

  const result = await window.api.getInstagramMessages(conversationId);

  if (!result.success) {
    container.innerHTML = `<div style="padding:16px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
    return;
  }

  if (!result.data?.length) {
    container.innerHTML = '<div style="padding:16px;color:var(--text-dim);font-size:13px">메시지 없음</div>';
    return;
  }

  container.innerHTML = result.data.reverse().map(msg => `
    <div class="dm-msg ${msg.from?.id === _dmSelectedConversation ? 'from-them' : 'from-me'}">
      <div class="dm-msg-text">${msg.message || ''}</div>
      <div class="dm-msg-time">${relativeTime(msg.created_time)}</div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

// ── Send Reply ──

async function sendDMReply() {
  const input = document.getElementById('dm-reply-input');
  if (!input || !input.value.trim() || !_dmSelectedConversation) return;

  const text = input.value.trim();
  input.value = '';
  input.disabled = true;

  const result = await window.api.sendInstagramDM(_dmSelectedConversation, text);

  input.disabled = false;
  input.focus();

  if (result.success) {
    const container = document.getElementById('dm-message-list');
    if (container) {
      const msgEl = document.createElement('div');
      msgEl.className = 'dm-msg from-me';
      msgEl.innerHTML = `<div class="dm-msg-text">${text}</div><div class="dm-msg-time">방금 전</div>`;
      container.appendChild(msgEl);
      container.scrollTop = container.scrollHeight;
    }
  } else {
    showToast('DM 발송 실패: ' + result.message, 'error');
  }
}

// ── Realtime Log ──

function appendDMLog(type, sender, text) {
  _dmMessages.unshift({ type, sender, text, time: new Date() });
  if (_dmMessages.length > 50) _dmMessages.pop();

  const container = document.getElementById('dm-realtime-log');
  if (!container) return;

  container.innerHTML = `
    <div class="dm-log-list">
      ${_dmMessages.map(m => `
        <div class="dm-log-item">
          <span class="dm-log-type" style="color:${m.type === 'comment' ? '#f59e0b' : 'var(--accent)'}">${m.type === 'comment' ? '💬댓글' : '📩DM'}</span>
          <span class="dm-log-sender">${m.sender}</span>
          <span class="dm-log-text">${m.text || '(첨부파일)'}</span>
          <span class="dm-log-time">${m.time.toLocaleTimeString()}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Event Handlers ──

if (window.api.onDMReceived) {
  window.api.onDMReceived((msg) => {
    appendDMLog('dm', msg.senderId, msg.text);
    showToast(`새 DM: "${(msg.text || '').slice(0, 30)}"`);
  });
}

if (window.api.onCommentReceived) {
  window.api.onCommentReceived((comment) => {
    appendDMLog('comment', comment.from?.username || comment.from?.id, comment.text);
    showToast(`새 댓글: "${(comment.text || '').slice(0, 30)}"`);
  });
}
