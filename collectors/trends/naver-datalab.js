// 네이버 데이터랩 검색어 트렌드 수집기
const https = require('https');

const API_URL = 'https://openapi.naver.com/v1/datalab/search';

/**
 * 네이버 데이터랩 검색어 트렌드 조회
 * @param {object} credentials - { clientId, clientSecret }
 * @param {Array<{groupName: string, keywords: string[]}>} keywordGroups - 키워드 그룹 (최대 5개)
 * @param {number} days - 조회 기간 (기본 30일)
 */
async function getSearchTrend(credentials, keywordGroups, days = 30) {
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new Error('네이버 API 키가 설정되지 않았습니다');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const body = JSON.stringify({
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: days <= 7 ? 'date' : days <= 90 ? 'week' : 'month',
    keywordGroups: keywordGroups.slice(0, 5).map(g => ({
      groupName: g.groupName,
      keywords: g.keywords.slice(0, 20),
    })),
  });

  return new Promise((resolve, reject) => {
    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': credentials.clientId,
        'X-Naver-Client-Secret': credentials.clientSecret,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(text);
          if (res.statusCode >= 400) {
            reject(new Error(json.errorMessage || `HTTP ${res.statusCode}`));
          } else {
            resolve(parseResponse(json));
          }
        } catch {
          reject(new Error(`Invalid response: ${text.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseResponse(json) {
  const results = json.results || [];
  return results.map(group => ({
    groupName: group.title,
    keywords: group.keywords,
    data: (group.data || []).map(d => ({
      date: d.period,
      ratio: d.ratio, // 상대 검색량 (0~100)
    })),
  }));
}

/**
 * 네이버 뉴스 검색
 * @param {object} credentials - { clientId, clientSecret }
 * @param {string} query - 검색어
 * @param {number} display - 결과 수 (기본 10, 최대 100)
 */
async function searchNews(credentials, query, display = 10) {
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new Error('네이버 API 키가 설정되지 않았습니다');
  }

  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;

  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'X-Naver-Client-Id': credentials.clientId,
        'X-Naver-Client-Secret': credentials.clientSecret,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(text);
          if (res.statusCode >= 400) {
            reject(new Error(json.errorMessage || `HTTP ${res.statusCode}`));
          } else {
            resolve((json.items || []).map(item => ({
              title: item.title?.replace(/<[^>]+>/g, '') || '',
              description: item.description?.replace(/<[^>]+>/g, '') || '',
              link: item.originallink || item.link || '',
              pubDate: item.pubDate || '',
            })));
          }
        } catch {
          reject(new Error(`Invalid response: ${text.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * 네이버 쇼핑 인사이트 - 카테고리별 인기 키워드
 * @param {object} credentials - { clientId, clientSecret }
 * @param {string} category - 쇼핑 카테고리 코드 (예: '50000000' = 패션의류)
 * @param {number} days - 조회 기간
 */
async function getShoppingTrend(credentials, category, days = 30) {
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new Error('네이버 API 키가 설정되지 않았습니다');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const body = JSON.stringify({
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: days <= 7 ? 'date' : 'week',
    category: [{ name: '카테고리', param: [category] }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://openapi.naver.com/v1/datalab/shopping/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': credentials.clientId,
        'X-Naver-Client-Secret': credentials.clientSecret,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(text);
          if (res.statusCode >= 400) {
            reject(new Error(json.errorMessage || `HTTP ${res.statusCode}`));
          } else {
            resolve(json.results || []);
          }
        } catch {
          reject(new Error(`Invalid response: ${text.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { getSearchTrend, searchNews, getShoppingTrend };
