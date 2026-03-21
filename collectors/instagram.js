// Instagram Graph API collector
// Uses Meta Graph API v21.0

const BASE_URL = 'https://graph.instagram.com/v21.0';

async function collect(config, db, fetchJson, matchCategory) {
  if (!config?.accessToken || !config?.accountId) {
    throw new Error('Instagram API 토큰 또는 accountId가 설정되지 않았습니다. card-news-maker 설정을 확인하세요.');
  }

  const { accessToken, accountId } = config;
  let newPosts = 0;
  let updatedPosts = 0;

  // 1. Fetch media list
  const mediaResp = await fetchJson(
    `${BASE_URL}/${accountId}/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink&limit=50&access_token=${accessToken}`
  );

  const mediaList = mediaResp.data || [];

  for (const media of mediaList) {
    let post = db.getPostByPlatformId('instagram', media.id);

    const isNew = !post;
    if (isNew) {
      const hashtags = (media.caption || '').match(/#[\w\uAC00-\uD7A3]+/g) || [];
      const postId = db.addPost({
        platform: 'instagram',
        platform_post_id: media.id,
        caption: media.caption || '',
        hashtags,
        category: (matchCategory && matchCategory(media.caption, 'instagram')) || 'other',
        posted_at: media.timestamp || new Date().toISOString(),
        slide_count: media.media_type === 'CAROUSEL_ALBUM' ? 0 : 1,
      });
      post = { id: postId };
      newPosts++;
    }

    // 2. Fetch media insights
    try {
      const insights = await fetchJson(
        `${BASE_URL}/${media.id}/insights?metric=reach,saved,shares,total_interactions&access_token=${accessToken}`
      );

      const metricsMap = {};
      for (const item of (insights.data || [])) {
        metricsMap[item.name] = item.values?.[0]?.value || 0;
      }

      db.addMetrics(post.id, {
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
        reach: metricsMap.reach || 0,
        saves: metricsMap.saved || 0,
        shares: metricsMap.shares || 0,
        views: metricsMap.total_interactions || 0,
      });

      if (!isNew) updatedPosts++;
    } catch (err) {
      // Basic metrics without insights
      db.addMetrics(post.id, {
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
      });
      if (!isNew) updatedPosts++;
    }
  }

  // 3. Account stats (follower count from profile)
  try {
    const today = new Date().toISOString().slice(0, 10);
    const accountInfo = await fetchJson(
      `${BASE_URL}/${accountId}?fields=followers_count,follows_count&access_token=${accessToken}`
    );

    db.upsertAccountStats('instagram', today, {
      followers: accountInfo.followers_count || 0,
      following: accountInfo.follows_count || 0,
    });
  } catch (err) {
    console.error('Instagram account stats error:', err.message);
  }

  const parts = [];
  if (newPosts > 0) parts.push(`${newPosts}개 신규`);
  if (updatedPosts > 0) parts.push(`${updatedPosts}개 업데이트`);
  const msg = parts.length > 0 ? parts.join(', ') : '변경 없음';
  return { message: `Instagram: ${msg}`, postsUpdated: newPosts };
}

module.exports = { collect };
