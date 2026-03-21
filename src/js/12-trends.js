// Trend analysis view

const TREND_CATEGORIES = {
  'tech': ['AI', 'GPT', '챗봇', '딥러닝', '자동화', '에이전트', '로봇', '디지털', '앱', '코딩', '개발', '알고리즘', '플랫폼', 'IT', '반도체', '스마트폰', '클라우드', '사이버'],
  'finance': ['주식', '부동산', '비트코인', '금리', '환율', '투자', '경제', '재테크', '자산', '연금', '코인', '펀드', '대출', '물가', '인플레이션', '증시', '채권', '관세'],
  'policy': ['정부', '국회', '정책', '선거', '법안', '외교', '국방', '재난', '대통령', '장관', '여당', '야당', '헌법', '탄핵', '개혁', '안보', '통일', '북한'],
  'lifestyle': ['건강', '다이어트', '여행', '운동', '워라밸', '이직', '연봉', '커리어', '수면', '독서', '취미', '힐링', '맛집', '카페', '패션', '뷰티'],
  'world': ['미국', '중국', '일본', '유럽', '러시아', '우크라이나', '중동', '이란', '트럼프', 'NATO', '무역', '전쟁', '제재', '정상회담', '유엔'],
  'society': ['교육', '인구', '저출생', '고령화', '범죄', '사건', '사고', '환경', '기후', '미세먼지', '재해', '복지', '의료', '보험'],
  'culture': ['영화', '드라마', '음악', '공연', 'K-pop', '웹툰', '게임', '스포츠', '올림픽', '축구', '야구', 'BTS', '넷플릭스', '유튜브'],
};

const TREND_CAT_LABELS = {
  'tech': '테크', 'finance': '경제', 'policy': '정치', 'lifestyle': '라이프',
  'world': '국제', 'society': '사회', 'culture': '문화',
};

async function renderTrends() {
  const view = document.getElementById('view-trends');
  view.innerHTML = `
    <div class="view-header">
      <h1>트렌드 분석</h1>
      <button class="btn-secondary" onclick="showTrendHistory()" style="margin-right:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        트렌드 변화
      </button>
      <button class="btn-primary" id="btn-refresh-trends" onclick="refreshAllTrends()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
        </svg>
        새로고침
      </button>
    </div>

    <!-- Row 1: 실시간 트렌드 + 키워드 비교 -->
    <div class="trends-grid">
      <div class="card trends-realtime">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="card-title" id="trends-realtime-title" style="margin:0">실시간 핫 토픽</div>
        </div>
        <div class="tab-bar" style="margin-bottom:8px;flex-wrap:wrap;gap:4px">
          <button class="tab-btn active" onclick="filterHotTopics('all', this)">전체</button>
          ${Object.entries(TREND_CAT_LABELS).map(([k,v]) =>
            `<button class="tab-btn" onclick="filterHotTopics('${k}', this)">${v}</button>`
          ).join('')}
        </div>
        <div id="trends-google-daily">
          <div style="text-align:center;padding:30px"><span class="spinner"></span> 트렌드 로딩 중...</div>
        </div>
      </div>

      <div class="card trends-keywords">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">키워드 관심도 비교</div>
          <div class="period-selector">
            ${[['7','7일'],['30','30일'],['90','90일']].map(([d,l]) =>
              `<button class="period-btn ${d==='30'?'active':''}" onclick="changeTrendPeriod(${d})">${l}</button>`
            ).join('')}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${Object.entries(TREND_CATEGORIES).map(([cat, kws]) =>
            `<button class="keyword-preset-btn" onclick="applyKeywordPreset('${kws.slice(0,5).join(',')}')">${TREND_CAT_LABELS[cat] || cat}</button>`
          ).join('')}
          <button class="keyword-preset-btn" onclick="applyHotTopicPreset()" style="border-color:var(--accent)">핫토픽</button>
          <button class="keyword-preset-btn" id="btn-load-favorites" onclick="loadFavoriteKeywords()" style="border-color:var(--warning)">★ 즐겨찾기</button>
        </div>
        <div class="inline-form" style="margin-bottom:12px">
          <input class="input-field" id="trend-keyword-input" placeholder="키워드 입력 (쉼표 구분, 최대 5개)" style="flex:1" value="AI,부동산,주식,건강,정책">
          <button class="btn-secondary btn-small" onclick="searchNaverTrend()">조회</button>
          <button class="btn-small" onclick="saveFavoriteKeywords()" title="현재 키워드를 즐겨찾기에 저장" style="background:none;border:1px solid var(--border);color:var(--warning);cursor:pointer">★</button>
        </div>
        <div id="trends-keyword-chart" style="position:relative;height:300px">
          <canvas id="chart-keyword-trend"></canvas>
        </div>
        <div id="trends-keyword-insight" style="margin-top:12px"></div>
      </div>
    </div>

    <!-- Row 2: 정책 브리핑 + 뉴스 키워드 -->
    <div class="trends-grid" style="margin-top:16px">
      <div class="card">
        <div class="card-title">정책 브리핑</div>
        <div id="trends-policy">
          <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">뉴스 핫 키워드</div>
        </div>
        <div id="trends-news-keywords">
          <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
        </div>
      </div>
    </div>

    <!-- Row 3: 카테고리별 뉴스 + 콘텐츠 추천 -->
    <div class="trends-grid" style="margin-top:16px">
      <div class="card trends-news">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">카테고리별 최신 뉴스</div>
          <div class="tab-bar" style="margin:0">
            ${Object.keys(TREND_CATEGORIES).map((cat, i) =>
              `<button class="tab-btn ${i===0?'active':''}" onclick="changeTrendNewsCat('${cat}', this)">${TREND_CAT_LABELS[cat] || cat}</button>`
            ).join('')}
          </div>
        </div>
        <div id="trends-news-list">
          <div style="text-align:center;padding:20px;color:var(--text-dim)">네이버 API 키를 설정하면 뉴스를 확인할 수 있습니다.</div>
        </div>
      </div>

      <div class="card trends-recommend">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div class="card-title" style="margin:0">콘텐츠 추천</div>
          <button class="btn-secondary btn-small" onclick="generateAIContentIdeas()">AI 아이디어</button>
        </div>
        <p style="font-size:11px;color:var(--text-dim);margin-bottom:12px">트렌드 키워드 + 내 포스트 성과를 교차 분석한 추천</p>
        <div id="trends-recommendations">
          <div style="text-align:center;padding:20px;color:var(--text-dim)">트렌드 데이터를 수집하면 추천이 표시됩니다.</div>
        </div>
        <div id="trends-ai-ideas" style="margin-top:12px"></div>
      </div>
    </div>

    <!-- Row 4: YouTube Trending -->
    <div class="card" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">YouTube 인기 동영상 (한국)</div>
        <button class="btn-secondary btn-small" onclick="loadYoutubeTrending()">새로고침</button>
      </div>
      <div id="trends-youtube">
        <div style="text-align:center;padding:20px;color:var(--text-dim)">YouTube API 키를 설정하면 인기 동영상을 확인할 수 있습니다.</div>
      </div>
    </div>

    <!-- Row 5: 네이버 쇼핑 트렌드 -->
    <div class="card" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">네이버 쇼핑 인기 키워드</div>
        <select class="input-field" style="width:150px" onchange="loadShoppingTrend(this.value)">
          <option value="50000000">패션의류</option>
          <option value="50000001">패션잡화</option>
          <option value="50000003">디지털/가전</option>
          <option value="50000004">가구/인테리어</option>
          <option value="50000005">출산/육아</option>
          <option value="50000006">식품</option>
          <option value="50000002">화장품/미용</option>
          <option value="50000008">스포츠/레저</option>
        </select>
      </div>
      <div id="trends-shopping">
        <div style="padding:16px;color:var(--text-dim);font-size:13px;text-align:center">카테고리를 선택하면 인기 키워드가 표시됩니다. (네이버 API 키 필요)</div>
      </div>
    </div>

    <!-- Row 6: 트렌드 ↔ 콘텐츠 상관관계 -->
    <div class="card" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">트렌드 ↔ 콘텐츠 성과 상관관계</div>
        <button class="btn-secondary btn-small" onclick="exportTrendData()">내보내기</button>
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">급상승 트렌드 시점에 발행한 콘텐츠의 성과를 비교합니다.</p>
      <div id="trends-correlation">
        <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
      </div>
    </div>

    <!-- Row 6: 콘텐츠 캘린더 -->
    <div class="card" style="margin-top:16px">
      <div class="card-title">콘텐츠 캘린더 추천</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">내 발행 패턴 + 시간대 성과 + 현재 트렌드를 기반으로 이번 주 콘텐츠 플랜을 제안합니다.</p>
      <div id="trends-calendar">
        <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
      </div>
    </div>
  `;

  // Load all sections in parallel
  Promise.allSettled([
    loadGoogleDailyTrends(),
    searchNaverTrend(),
    loadPolicyFeeds(),
    loadNewsKeywords(),
    loadTrendNews('tech'),
    loadYoutubeTrending(),
  ]).then(() => {
    generateRecommendations().catch(() => {});
    loadTrendCorrelation().catch(() => {});
    loadContentCalendar().catch(() => {});
  });
}

