// Google Trends collector using google-trends-api package
const googleTrends = require('google-trends-api');

const MAX_RETRIES = 0; // 재시도 없음 — 백그라운드 스케줄러에서만 호출
const RETRY_DELAYS = [];

// 요청 간 쿨다운 (Google throttle 방지)
let _lastRequestTime = 0;
const MIN_REQUEST_GAP = 3000; // 최소 3초 간격

async function withRetry(fn, label) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 요청 간 최소 간격 보장
      const now = Date.now();
      const gap = now - _lastRequestTime;
      if (gap < MIN_REQUEST_GAP) {
        await new Promise(r => setTimeout(r, MIN_REQUEST_GAP - gap));
      }
      _lastRequestTime = Date.now();

      const result = await fn();
      // google-trends-api returns string; check for HTML response
      if (typeof result === 'string' && result.trimStart().startsWith('<')) {
        throw new Error('Google이 HTML 응답을 반환했습니다 (rate limit)');
      }
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      const isThrottle = err.message?.includes('HTML') || err.message?.includes('Unexpected token') || err.message?.includes('rate limit');
      if (attempt < MAX_RETRIES && isThrottle) {
        const delay = RETRY_DELAYS[attempt] || 5000;
        console.log(`[GoogleTrends] ${label} 재시도 ${attempt + 1}/${MAX_RETRIES} (${delay}ms 후)`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * 한국 실시간 급상승 검색어 수집
 */
async function getDailyTrends() {
  const parsed = await withRetry(
    () => googleTrends.dailyTrends({ geo: 'KR' }),
    'dailyTrends'
  );
  const days = parsed.default?.trendingSearchesDays || [];

  const trends = [];
  for (const day of days) {
    for (const search of (day.trendingSearches || [])) {
      trends.push({
        keyword: search.title?.query || '',
        traffic: search.formattedTraffic || '',
        articles: (search.articles || []).slice(0, 2).map(a => ({
          title: a.title,
          source: a.source,
          url: a.url,
        })),
        image: search.image?.imageUrl || null,
        relatedQueries: (search.relatedQueries || []).map(q => q.query),
      });
    }
  }
  return trends;
}

/**
 * 키워드 관심도 시계열 (최근 N일)
 */
async function getInterestOverTime(keywords, days = 30) {
  if (!keywords.length) return [];

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - days);

  const parsed = await withRetry(
    () => googleTrends.interestOverTime({
      keyword: keywords.slice(0, 5),
      geo: 'KR',
      startTime,
    }),
    'interestOverTime'
  );

  const timelineData = parsed.default?.timelineData || [];

  return timelineData.map(point => ({
    date: new Date(point.time * 1000).toISOString().slice(0, 10),
    values: keywords.reduce((acc, kw, i) => {
      acc[kw] = point.value?.[i] || 0;
      return acc;
    }, {}),
  }));
}

/**
 * 관련 검색어 조회
 */
async function getRelatedQueries(keyword) {
  const parsed = await withRetry(
    () => googleTrends.relatedQueries({ keyword, geo: 'KR' }),
    'relatedQueries'
  );
  const data = parsed.default?.[keyword] || {};

  return {
    top: (data.top || []).map(q => ({ query: q.query, value: q.value })),
    rising: (data.rising || []).map(q => ({ query: q.query, value: q.value })),
  };
}

module.exports = { getDailyTrends, getInterestOverTime, getRelatedQueries };
