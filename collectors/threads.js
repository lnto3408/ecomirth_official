// Threads Insights API collector
// Uses Meta Graph API v21.0

const BASE_URL = 'https://graph.threads.net/v1.0';

async function collect(config, db, fetchJson) {
  if (!config?.accessToken || !config?.userId) {
    throw new Error('Threads API 토큰 또는 userId가 설정되지 않았습니다. card-news-maker 설정을 확인하세요.');
  }

  const { accessToken, userId } = config;
  let postsUpdated = 0;

  // 1. Fetch threads list
  const threadsResp = await fetchJson(
    `${BASE_URL}/${userId}/threads?fields=id,text,timestamp,media_type,permalink&limit=50&access_token=${accessToken}`
  );

  const threads = threadsResp.data || [];

  for (const thread of threads) {
    // Check if post already exists
    let post = db.getPostByPlatformId('threads', thread.id);

    if (!post) {
      // Extract hashtags from text
      const hashtags = (thread.text || '').match(/#[\w\uAC00-\uD7A3]+/g) || [];
      const postId = db.addPost({
        platform: 'threads',
        platform_post_id: thread.id,
        caption: thread.text || '',
        hashtags,
        category: 'other',
        posted_at: thread.timestamp || new Date().toISOString(),
        slide_count: thread.media_type === 'CAROUSEL_ALBUM' ? 0 : 1,
      });
      post = { id: postId };
    }

    // 2. Fetch insights for each thread
    try {
      const insights = await fetchJson(
        `${BASE_URL}/${thread.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${accessToken}`
      );

      const metricsMap = {};
      for (const item of (insights.data || [])) {
        metricsMap[item.name] = item.values?.[0]?.value || 0;
      }

      db.addMetrics(post.id, {
        views: metricsMap.views || 0,
        likes: metricsMap.likes || 0,
        comments: metricsMap.replies || 0,
        shares: metricsMap.reposts || 0,
        saves: metricsMap.quotes || 0,
      });

      postsUpdated++;
    } catch (err) {
      // Some posts may not have insights (too old, etc.)
      console.error(`Threads insights error for ${thread.id}:`, err.message);
    }
  }

  // 3. Account-level stats (profile insights)
  try {
    const profileInsights = await fetchJson(
      `${BASE_URL}/${userId}/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count&access_token=${accessToken}`
    );
    const statsMap = {};
    for (const item of (profileInsights.data || [])) {
      statsMap[item.name] = item.total_value?.value || item.values?.[0]?.value || 0;
    }
    const today = new Date().toISOString().slice(0, 10);
    db.upsertAccountStats('threads', today, {
      followers: statsMap.followers_count || 0,
      total_reach: statsMap.views || 0,
    });
  } catch (err) {
    console.error('Threads profile insights error:', err.message);
  }

  return { message: `Threads: ${postsUpdated}개 포스트 수집 완료`, postsUpdated };
}

module.exports = { collect };