// ── Google Daily Trends ──

async function loadGoogleDailyTrends() {
  const container = document.getElementById('trends-google-daily');
  const titleEl = document.getElementById('trends-realtime-title');
  if (!container) return;

  try {
    // 1) Google Trends 캐시가 있으면 사용 (API 호출 안 함)
    const googleSnapshot = await window.api.getTrendSnapshot('google');
    const googleFresh = googleSnapshot && (Date.now() - new Date(googleSnapshot.collected_at).getTime()) < 60 * 60 * 1000; // 1시간

    if (googleFresh) {
      if (titleEl) titleEl.textContent = '실시간 급상승 검색어 (Google Korea)';
      renderGoogleTrends(container, googleSnapshot.data, googleSnapshot.collected_at);
      return;
    }

    // 2) RSS 기반 핫 토픽 (기본 — 빠르고 안정적)
    await loadHotTopicsFallback(container, titleEl);
  } catch (err) {
    container.innerHTML = `<div style="padding:16px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

async function loadHotTopicsFallback(container, titleEl) {
  try {
    container.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span> 뉴스 기반 핫 토픽 수집 중...</div>';

    // 캐시 확인
    let snapshot = await window.api.getTrendSnapshot('hot-topics');
    const isFresh = snapshot && (Date.now() - new Date(snapshot.collected_at).getTime()) < 30 * 60 * 1000;

    if (!isFresh) {
      const result = await window.api.fetchHotTopics();
      if (result.success) {
        snapshot = { data: result.data, collected_at: new Date().toISOString() };
      } else if (!snapshot) {
        container.innerHTML = '<div style="padding:16px;color:var(--text-dim);font-size:13px">핫 토픽 로딩 실패</div>';
        return;
      }
    }

    if (titleEl) titleEl.textContent = '핫 토픽 (뉴스 헤드라인 기반)';
    renderGoogleTrends(container, snapshot.data, snapshot.collected_at);
  } catch (err) {
    container.innerHTML = `<div style="padding:16px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

// 키워드 → 카테고리 매칭 (키워드 + 기사 제목 종합 분석)
function categorizeKeyword(keyword, articles) {
  // 분석 대상 텍스트: 키워드 + 관련 기사 제목
  const text = [keyword, ...(articles || []).map(a => a.title || '')].join(' ').toLowerCase();

  let bestCat = null;
  let bestScore = 0;

  for (const [cat, words] of Object.entries(TREND_CATEGORIES)) {
    const score = words.filter(w => text.includes(w.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  return bestScore > 0 ? bestCat : 'other';
}

// 전체 트렌드 데이터 저장 (필터용)
let _allHotTopics = [];
let _hotTopicsCollectedAt = '';

function renderGoogleTrends(container, trends, collectedAt) {
  if (!trends || !trends.length) {
    container.innerHTML = '<div style="padding:16px;color:var(--text-dim)">트렌드 데이터 없음</div>';
    return;
  }

  // 카테고리 태그 추가 (RSS 힌트 → 키워드+기사 매칭 → other)
  _allHotTopics = trends.map(t => ({
    ...t,
    category: t.category || categorizeKeyword(t.keyword, t.articles),
  }));
  _hotTopicsCollectedAt = collectedAt;

  renderFilteredHotTopics(container, 'all');
}

function renderFilteredHotTopics(container, filter) {
  if (!container) return;

  const filtered = filter === 'all'
    ? _allHotTopics
    : _allHotTopics.filter(t => t.category === filter);

  container.innerHTML = `
    <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">
      업데이트: ${relativeTime(_hotTopicsCollectedAt)}
      ${filter !== 'all' ? ` · ${TREND_CAT_LABELS[filter] || filter} ${filtered.length}건` : ` · 전체 ${_allHotTopics.length}건`}
    </div>
    ${filtered.length === 0 ? '<div style="padding:16px;color:var(--text-dim);text-align:center">해당 카테고리 키워드 없음</div>' : `
    <div class="trend-list">
      ${filtered.slice(0, 20).map((t, i) => `
        <div class="trend-item-v2">
          <div class="trend-item-top">
            <span class="trend-rank">${i + 1}</span>
            <span class="trend-keyword" style="cursor:pointer" onclick="exploreTrendKeyword('${t.keyword.replace(/'/g, "\\'")}')">
              ${t.keyword}
            </span>
            <span class="trend-cat-tag" style="background:${getCatColor(t.category)}">${TREND_CAT_LABELS[t.category] || '기타'}</span>
            ${t.traffic ? `<span class="trend-traffic">${t.traffic}</span>` : ''}
          </div>
          ${t.articles?.[0] ? `<a href="${t.articles[0].url || '#'}" target="_blank" class="trend-article-link">${t.articles[0].title || ''}</a>` : ''}
        </div>
      `).join('')}
    </div>`}
  `;
}

function filterHotTopics(category, btn) {
  document.querySelectorAll('.trends-realtime .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const container = document.getElementById('trends-google-daily');
  renderFilteredHotTopics(container, category);
}

function getCatColor(cat) {
  const colors = { tech: '#6366f1', finance: '#f59e0b', policy: '#ef4444', lifestyle: '#10b981', world: '#3b82f6', society: '#8b5cf6', culture: '#ec4899' };
  return (colors[cat] || '#666') + '30';
}

// ── Keyword Interest Chart ──

let _trendPeriod = 30;

// 캐시 (같은 키워드+기간 반복 호출 방지)
const _trendCache = {};

function _cacheKey(keywords, days) {
  return `${keywords.sort().join(',')}|${days}`;
}

function changeTrendPeriod(days) {
  _trendPeriod = days;
  document.querySelectorAll('.trends-keywords .period-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(days + '일'));
  });
  searchNaverTrend();
}

async function searchNaverTrend() {
  const input = document.getElementById('trend-keyword-input');
  if (!input) return;

  const keywords = input.value.split(',').map(k => k.trim()).filter(Boolean).slice(0, 5);
  if (!keywords.length) return;

  const chartContainer = document.getElementById('trends-keyword-chart');
  const insightContainer = document.getElementById('trends-keyword-insight');

  // 캐시 확인 (10분 유효)
  const key = _cacheKey(keywords, _trendPeriod);
  const cached = _trendCache[key];
  if (cached && (Date.now() - cached.time) < 10 * 60 * 1000) {
    renderNaverTrendChart(cached.data, chartContainer);
    renderKeywordInsight(cached.data, insightContainer);
    return;
  }

  chartContainer.innerHTML = '<div style="padding:40px;text-align:center"><span class="spinner"></span></div>';
  if (insightContainer) insightContainer.innerHTML = '';

  const keywordGroups = keywords.map(kw => ({ groupName: kw, keywords: [kw] }));

  try {
    const result = await window.api.fetchNaverTrend(keywordGroups, _trendPeriod);
    if (!result.success) {
      chartContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px">${result.message}</div>`;
      return;
    }

    if (!result.data?.length) {
      chartContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim)">데이터 없음 (네이버 API 키 확인)</div>';
      return;
    }

    // 캐시 저장
    _trendCache[key] = { data: result.data, time: Date.now() };

    renderNaverTrendChart(result.data, chartContainer);
    renderKeywordInsight(result.data, insightContainer);
  } catch (err) {
    chartContainer.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

const TREND_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function renderNaverTrendChart(groups, container) {
  destroyChart('keywordTrend');

  if (!container) return;
  if (!document.getElementById('chart-keyword-trend')) {
    container.innerHTML = '<canvas id="chart-keyword-trend"></canvas>';
  }

  const ctx = document.getElementById('chart-keyword-trend');
  if (!ctx) return;

  const labels = (groups[0]?.data || []).map(d => d.date);
  const datasets = groups.map((g, i) => ({
    label: g.groupName,
    data: g.data.map(d => d.ratio),
    borderColor: TREND_COLORS[i % TREND_COLORS.length],
    backgroundColor: TREND_COLORS[i % TREND_COLORS.length] + '20',
    tension: 0.3,
    fill: false,
    pointRadius: 2,
    borderWidth: 2,
  }));

  AppState.charts['keywordTrend'] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: '#ccc', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
          }
        },
      },
      scales: {
        x: { ticks: { color: '#888', font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 0, max: 100, ticks: { color: '#888', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: '검색량 (0~100)', color: '#888', font: { size: 10 } } },
      },
    },
  });
}

// 키워드 인사이트 (트렌드 방향 + 요약)
function renderKeywordInsight(groups, container) {
  if (!container) return;

  const insights = groups.map((g, i) => {
    const data = g.data || [];
    if (data.length < 2) return null;

    const latest = data[data.length - 1]?.ratio || 0;
    const prev = data[Math.max(0, data.length - 2)]?.ratio || 0;
    const first = data[0]?.ratio || 0;
    const avg = data.reduce((s, d) => s + d.ratio, 0) / data.length;
    const max = Math.max(...data.map(d => d.ratio));
    const maxDate = data.find(d => d.ratio === max)?.date || '';

    // 트렌드 방향
    const shortChange = latest - prev;
    const longChange = latest - first;
    let direction, dirColor, dirIcon;
    if (longChange > 10) { direction = '급상승'; dirColor = '#10b981'; dirIcon = '🔥'; }
    else if (longChange > 3) { direction = '상승'; dirColor = '#10b981'; dirIcon = '↑'; }
    else if (longChange < -10) { direction = '급하락'; dirColor = '#ef4444'; dirIcon = '↓↓'; }
    else if (longChange < -3) { direction = '하락'; dirColor = '#ef4444'; dirIcon = '↓'; }
    else { direction = '유지'; dirColor = '#888'; dirIcon = '→'; }

    return {
      keyword: g.groupName,
      latest, avg: Math.round(avg), max, maxDate,
      direction, dirColor, dirIcon, longChange,
      color: TREND_COLORS[i % TREND_COLORS.length],
    };
  }).filter(Boolean);

  if (!insights.length) { container.innerHTML = ''; return; }

  // 가장 뜨는 키워드, 가장 떨어지는 키워드
  const hottest = [...insights].sort((a, b) => b.longChange - a.longChange)[0];
  const coldest = [...insights].sort((a, b) => a.longChange - b.longChange)[0];

  container.innerHTML = `
    <div class="keyword-insight-grid">
      ${insights.map(ins => `
        <div class="keyword-insight-card" style="border-left:3px solid ${ins.color}">
          <div class="keyword-insight-name">${ins.keyword}</div>
          <div class="keyword-insight-dir" style="color:${ins.dirColor}">${ins.dirIcon} ${ins.direction} (${ins.longChange > 0 ? '+' : ''}${Math.round(ins.longChange)})</div>
          <div class="keyword-insight-detail">
            현재 <strong>${ins.latest}</strong> · 평균 ${ins.avg} · 최고 ${ins.max} (${ins.maxDate})
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">
      ${hottest && hottest.longChange > 0 ? `가장 뜨는 키워드: <strong style="color:#10b981">${hottest.keyword}</strong> (+${Math.round(hottest.longChange)})` : ''}
      ${coldest && coldest.longChange < 0 ? ` · 하락 키워드: <strong style="color:#ef4444">${coldest.keyword}</strong> (${Math.round(coldest.longChange)})` : ''}
    </div>
  `
}

// ── Policy Feeds (RSS) ──

async function loadPolicyFeeds() {
  const container = document.getElementById('trends-policy');
  if (!container) return;

  try {
    // Try cached first
    let snapshot = await window.api.getTrendSnapshot('policy');
    const isFresh = snapshot && (Date.now() - new Date(snapshot.collected_at).getTime()) < 30 * 60 * 1000; // 30분

    if (!isFresh) {
      const result = await window.api.fetchPolicyFeeds();
      if (result.success) {
        snapshot = { data: result.data, collected_at: new Date().toISOString() };
      } else if (!snapshot) {
        container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
        return;
      }
    }

    renderPolicyFeeds(container, snapshot.data);
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

function renderPolicyFeeds(container, feeds) {
  if (!feeds?.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-dim)">정책 데이터 없음</div>';
    return;
  }

  const allItems = feeds.flatMap(f => f.items || [])
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 12);

  container.innerHTML = `
    <div class="news-list">
      ${allItems.map(item => `
        <a class="news-item news-link" href="${item.link || '#'}" target="_blank">
          <div class="news-title">${item.title}</div>
          <div class="news-desc">${item.description?.slice(0, 80) || ''}</div>
          <div class="news-meta">
            <span>${item.source || '정책브리핑'}</span>
            <span style="margin-left:8px">${relativeTime(item.pubDate)}</span>
          </div>
        </a>
      `).join('')}
    </div>
  `;
}

// ── News Hot Keywords ──

async function loadNewsKeywords() {
  const container = document.getElementById('trends-news-keywords');
  if (!container) return;

  try {
    const result = await window.api.fetchNewsFeeds();
    if (!result.success) {
      container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
      return;
    }

    const keywords = result.keywords || [];
    if (!keywords.length) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-dim)">키워드 추출 실패</div>';
      return;
    }

    renderNewsKeywords(container, keywords);
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

function renderNewsKeywords(container, keywords) {
  const maxCount = keywords[0]?.count || 1;

  container.innerHTML = `
    <div class="keyword-cloud">
      ${keywords.slice(0, 20).map(kw => {
        const pct = Math.round((kw.count / maxCount) * 100);
        const size = Math.max(12, Math.min(22, 12 + (pct / 10)));
        const opacity = Math.max(0.5, pct / 100);
        return `<span class="keyword-tag" style="font-size:${size}px;opacity:${opacity}" onclick="exploreTrendKeyword('${kw.keyword.replace(/'/g, "\\'")}')">${kw.keyword}<sup style="font-size:10px;margin-left:2px">${kw.count}</sup></span>`;
      }).join('')}
    </div>
  `;
}

// ── Category News (Naver) ──

let _trendNewsCat = 'tech';

function changeTrendNewsCat(cat, btn) {
  _trendNewsCat = cat;
  document.querySelectorAll('.trends-news .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTrendNews(cat);
}

async function loadTrendNews(cat) {
  const container = document.getElementById('trends-news-list');
  if (!container) return;

  const keywords = TREND_CATEGORIES[cat];
  if (!keywords) return;

  container.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';

  try {
    // 핵심 키워드 5개로 OR 검색 (더 다양한 결과)
    const query = keywords.slice(0, 5).join(' OR ');
    const result = await window.api.fetchNaverNews(query, 10);

    if (!result.success) {
      const isAuth = result.message?.includes('Authentication') || result.message?.includes('인증') || result.message?.includes('Scope');
      if (isAuth) {
        container.innerHTML = `<div style="padding:12px;font-size:13px">
          <div style="color:var(--warning);margin-bottom:8px">네이버 API 인증 실패</div>
          <div style="color:var(--text-dim);font-size:12px">
            1. 설정 탭에서 네이버 Client ID/Secret 입력<br>
            2. <a href="https://developers.naver.com/apps" target="_blank" style="color:var(--accent)">네이버 개발자센터</a>에서 앱 → "검색" API 사용 등록 확인
          </div>
        </div>`;
      } else {
        container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
      }
      return;
    }

    if (!result.data?.length) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:13px">뉴스 없음</div>';
      return;
    }

    container.innerHTML = `
      <div class="news-list">
        ${result.data.map(n => `
          <a class="news-item news-link" href="${n.link || '#'}" target="_blank">
            <div class="news-title">${n.title}</div>
            <div class="news-desc">${n.description?.slice(0, 100) || ''}</div>
            <div class="news-meta">${relativeTime(n.pubDate)}</div>
          </a>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

// ── Content Recommendations ──

async function generateRecommendations() {
  const container = document.getElementById('trends-recommendations');
  if (!container) return;

  try {
    // Get trending keywords from Google
    const googleSnapshot = await window.api.getTrendSnapshot('google');
    // Get news keywords
    const newsSnapshot = await window.api.getTrendSnapshot('news');

    const trendingKeywords = [];

    // Google trends
    if (googleSnapshot?.data?.length) {
      for (const t of googleSnapshot.data.slice(0, 10)) {
        trendingKeywords.push({ keyword: t.keyword, source: 'google', traffic: t.traffic, articles: t.articles || [] });
      }
    }

    // News keywords (from RSS)
    if (newsSnapshot?.data) {
      const newsFeeds = newsSnapshot.data;
      const allItems = (Array.isArray(newsFeeds) ? newsFeeds : []).flatMap(f => f.items || []);
      // Extract top keywords from news titles
      const words = {};
      for (const item of allItems) {
        const matches = (item.title || '').match(/[가-힣]{2,}/g) || [];
        for (const w of matches) {
          if (w.length >= 2) words[w] = (words[w] || 0) + 1;
        }
      }
      const topNews = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 5);
      for (const [kw, count] of topNews) {
        if (!trendingKeywords.some(t => t.keyword === kw)) {
          trendingKeywords.push({ keyword: kw, source: 'news', traffic: `뉴스 ${count}건` });
        }
      }
    }

    if (!trendingKeywords.length) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:13px">트렌드 데이터 수집 후 추천이 표시됩니다.</div>';
      return;
    }

    // Get my post performance by category
    const posts = await window.api.getPostsWithLatestMetrics({ days: 30 });
    const catPerf = {};
    for (const p of posts) {
      const cat = p.category || 'other';
      if (!catPerf[cat]) catPerf[cat] = { count: 0, totalLikes: 0, totalViews: 0 };
      catPerf[cat].count++;
      catPerf[cat].totalLikes += p.likes || 0;
      catPerf[cat].totalViews += p.views || 0;
    }

    // Match trending keywords to categories
    const recommendations = [];
    for (const trend of trendingKeywords) {
      const kw = trend.keyword;
      let matchedCat = null;
      for (const [cat, keywords] of Object.entries(TREND_CATEGORIES)) {
        if (keywords.some(k => kw.includes(k) || k.includes(kw))) {
          matchedCat = cat;
          break;
        }
      }

      const perf = matchedCat ? catPerf[matchedCat] : null;
      const avgLikes = perf ? Math.round(perf.totalLikes / perf.count) : 0;
      const avgViews = perf ? Math.round(perf.totalViews / perf.count) : 0;

      // Score: 트렌드성 + 내 강점 매칭
      const trendScore = trend.source === 'google' ? 2 : 1;
      const perfScore = avgLikes > 0 ? Math.log10(avgLikes + 1) : 0;
      const score = trendScore + perfScore;

      recommendations.push({
        keyword: kw,
        source: trend.source,
        category: matchedCat || '기타',
        traffic: trend.traffic,
        avgLikes,
        avgViews,
        hasContent: perf ? perf.count > 0 : false,
        score,
      });
    }

    recommendations.sort((a, b) => b.score - a.score);

    container.innerHTML = `
      <div class="recommend-list">
        ${recommendations.slice(0, 10).map((r, i) => `
          <div class="recommend-item" onclick="exploreTrendKeyword('${r.keyword.replace(/'/g, "\\'")}')">
            <span class="trend-rank" style="width:20px;height:20px;font-size:10px">${i + 1}</span>
            <div style="flex:1;min-width:0">
              <div class="recommend-keyword">${r.keyword}</div>
              <div style="font-size:11px;color:var(--text-dim)">${r.traffic || ''}</div>
            </div>
            <span class="category-badge">${TREND_CAT_LABELS[r.category] || r.category}</span>
            ${r.hasContent
              ? `<span style="font-size:11px;color:var(--success)">평균 ♥${formatNumber(r.avgLikes)} 👁${formatNumber(r.avgViews)}</span>`
              : '<span style="font-size:11px;color:#f59e0b">미개척</span>'}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">추천 생성 실패: ${err.message}</div>`;
  }
}

// ── YouTube Trending ──

async function loadYoutubeTrending() {
  const container = document.getElementById('trends-youtube');
  if (!container) return;

  try {
    // Try cached first
    let snapshot = await window.api.getTrendSnapshot('youtube');
    const isFresh = snapshot && (Date.now() - new Date(snapshot.collected_at).getTime()) < 60 * 60 * 1000;

    if (!isFresh) {
      const result = await window.api.fetchYoutubeTrending();
      if (result.success) {
        snapshot = { data: result.data, collected_at: new Date().toISOString() };
      } else if (!snapshot) {
        container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
        return;
      }
    }

    renderYoutubeTrending(container, snapshot.data);
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

function renderYoutubeTrending(container, videos) {
  if (!videos?.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-dim)">YouTube API 키를 설정하세요.</div>';
    return;
  }

  container.innerHTML = `
    <div class="youtube-grid">
      ${videos.slice(0, 12).map((v, i) => `
        <a class="youtube-item" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="text-decoration:none;color:inherit">
          <div class="youtube-rank">${i + 1}</div>
          <div class="youtube-info">
            <div class="youtube-title">${v.title}</div>
            <div class="youtube-meta">
              <span>${v.channel}</span>
              <span>👁 ${formatNumber(v.views)}</span>
              <span>♥ ${formatNumber(v.likes)}</span>
            </div>
          </div>
        </a>
      `).join('')}
    </div>
  `;
}

// ── Refresh All ──

// ── Naver Shopping Trend ──

async function loadShoppingTrend(category) {
  const container = document.getElementById('trends-shopping');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:16px"><span class="spinner"></span></div>';

  try {
    const result = await window.api.fetchNaverShopping(category, 30);
    if (!result.success) {
      container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">${result.message}</div>`;
      return;
    }

    if (!result.data?.length) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:13px">데이터 없음</div>';
      return;
    }

    const keywords = result.data[0]?.data || [];
    container.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${keywords.slice(0, 20).map((kw, i) => `
          <span class="keyword-tag" style="font-size:12px;padding:4px 10px" onclick="exploreTrendKeyword('${(kw.period || kw.keyword || '').replace(/'/g, "\\'")}')">
            <span style="color:var(--accent);font-weight:600;margin-right:3px">${i+1}</span>
            ${kw.period || kw.keyword || JSON.stringify(kw).slice(0, 20)}
          </span>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">오류: ${err.message}</div>`;
  }
}

// ── Refresh All ──

async function refreshAllTrends() {
  const btn = document.getElementById('btn-refresh-trends');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 수집 중...'; }

  await Promise.allSettled([
    loadGoogleDailyTrends(),
    searchNaverTrend(),
    loadPolicyFeeds(),
    loadNewsKeywords(),
    loadTrendNews(_trendNewsCat),
    loadYoutubeTrending(),
  ]);
  await Promise.allSettled([generateRecommendations(), loadTrendCorrelation(), loadContentCalendar()]);

  if (btn) { btn.disabled = false; btn.innerHTML = '새로고침'; }
  showToast('트렌드 새로고침 완료');
}

// ── Explore a specific trend keyword ──

function exploreTrendKeyword(keyword) {
  // 1) 키워드 관심도 차트에 추가
  const input = document.getElementById('trend-keyword-input');
  if (input) {
    const existing = input.value.split(',').map(k => k.trim()).filter(Boolean);
    if (!existing.includes(keyword)) {
      existing.unshift(keyword);
      input.value = existing.slice(0, 5).join(', ');
    }
    searchNaverTrend();
  }

  // 2) 관련 뉴스 패널 표시
  showKeywordDetail(keyword);
}

async function showKeywordDetail(keyword) {
  // 기존 패널 제거
  document.querySelector('.keyword-detail-panel')?.remove();

  const panel = document.createElement('div');
  panel.className = 'keyword-detail-panel';
  panel.innerHTML = `
    <div class="keyword-detail-header">
      <h3>"${keyword}" 상세</h3>
      <button class="btn-secondary btn-small" onclick="this.closest('.keyword-detail-panel').remove()">닫기</button>
    </div>
    <div class="keyword-detail-body">
      <div class="keyword-detail-section">
        <div class="card-title" style="font-size:13px">관련 뉴스 (네이버)</div>
        <div id="kd-news"><span class="spinner"></span></div>
      </div>
    </div>
  `;

  const view = document.getElementById('view-trends');
  view.querySelector('.view-header').after(panel);

  const newsResult = await window.api.fetchNaverNews(keyword, 8).catch(e => ({ success: false, message: e.message }));

  // 관련 뉴스
  const newsEl = document.getElementById('kd-news');
  if (newsEl) {
    if (newsResult.success && newsResult.data?.length) {
      newsEl.innerHTML = `<div class="news-list">${newsResult.data.map(n => `
        <a class="news-item news-link" href="${n.link || '#'}" target="_blank">
          <div class="news-title">${n.title}</div>
          <div class="news-meta">${relativeTime(n.pubDate)}</div>
        </a>
      `).join('')}</div>`;
    } else {
      newsEl.innerHTML = `<span style="color:var(--text-dim);font-size:12px">${newsResult.message || '뉴스 없음'}</span>`;
    }
  }
}

// ── Trend History (과거 스냅샷 비교) ──

async function showTrendHistory() {
  const snapshots = await window.api.getTrendSnapshots('google', 10);
  if (!snapshots?.length || snapshots.length < 2) {
    showToast('히스토리 비교에 최소 2개의 스냅샷이 필요합니다', 'error');
    return;
  }

  const latest = snapshots[0];
  const previous = snapshots[1];

  const latestKws = new Set((latest.data || []).map(t => t.keyword));
  const prevKws = new Set((previous.data || []).map(t => t.keyword));

  const newKeywords = [...latestKws].filter(k => !prevKws.has(k));
  const droppedKeywords = [...prevKws].filter(k => !latestKws.has(k));
  const stayedKeywords = [...latestKws].filter(k => prevKws.has(k));

  document.querySelector('.trend-history-panel')?.remove();

  const panel = document.createElement('div');
  panel.className = 'keyword-detail-panel trend-history-panel';
  panel.innerHTML = `
    <div class="keyword-detail-header">
      <h3>트렌드 변화</h3>
      <span style="font-size:11px;color:var(--text-dim)">${relativeTime(previous.collected_at)} → ${relativeTime(latest.collected_at)}</span>
      <button class="btn-secondary btn-small" onclick="this.closest('.trend-history-panel').remove()">닫기</button>
    </div>
    <div class="keyword-detail-body" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div>
        <div style="font-size:12px;font-weight:600;color:#10b981;margin-bottom:8px">새로 진입 (${newKeywords.length})</div>
        ${newKeywords.length ? newKeywords.map(k => `<div class="trend-item" style="padding:4px 8px" onclick="exploreTrendKeyword('${k.replace(/'/g, "\\'")}')"><span class="trend-keyword">${k}</span></div>`).join('') : '<span style="color:var(--text-dim);font-size:12px">없음</span>'}
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:8px">유지 (${stayedKeywords.length})</div>
        ${stayedKeywords.slice(0, 10).map(k => `<div style="padding:2px 8px;font-size:12px;color:var(--text-dim)">${k}</div>`).join('')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:8px">이탈 (${droppedKeywords.length})</div>
        ${droppedKeywords.length ? droppedKeywords.map(k => `<div style="padding:2px 8px;font-size:12px;color:var(--text-dim);text-decoration:line-through">${k}</div>`).join('') : '<span style="color:var(--text-dim);font-size:12px">없음</span>'}
      </div>
    </div>
  `;

  const view = document.getElementById('view-trends');
  view.querySelector('.view-header').after(panel);
}

// ── Keyword Presets & Favorites ──

function applyKeywordPreset(keywords) {
  const input = document.getElementById('trend-keyword-input');
  if (input) {
    input.value = keywords;
    searchNaverTrend();
  }
}

async function applyHotTopicPreset() {
  const snapshot = await window.api.getTrendSnapshot('hot-topics');
  if (!snapshot?.data?.length) {
    showToast('핫 토픽 데이터 없음', 'error');
    return;
  }
  const topKeywords = snapshot.data.slice(0, 5).map(t => t.keyword).join(',');
  applyKeywordPreset(topKeywords);
}

async function saveFavoriteKeywords() {
  const input = document.getElementById('trend-keyword-input');
  if (!input || !input.value.trim()) return;

  const settings = await window.api.loadAnalyzerSettings();
  settings.trendFavorites = input.value.trim();
  await window.api.saveAnalyzerSettings(settings);
  showToast('키워드 즐겨찾기 저장됨');
}

async function loadFavoriteKeywords() {
  const settings = await window.api.loadAnalyzerSettings();
  if (settings.trendFavorites) {
    const input = document.getElementById('trend-keyword-input');
    if (input) {
      input.value = settings.trendFavorites;
      searchNaverTrend();
    }
  } else {
    showToast('저장된 즐겨찾기가 없습니다', 'error');
  }
}

// ── Trend ↔ Content Correlation ──

async function loadTrendCorrelation() {
  const container = document.getElementById('trends-correlation');
  if (!container) return;

  try {
    // 최근 30일 포스트 + 트렌드 스냅샷
    const posts = await window.api.getPostsWithLatestMetrics({ days: 30 });
    const snapshots = await window.api.getTrendSnapshots('google', 30);

    if (!posts.length || !snapshots.length) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-dim);font-size:13px">데이터가 부족합니다 (포스트 또는 트렌드 스냅샷 필요)</div>';
      return;
    }

    // 각 포스트 발행일에 어떤 키워드가 트렌딩이었는지 매칭
    const correlations = [];

    for (const post of posts) {
      const postDate = post.posted_at?.slice(0, 10);
      if (!postDate) continue;

      // 발행일에 가장 가까운 트렌드 스냅샷 찾기
      let closestSnapshot = null;
      let closestDiff = Infinity;
      for (const snap of snapshots) {
        const snapDate = snap.collected_at?.slice(0, 10);
        const diff = Math.abs(new Date(postDate) - new Date(snapDate));
        if (diff < closestDiff) {
          closestDiff = diff;
          closestSnapshot = snap;
        }
      }

      if (!closestSnapshot || closestDiff > 2 * 24 * 60 * 60 * 1000) continue; // 2일 초과면 skip

      // 포스트 캡션과 트렌드 키워드 매칭
      const caption = (post.caption || '').toLowerCase();
      const matchedTrends = (closestSnapshot.data || []).filter(t =>
        caption.includes(t.keyword.toLowerCase()) || t.keyword.toLowerCase().includes((post.category || '').toLowerCase())
      );

      if (matchedTrends.length > 0) {
        correlations.push({
          post,
          matchedKeywords: matchedTrends.map(t => t.keyword).slice(0, 3),
          likes: post.likes || 0,
          views: post.views || 0,
          engagement: parseFloat(engagementRate(post)) || 0,
        });
      }
    }

    // 트렌드 매칭 vs 비매칭 성과 비교
    const matchedPosts = correlations;
    const unmatchedPosts = posts.filter(p => !correlations.some(c => c.post.id === p.id));

    const avgMatched = {
      likes: matchedPosts.length ? Math.round(matchedPosts.reduce((s, c) => s + c.likes, 0) / matchedPosts.length) : 0,
      views: matchedPosts.length ? Math.round(matchedPosts.reduce((s, c) => s + c.views, 0) / matchedPosts.length) : 0,
    };
    const avgUnmatched = {
      likes: unmatchedPosts.length ? Math.round(unmatchedPosts.reduce((s, p) => s + (p.likes || 0), 0) / unmatchedPosts.length) : 0,
      views: unmatchedPosts.length ? Math.round(unmatchedPosts.reduce((s, p) => s + (p.views || 0), 0) / unmatchedPosts.length) : 0,
    };

    const likesDiff = avgUnmatched.likes > 0 ? Math.round((avgMatched.likes - avgUnmatched.likes) / avgUnmatched.likes * 100) : 0;
    const viewsDiff = avgUnmatched.views > 0 ? Math.round((avgMatched.views - avgUnmatched.views) / avgUnmatched.views * 100) : 0;

    container.innerHTML = `
      <div class="correlation-summary">
        <div class="correlation-card">
          <div class="correlation-label">트렌드 매칭 포스트</div>
          <div class="correlation-value">${matchedPosts.length}개</div>
          <div class="correlation-sub">평균 ♥ ${formatNumber(avgMatched.likes)} · 👁 ${formatNumber(avgMatched.views)}</div>
        </div>
        <div class="correlation-card">
          <div class="correlation-label">비매칭 포스트</div>
          <div class="correlation-value">${unmatchedPosts.length}개</div>
          <div class="correlation-sub">평균 ♥ ${formatNumber(avgUnmatched.likes)} · 👁 ${formatNumber(avgUnmatched.views)}</div>
        </div>
        <div class="correlation-card">
          <div class="correlation-label">트렌드 효과</div>
          <div class="correlation-value" style="color:${likesDiff >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${likesDiff >= 0 ? '+' : ''}${likesDiff}% 좋아요
          </div>
          <div class="correlation-sub" style="color:${viewsDiff >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${viewsDiff >= 0 ? '+' : ''}${viewsDiff}% 조회수
          </div>
        </div>
      </div>
      ${matchedPosts.length > 0 ? `
        <div style="margin-top:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px">트렌드 매칭 포스트 상세</div>
          <table class="data-table">
            <thead><tr><th>플랫폼</th><th>매칭 키워드</th><th class="num">좋아요</th><th class="num">조회</th><th>발행일</th></tr></thead>
            <tbody>
              ${matchedPosts.sort((a, b) => b.likes - a.likes).slice(0, 10).map(c => `
                <tr>
                  <td><span class="platform-badge ${c.post.platform}">${PLATFORM_LABELS[c.post.platform]}</span></td>
                  <td>${c.matchedKeywords.map(k => `<span class="keyword-tag" style="font-size:11px;padding:2px 6px">${k}</span>`).join(' ')}</td>
                  <td class="num">${formatNumber(c.likes)}</td>
                  <td class="num">${formatNumber(c.views)}</td>
                  <td>${formatDate(c.post.posted_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">분석 실패: ${err.message}</div>`;
  }
}

// ── Export Trend Data ──

// ── Content Calendar ──

async function loadContentCalendar() {
  const container = document.getElementById('trends-calendar');
  if (!container) return;

  try {
    // 1) 내 발행 패턴 분석 (최근 90일)
    const posts = await window.api.getPostsWithLatestMetrics({ days: 90 });

    // 요일별 발행 수 + 평균 성과
    const dowStats = Array.from({ length: 7 }, () => ({ count: 0, totalLikes: 0, totalViews: 0 }));
    for (const p of posts) {
      if (!p.posted_at) continue;
      const dow = new Date(p.posted_at).getDay();
      dowStats[dow].count++;
      dowStats[dow].totalLikes += p.likes || 0;
      dowStats[dow].totalViews += p.views || 0;
    }

    // 최적 요일 찾기 (평균 좋아요 기준)
    const dowPerf = dowStats.map((s, i) => ({
      dow: i,
      label: DOW_LABELS[i],
      count: s.count,
      avgLikes: s.count > 0 ? Math.round(s.totalLikes / s.count) : 0,
      avgViews: s.count > 0 ? Math.round(s.totalViews / s.count) : 0,
    })).sort((a, b) => b.avgLikes - a.avgLikes);

    // 2) 카테고리별 성과
    const catPerf = {};
    for (const p of posts) {
      const cat = p.category || 'other';
      if (!catPerf[cat]) catPerf[cat] = { count: 0, totalLikes: 0 };
      catPerf[cat].count++;
      catPerf[cat].totalLikes += p.likes || 0;
    }
    const bestCats = Object.entries(catPerf)
      .map(([cat, s]) => ({ cat, avgLikes: Math.round(s.totalLikes / s.count) }))
      .sort((a, b) => b.avgLikes - a.avgLikes);

    // 3) 현재 트렌드 키워드
    const hotSnapshot = await window.api.getTrendSnapshot('hot-topics');
    const hotKeywords = (hotSnapshot?.data || []).slice(0, 5).map(t => t.keyword);

    // 4) 이번 주 캘린더 생성
    const today = new Date();
    const todayDow = today.getDay();
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dow = date.getDay();
      const perf = dowPerf.find(d => d.dow === dow);
      weekDays.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        label: DOW_LABELS[dow],
        isToday: i === 0,
        perf,
      });
    }

    // 상위 3일에 추천 콘텐츠 배정
    const topDows = dowPerf.slice(0, 3).map(d => d.dow);
    const suggestions = weekDays.map(day => {
      const dow = DOW_LABELS.indexOf(day.label);
      const isGoodDay = topDows.includes(dow);
      let suggestion = null;

      if (isGoodDay && hotKeywords.length > 0) {
        const trendKw = hotKeywords.shift() || hotKeywords[0];
        const bestCat = bestCats[0]?.cat || 'tech';
        suggestion = { keyword: trendKw, category: bestCat };
      }

      return { ...day, suggestion, isGoodDay };
    });

    container.innerHTML = `
      <div class="calendar-grid">
        ${suggestions.map(day => `
          <div class="calendar-day ${day.isToday ? 'today' : ''} ${day.isGoodDay ? 'recommended' : ''}">
            <div class="calendar-date">${day.label} ${day.date}</div>
            <div class="calendar-perf">
              ${day.perf?.count > 0 ? `평균 ♥${formatNumber(day.perf.avgLikes)}` : '<span style="color:var(--text-dim)">데이터 없음</span>'}
            </div>
            ${day.suggestion ? `
              <div class="calendar-suggest">
                <span class="keyword-tag" style="font-size:11px;padding:2px 8px">${day.suggestion.keyword}</span>
              </div>
            ` : day.isGoodDay ? `<div class="calendar-suggest" style="color:var(--success);font-size:11px">발행 추천일</div>` : ''}
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-dim)">
        성과 최고 요일: ${dowPerf.slice(0, 3).map(d => `<strong>${d.label}</strong>(♥${formatNumber(d.avgLikes)})`).join(', ')}
        ${bestCats.length > 0 ? ` · 성과 최고 카테고리: <strong>${bestCats[0].cat}</strong>` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">캘린더 생성 실패: ${err.message}</div>`;
  }
}

// ── Export ──

// ── AI Content Ideas ──

async function generateAIContentIdeas() {
  const container = document.getElementById('trends-ai-ideas');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:16px"><span class="spinner"></span> AI 콘텐츠 아이디어 생성 중...</div>';

  try {
    // 현재 트렌드 + 내 성과 데이터 수집
    const hotSnapshot = await window.api.getTrendSnapshot('hot-topics');
    const posts = await window.api.getPostsWithLatestMetrics({ days: 30 });

    const hotKeywords = (hotSnapshot?.data || []).slice(0, 10).map(t => t.keyword);

    // 내 성과 분석
    const catPerf = {};
    for (const p of posts) {
      const cat = p.category || 'other';
      if (!catPerf[cat]) catPerf[cat] = { count: 0, totalLikes: 0 };
      catPerf[cat].count++;
      catPerf[cat].totalLikes += p.likes || 0;
    }
    const bestCat = Object.entries(catPerf).sort((a, b) => (b[1].totalLikes / b[1].count) - (a[1].totalLikes / a[1].count))[0];
    const bestCatName = bestCat ? bestCat[0] : 'tech';
    const avgLikes = bestCat ? Math.round(bestCat[1].totalLikes / bestCat[1].count) : 0;

    // 트렌드와 강점 카테고리 매칭
    const matchedTrends = hotKeywords.filter(kw => {
      const cat = categorizeKeyword(kw, []);
      return cat === bestCatName || cat === 'other';
    }).slice(0, 5);

    // AI 스타일 콘텐츠 아이디어 생성 (로컬 규칙 기반)
    const ideas = [];

    // 1. 트렌드 + 내 강점 매칭
    for (const kw of matchedTrends) {
      ideas.push({
        type: 'trend',
        title: `"${kw}" 트렌드 활용`,
        desc: `현재 뜨는 "${kw}" 키워드를 ${TREND_CAT_LABELS[bestCatName] || bestCatName} 관점에서 카드뉴스로 제작`,
        reason: `내 ${TREND_CAT_LABELS[bestCatName] || bestCatName} 카테고리 평균 ♥${formatNumber(avgLikes)}`,
      });
    }

    // 2. 성과 좋았던 포스트 리메이크
    const topPosts = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
    for (const p of topPosts) {
      const caption = (p.caption || '').slice(0, 30);
      ideas.push({
        type: 'remake',
        title: `인기 포스트 리메이크: "${caption}..."`,
        desc: `♥${formatNumber(p.likes)} 받은 콘텐츠를 업데이트 버전으로 재발행`,
        reason: `기존 성과 ♥${formatNumber(p.likes)} 👁${formatNumber(p.views || 0)}`,
      });
    }

    // 3. 미개척 카테고리 도전
    const allCats = Object.keys(TREND_CATEGORIES);
    const unexplored = allCats.filter(c => !catPerf[c] || catPerf[c].count < 2);
    for (const cat of unexplored.slice(0, 2)) {
      const catTrend = hotKeywords.find(kw => categorizeKeyword(kw, []) === cat);
      ideas.push({
        type: 'explore',
        title: `${TREND_CAT_LABELS[cat] || cat} 카테고리 도전`,
        desc: catTrend ? `"${catTrend}" 트렌드로 새 카테고리 진입` : `${TREND_CAT_LABELS[cat] || cat} 분야 첫 콘텐츠 제작`,
        reason: '미개척 카테고리 — 새로운 오디언스 확보 기회',
      });
    }

    container.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">AI 콘텐츠 아이디어</div>
      <div class="ai-ideas-list">
        ${ideas.map(idea => `
          <div class="ai-idea-card ${idea.type}">
            <div class="ai-idea-type">${idea.type === 'trend' ? '🔥 트렌드' : idea.type === 'remake' ? '♻️ 리메이크' : '🆕 도전'}</div>
            <div class="ai-idea-title">${idea.title}</div>
            <div class="ai-idea-desc">${idea.desc}</div>
            <div class="ai-idea-reason">${idea.reason}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-dim);font-size:13px">아이디어 생성 실패: ${err.message}</div>`;
  }
}

// ── Export ──

async function exportTrendData() {
  try {
    const googleSnapshot = await window.api.getTrendSnapshot('google');
    const policySnapshot = await window.api.getTrendSnapshot('policy');
    const newsSnapshot = await window.api.getTrendSnapshot('news');
    const youtubeSnapshot = await window.api.getTrendSnapshot('youtube');

    const exportData = {
      exportedAt: new Date().toISOString(),
      google: googleSnapshot?.data || [],
      policy: policySnapshot?.data || [],
      news: newsSnapshot?.data || [],
      youtube: youtubeSnapshot?.data || [],
    };

    // JSON 다운로드
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('트렌드 데이터 내보내기 완료');
  } catch (err) {
    showToast('내보내기 실패: ' + err.message, 'error');
  }
}
