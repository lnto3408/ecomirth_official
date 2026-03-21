// Instagram Messaging Webhook Server
// Meta가 DM 이벤트를 이 서버로 전송함
const http = require('http');
const crypto = require('crypto');

const WEBHOOK_PORT = 3847;
let messageCallback = null;
let server = null;

/**
 * Webhook 서버 시작
 * @param {string} verifyToken - Meta App Dashboard에 설정한 verify token
 * @param {string} appSecret - Meta App의 App Secret (서명 검증용)
 * @param {function} onMessage - 메시지 수신 콜백
 */
function start(verifyToken, appSecret, onMessage) {
  messageCallback = onMessage;

  server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${WEBHOOK_PORT}`);

    // GET: Meta webhook 검증
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Webhook] 검증 성공');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        console.log('[Webhook] 검증 실패');
        res.writeHead(403);
        res.end('Forbidden');
      }
      return;
    }

    // POST: 이벤트 수신
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);

        // 서명 검증 (선택, appSecret 있을 때)
        if (appSecret) {
          const signature = req.headers['x-hub-signature-256'];
          if (signature) {
            const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
            if (signature !== expected) {
              console.error('[Webhook] 서명 검증 실패');
              res.writeHead(403);
              res.end('Invalid signature');
              return;
            }
          }
        }

        try {
          const data = JSON.parse(body.toString());
          console.log('[Webhook] 이벤트 수신:', JSON.stringify(data).slice(0, 300));
          handleWebhookEvent(data);
        } catch (err) {
          console.error('[Webhook] 파싱 오류:', err.message);
        }

        // Meta는 빠른 200 응답을 기대
        res.writeHead(200);
        res.end('EVENT_RECEIVED');
      });
      return;
    }

    // 기타 경로
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'sns-analyzer-webhook' }));
  });

  server.listen(WEBHOOK_PORT, () => {
    console.log(`[Webhook] 서버 시작 - port ${WEBHOOK_PORT}`);
  });

  return WEBHOOK_PORT;
}

let commentCallback = null;

function setCommentCallback(cb) {
  commentCallback = cb;
}

function handleWebhookEvent(data) {
  if (data.object !== 'instagram') return;

  for (const entry of (data.entry || [])) {
    // DM 메시지
    for (const event of (entry.messaging || [])) {
      const msg = {
        type: 'message',
        senderId: event.sender?.id,
        recipientId: event.recipient?.id,
        timestamp: event.timestamp,
        text: event.message?.text || null,
        attachments: event.message?.attachments || [],
        messageId: event.message?.mid,
        isEcho: event.message?.is_echo || false,
        postback: event.postback || null,
      };

      console.log(`[Webhook] DM 수신: ${msg.senderId} → "${msg.text || '(첨부)'}"`);

      if (messageCallback && !msg.isEcho) {
        messageCallback(msg);
      }
    }

    // 댓글 이벤트
    for (const change of (entry.changes || [])) {
      if (change.field === 'comments') {
        const comment = {
          type: 'comment',
          id: change.value?.id,
          text: change.value?.text || '',
          from: change.value?.from || {},
          mediaId: change.value?.media?.id,
          timestamp: entry.time,
        };

        console.log(`[Webhook] 댓글 수신: ${comment.from.username || comment.from.id} → "${comment.text}"`);

        if (commentCallback) {
          commentCallback(comment);
        }
      }
    }
  }
}

function stop() {
  if (server) {
    server.close();
    server = null;
    console.log('[Webhook] 서버 종료');
  }
}

function getPort() {
  return WEBHOOK_PORT;
}

module.exports = { start, stop, getPort, setCommentCallback };
