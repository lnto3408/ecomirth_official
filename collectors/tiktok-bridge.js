// TikTok data collection via Python uiautomator2 scraper bridge
const { spawn } = require('child_process');
const path = require('path');

const SCRAPER_PATH = path.join(__dirname, '..', 'scripts', 'tiktok-scraper.py');
const SNS_COMMON_DIR = path.join(__dirname, '..', '..', 'card-news-maker', 'scripts');

async function collect(db) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PYTHONPATH: SNS_COMMON_DIR + (process.env.PYTHONPATH ? ':' + process.env.PYTHONPATH : ''),
    };

    const proc = spawn('python3', [SCRAPER_PATH], { env, timeout: 300000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`TikTok 스크래퍼 실패 (code ${code}): ${stderr || stdout}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        let postsUpdated = 0;

        // Process scraped posts
        for (const item of (result.posts || [])) {
          let post = db.getPostByPlatformId('tiktok', item.id);
          if (!post) {
            const postId = db.addPost({
              platform: 'tiktok',
              platform_post_id: item.id,
              caption: item.caption || '',
              hashtags: item.hashtags || [],
              category: 'other',
              posted_at: item.posted_at || new Date().toISOString(),
            });
            post = { id: postId };
          }

          db.addMetrics(post.id, {
            views: item.views || 0,
            likes: item.likes || 0,
            comments: item.comments || 0,
            shares: item.shares || 0,
          });
          postsUpdated++;
        }

        // Process account stats
        if (result.account) {
          const today = new Date().toISOString().slice(0, 10);
          db.upsertAccountStats('tiktok', today, {
            followers: result.account.followers || 0,
            following: result.account.following || 0,
            total_reach: result.account.views || 0,
          });
        }

        resolve({ message: `TikTok: ${postsUpdated}개 포스트 수집 완료`, postsUpdated });
      } catch (parseErr) {
        reject(new Error(`TikTok 결과 파싱 실패: ${parseErr.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`TikTok 스크래퍼 실행 실패: ${err.message}`));
    });
  });
}

module.exports = { collect };
