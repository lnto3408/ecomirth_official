// YouTube Trending Videos collector (Korea)
const https = require('https');

/**
 * YouTube 한국 인기 동영상 조회
 * @param {string} apiKey - YouTube Data API v3 key
 * @param {number} maxResults - 최대 결과 수 (기본 20, 최대 50)
 */
async function getTrendingVideos(apiKey, maxResults = 20, regionCode = 'KR') {
  if (!apiKey) throw new Error('YouTube API 키가 설정되지 않았습니다');

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=${maxResults}&key=${apiKey}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(text);
          if (json.error) {
            reject(new Error(json.error.message || `YouTube API error ${json.error.code}`));
            return;
          }
          const videos = (json.items || []).map(item => ({
            id: item.id,
            title: item.snippet?.title || '',
            channel: item.snippet?.channelTitle || '',
            thumbnail: item.snippet?.thumbnails?.medium?.url || '',
            publishedAt: item.snippet?.publishedAt || '',
            categoryId: item.snippet?.categoryId || '',
            views: parseInt(item.statistics?.viewCount) || 0,
            likes: parseInt(item.statistics?.likeCount) || 0,
            comments: parseInt(item.statistics?.commentCount) || 0,
            tags: (item.snippet?.tags || []).slice(0, 10),
          }));
          resolve(videos);
        } catch {
          reject(new Error(`Invalid response: ${text.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 인기 동영상에서 키워드 추출
 */
function extractVideoKeywords(videos) {
  const wordCount = {};
  for (const video of videos) {
    const text = `${video.title} ${video.tags.join(' ')}`;
    const words = text.match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || [];
    const seen = new Set();
    for (const w of words) {
      const lower = w.toLowerCase();
      if (lower.length < 2 || seen.has(lower)) continue;
      seen.add(lower);
      wordCount[lower] = (wordCount[lower] || 0) + 1;
    }
  }
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));
}

module.exports = { getTrendingVideos, extractVideoKeywords };
