# card-news-sns-analyzer

A desktop analytics dashboard for tracking and analyzing card news performance across social media platforms.

## Features

- **Multi-platform tracking**: Threads, Instagram, TikTok
- **Growth dashboard**: Follower trends, reach, engagement rates over time
- **Content analysis**: Category-based performance comparison (policy, finance, trend, lifestyle, tech)
- **Time analysis**: Day-of-week × hour heatmap to find optimal posting times
- **Cross-platform comparison**: Same content group performance across platforms (radar chart)
- **Data collection**: Automated API collection + manual entry fallback
- **Export**: CSV / JSON export

## Tech Stack

- **Electron 33** — Desktop application framework
- **SQLite** (better-sqlite3) — Local database
- **Chart.js 4** — Data visualization
- **Vanilla JS** — No frontend framework dependency

## Setup

```bash
npm install
npx electron-rebuild -f -w better-sqlite3
npm start
```

## Configuration

This app reads API tokens from [card-news-maker](https://github.com/lnto3408/card-news-maker)'s config file:

```
~/Library/Application Support/card-news-maker/config.json
```

Supported platforms:
- **Threads** — Meta Threads API (access token + user ID)
- **Instagram** — Instagram Graph API (access token + account ID)
- **TikTok** — TikTok API (access token) or emulator scraping fallback

## Screenshots

*Dashboard with multi-platform analytics and content performance charts.*

## License

[MIT License](LICENSE)
