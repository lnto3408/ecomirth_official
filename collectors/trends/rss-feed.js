// RSS Feed collector — 정책브리핑 + 뉴스 RSS
const RssParser = require('rss-parser');

const parser = new RssParser({
  timeout: 10000,
  headers: { 'User-Agent': 'SNS-Analyzer/1.0' },
});

// 정책브리핑 RSS 피드 목록
const POLICY_FEEDS = {
  policy: { url: 'https://www.korea.kr/rss/policy.xml', label: '정책뉴스' },
  pressrelease: { url: 'https://www.korea.kr/rss/pressrelease.xml', label: '보도자료' },
  insight: { url: 'https://www.korea.kr/rss/insight.xml', label: '이슈인사이트' },
};

// 뉴스 RSS 피드
const NEWS_FEEDS = {
  yonhap: { url: 'https://www.yna.co.kr/rss/news.xml', label: '연합뉴스' },
  googleKR: { url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko', label: 'Google 뉴스 KR' },
};

// 카테고리별 Google News 검색 RSS (한국)
const CATEGORY_QUERIES = {
  tech: 'AI OR 반도체 OR 테크 OR 로봇 OR 클라우드',
  finance: '주식 OR 부동산 OR 경제 OR 금리 OR 투자',
  policy: '정부 OR 국회 OR 정책 OR 선거 OR 대통령',
  world: '미국 OR 중국 OR 외교 OR 국제 OR 전쟁',
  society: '교육 OR 환경 OR 복지 OR 사건 OR 인구',
  lifestyle: '건강 OR 여행 OR 다이어트 OR 운동 OR 맛집',
  culture: '영화 OR 드라마 OR K-pop OR 게임 OR 스포츠',
};

function getCategoryFeedUrl(cat) {
  const query = CATEGORY_QUERIES[cat];
  if (!query) return null;
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=ko&gl=KR&ceid=KR:ko';
}

/**
 * 단일 RSS 피드 파싱
 */
async function parseFeed(url) {
  const feed = await parser.parseURL(url);
  // Google News RSS는 title에 "기사제목 - 출처" 형식
  return (feed.items || []).map(item => {
    const title = item.title || '';
    // "기사제목 - 출처이름" 에서 출처 추출
    const dashIdx = title.lastIndexOf(' - ');
    const articleTitle = dashIdx > 0 ? title.slice(0, dashIdx) : title;
    const articleSource = dashIdx > 0 ? title.slice(dashIdx + 3) : (item.source?.name || '');

    return {
      title: articleTitle,
      description: (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').slice(0, 200),
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || '',
      source: articleSource,
    };
  });
}

/**
 * 정책브리핑 전체 수집
 * @returns {Array<{feed: string, label: string, items: Array}>}
 */
async function collectPolicyFeeds() {
  const results = [];
  for (const [key, feed] of Object.entries(POLICY_FEEDS)) {
    try {
      const items = await parseFeed(feed.url);
      results.push({ feed: key, label: feed.label, items: items.slice(0, 15) });
    } catch (err) {
      results.push({ feed: key, label: feed.label, items: [], error: err.message });
    }
  }
  return results;
}

/**
 * 뉴스 RSS 수집
 */
async function collectNewsFeeds() {
  const results = [];
  for (const [key, feed] of Object.entries(NEWS_FEEDS)) {
    try {
      const items = await parseFeed(feed.url);
      results.push({ feed: key, label: feed.label, items: items.slice(0, 15) });
    } catch (err) {
      results.push({ feed: key, label: feed.label, items: [], error: err.message });
    }
  }
  return results;
}

/**
 * 뉴스 헤드라인에서 키워드 빈도 추출 (간단한 TF 기반)
 * @param {Array} articles - [{title, description}]
 * @returns {Array<{keyword: string, count: number}>} 상위 키워드
 */
function extractKeywords(articles) {
  // ── 불용어: 뉴스에 자주 나오지만 인사이트 가치가 없는 단어 ──

  // 언론사/미디어/플랫폼 이름
  const mediaNames = new Set([
    '연합뉴스', '뉴시스', '뉴스핌', '머니투데이', '이데일리', '헤럴드경제',
    '경향신문', '한겨레', '조선일보', '중앙일보', '동아일보', '한국일보',
    '매일경제', '한국경제', '서울경제', '아시아경제', '파이낸셜뉴스',
    '서울신문', '세계일보', '국민일보', '문화일보', '내일신문', '한국일보',
    '오마이뉴스', '프레시안', '미디어오늘', '시사인', '한겨레21', '신동아',
    '글로벌이코노믹', '지디넷코리아', '디지털데일리', '전자신문', '블로터',
    '농민신문', '호남교육신문', '교육신문', '법률신문', '약업신문', '의학신문',
    '네이트', '다음', '브런치', '인사이트', '위키트리', '디스패치', '스포츠경향',
    '스포츠조선', '스포츠동아', '일간스포츠', '엑스포츠뉴스', '마이데일리',
    '정책브리핑', '뉴스워치', '뉴데일리', '데일리안', '아이뉴스', '지디넷',
    '뉴스탭', '연합인포맥스', '한민족센터', '시사안성', '중도일보', '충북데일리',
    '전기신문', '더코리아', '코리아타임스', '코리아헤럴드', '서울와이어',
    '뉴스토마토', '뉴스타운', '뉴스웨이', '뉴스원', '뉴스투데이',
    '시사저널', '시사위크', '시사오늘', '시사매거진', '프레스나인',
    'kbs', 'mbc', 'sbs', 'jtbc', 'ytn', 'mbn', 'tvn', 'cnn', 'bbc',
    'reuters', 'bloomberg', 'investing', 'yahoo',
    'daum', 'naver', 'google', 'net', 'com', 'www', 'http', 'https',
  ]);

  // 일반 불용어 (뉴스 서술에 자주 등장하지만 트렌드 가치 없음)
  const stopwords = new Set([
    // 2글자 동사/형용사/부사 (뉴스에서 가장 빈번하지만 무의미)
    '지시', '통과', '사과', '재개', '강화', '개발', '합의', '발표', '승인',
    '논의', '검토', '조사', '요청', '대응', '조치', '시행', '도입', '추진',
    '시작', '마련', '공개', '보기', '실시', '확인', '진행', '수행', '처리',
    '위해', '대한', '통해', '관련', '대해', '따라', '함께', '위한', '향한',
    '있는', '하는', '된다', '한다', '했다', '없다', '있다', '이다', '됐다',
    '상당', '대체', '전반', '일부', '기타', '해당', '관련', '이번', '당시',
    '이상', '이하', '이후', '이전', '사이', '중에', '때문', '경우', '가운데',
    '강조', '설명', '지적', '언급', '평가', '분석', '전망', '예상', '우려',
    '증가', '감소', '상승', '하락', '유지', '변동', '확대', '축소', '감축',
    '가능', '필요', '중요', '적극', '신속', '긴급', '주요', '주목', '각종',
    '지원', '참여', '활동', '사업', '운영', '계획', '결과', '대상', '방안',
    '대표', '위원', '관계자', '당국', '장관', '차관', '비서', '수석',
    '포함', '이어', '나서', '보여', '알려', '전해', '밝혀', '드러',
    '매도', '매수', '거래', '종목', '수익', '실적', '성장', '달성',
    '역량강화', '역량', '기반', '체계', '구조', '체제', '제도', '시스템',
    // 3글자 불용어
    '것으로', '에서는', '으로는', '것은', '것도', '것이', '것을',
    '했습니다', '합니다', '입니다', '습니다', '됩니다', '있다고',
    '밝혔다', '전했다', '말했다', '보인다', '됐다고', '나타났',
    '관련해', '관련된', '대하여', '따르면', '의하면', '발생한', '진행한',
    '새로운', '다양한', '대체로', '전반적', '본격적', '적극적',
    '하지만', '그러나', '그래서', '한편', '또한', '아울러',
    // 시간 표현
    '오전', '오후', '어제', '오늘', '내일', '모레', '이날', '당일', '하루',
    '올해', '지난', '내년', '작년', '지난해', '전년', '전월', '당월',
    '현재', '최근', '지금', '현지시간', '남은',
    // 일반 명사 (너무 광범위해서 인사이트 없음)
    '전체', '모든', '같은', '이런', '그런', '어떤', '가장',
    '지역', '전국', '국내', '국외', '해외', '글로벌',
    '대한민국', '한국어', '한국',
    '분야', '부문', '방면', '측면', '차원', '수준', '정도',
    '소식', '상황', '내용', '문제', '사실', '의견', '입장',
    '특파원', '기자', '뉴스', '보도', '속보', '단독', '종합',
    '비공개', '무료', '제공', '안내', '소개', '정보',
    '다시', '바로', '더욱', '매우', '상당히', '대폭', '소폭',
    // RSS/웹 관련
    '연합', '조선', '동아', '경향', '서울', '매일', '시사',
  ]);

  const wordCount = {};

  for (const article of articles) {
    // 제목만 사용 (description은 노이즈가 많음)
    let text = article.title || '';
    // 따옴표/괄호 안 내용 우선 추출 (핵심 키워드가 있을 확률 높음)
    // 조사 제거: ~의, ~이, ~을, ~를, ~에, ~은, ~는, ~과, ~와, ~로, ~도, ~만, ~까지
    text = text.replace(/([가-힣]{2,})[의이을를에은는과와로도가며서만까]\s/g, '$1 ');
    const words = text.match(/[가-힣]{3,}|[A-Za-z]{3,}/g) || [];
    const seen = new Set();
    for (const w of words) {
      const lower = w.toLowerCase();

      // 기본 필터
      if (lower.length < 2) continue;
      if (seen.has(lower)) continue;
      if (stopwords.has(lower)) continue;
      if (mediaNames.has(lower)) continue;
      if (mediaNames.has(w)) continue;

      // 언론사 패턴 자동 감지
      if (/(?:신문|일보|뉴스|데일리|경제|타임스|타임즈|매거진|저널|위크|투데이|헤럴드|인포|미디어|방송|통신|닷컴|경향|구루|비즈|마켓인|포스트)$/.test(lower)) continue;

      // 끝에 조사/어미가 붙은 단어 정리
      const cleaned = lower.replace(/[의이을를에은는과와로도며서만까]+$/, '');
      if (cleaned.length < 2) continue;
      if (stopwords.has(cleaned) || mediaNames.has(cleaned)) continue;

      // 한글 2글자는 대부분 동사/형용사 → 3글자 이상만 (고유명사 제외)
      if (/^[가-힣]{2}$/.test(w)) {
        // 2글자 한글은 고유명사(인명/지명/브랜드)만 허용
        // 받침 없는 2글자는 대부분 서술어 → 제외
        // 알려진 고유명사는 허용
        const knownProper2 = new Set([
          '삼성', '현대', '엔씨', '카카', '쿠팡', '네이버', '토스',
          '바이든', '시진핑', '기시다', '마크롱', '푸틴', '젤렌',
          '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
          '도쿄', '베이징', '워싱턴', '런던', '파리', '모스크', '키이우',
        ]);
        if (!knownProper2.has(lower)) continue;
      }

      // 정리된 키워드 사용 (조사 제거됨)
      const finalWord = cleaned.length >= 2 ? cleaned : lower;
      if (seen.has(finalWord)) continue;
      seen.add(finalWord);
      wordCount[finalWord] = (wordCount[finalWord] || 0) + 1;
    }
  }

  return Object.entries(wordCount)
    .filter(([_, count]) => count >= 2) // 최소 2건 이상
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * Google News KR 헤드라인에서 핫 토픽 추출 (Google Trends 대안)
 * API 키 불필요, rate limit 없음
 */
async function collectHotTopics() {
  // 카테고리별 뉴스 수집 → 각 카테고리에서 고유 키워드 추출
  const catResults = await Promise.allSettled(
    Object.entries(CATEGORY_QUERIES).map(async ([cat]) => {
      const url = getCategoryFeedUrl(cat);
      const items = await parseFeed(url);
      // 검색에 사용한 키워드는 제외하고 추출
      const searchWords = new Set(CATEGORY_QUERIES[cat].split(' OR ').map(w => w.trim().toLowerCase()));
      const keywords = extractKeywords(items).filter(kw => !searchWords.has(kw.keyword.toLowerCase()));
      return { cat, items, keywords: keywords.slice(0, 5) };
    })
  );

  // 일반 뉴스도 수집
  const generalResults = await Promise.allSettled([
    parseFeed('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko'),
    parseFeed('https://www.yna.co.kr/rss/news.xml'),
  ]);
  const generalItems = generalResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const generalKeywords = extractKeywords(generalItems);

  // 카테고리별 키워드 합산
  const allTopics = [];
  const seen = new Set();

  // 카테고리별 상위 키워드 추가
  for (const result of catResults) {
    if (result.status !== 'fulfilled') continue;
    const { cat, items, keywords } = result.value;
    for (const kw of keywords) {
      if (seen.has(kw.keyword)) continue;
      seen.add(kw.keyword);
      allTopics.push({
        keyword: kw.keyword,
        traffic: `${kw.count}건`,
        category: cat,
        articles: items
          .filter(item => (item.title || '').includes(kw.keyword))
          .slice(0, 2)
          .map(a => ({ title: a.title, source: a.source, url: a.link })),
      });
    }
  }

  // 일반 뉴스 키워드도 추가 (카테고리 없는 것)
  for (const kw of generalKeywords.slice(0, 10)) {
    if (seen.has(kw.keyword)) continue;
    seen.add(kw.keyword);
    allTopics.push({
      keyword: kw.keyword,
      traffic: `${kw.count}건`,
      category: null,
      articles: generalItems
        .filter(item => (item.title || '').includes(kw.keyword))
        .slice(0, 2)
        .map(a => ({ title: a.title, source: a.source, url: a.link })),
    });
  }

  return allTopics.map((t, i) => ({ ...t, rank: i + 1 }));
}

module.exports = { parseFeed, collectPolicyFeeds, collectNewsFeeds, extractKeywords, collectHotTopics, POLICY_FEEDS, NEWS_FEEDS, CATEGORY_QUERIES };
